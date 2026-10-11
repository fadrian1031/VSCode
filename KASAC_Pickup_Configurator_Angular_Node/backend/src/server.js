import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalog } from './catalog.js';
import { createStorage } from './storage.js';
import { createNotifier } from './notify.js';
import { sanitizeConfiguration } from './sanitize.js';
import { draftQuote, sanitizeQuote, nextQuoteNumber, totals } from './quotes.js';
import { buildQuotePdf } from './pdf.js';
import { buildQuoteXlsx } from './excel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localData = path.join(__dirname, '../data');
const storage = await createStorage({
  databaseUrl: process.env.DATABASE_URL,
  dataFile: path.resolve(process.env.DATA_FILE || path.join(localData, 'requests.json')),
  fallbackDir: localData
});
const { store, photos: photoStore } = storage;
const notifier = createNotifier();
// Solicitudes sin cotizar se conservan RETENTION_DAYS días (por defecto 30); las cotizadas y aprobadas, siempre.
const retentionDays = Number(process.env.RETENTION_DAYS ?? 30);
// Web KASAC (kasac-web) y Área Comercial (build "comercial" de Angular) servidas por este mismo servidor.
const webDir = path.resolve(
  process.env.WEB_DIR || path.join(__dirname, '../../../kasac-web-con-configurador/kasac-web')
);
const comercialDist = path.resolve(__dirname, '../../frontend/dist/kasac-comercial/browser');
const exists = async p => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};
const hasWeb = await exists(path.join(webDir, 'index.html'));
const app = express();
const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === 'production';
const configuredFrontendUrl = (process.env.PUBLIC_FRONTEND_URL || '').replace(/\/$/, '');
/** Origen real desde el que llegó la petición (https://… de Render, http://localhost:3000, etc.). */
function originOf(req) {
  const o = req.get('origin');
  if (o && /^https?:\/\/[^/]+$/.test(o)) return o;
  const proto = (req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
  return `${proto}://${req.get('x-forwarded-host') || req.get('host')}`;
}
// Versión pública: COMMERCIAL_ENABLED=false o `node src/server.js --public`. Sin login ni endpoints del Área Comercial.
const commercialEnabled = process.env.COMMERCIAL_ENABLED !== 'false' && !process.argv.includes('--public');

// Credenciales del Área Comercial. Los valores demo solo se aceptan fuera de producción:
// con ellos cualquiera podría firmar sesiones válidas o entrar con la clave publicada en el README.
const DEMO = { secret: 'dev-secret-change-me', email: 'comercial@kasac.pe', password: 'Kasac2026!' };
const secret = process.env.SESSION_SECRET || DEMO.secret;
const commercialEmail = (process.env.COMMERCIAL_EMAIL || DEMO.email).toLowerCase();
const commercialPassword = process.env.COMMERCIAL_PASSWORD || DEMO.password;
if (production && commercialEnabled) {
  const problems = [];
  if (secret === DEMO.secret || secret.length < 32)
    problems.push('SESSION_SECRET (mínimo 32 caracteres, distinto del valor demo)');
  if (commercialPassword === DEMO.password || commercialPassword.length < 10)
    problems.push('COMMERCIAL_PASSWORD (mínimo 10 caracteres, distinta de la clave demo)');
  if (problems.length) {
    console.error(
      `No se inicia en producción con credenciales demo. Define en backend/.env:\n  - ${problems.join('\n  - ')}\nGenera una clave con: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
    process.exit(1);
  }
}

// Detrás de un proxy (Nginx, Render, Railway...) define TRUST_PROXY=1 para que el límite de intentos use la IP real.
if (process.env.TRUST_PROXY)
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
// 'wasm-unsafe-eval' permite solo compilar WebAssembly (decodificador meshopt de los modelos 3D); no habilita eval() de JavaScript.
// frame-src: mapa de Google en la página de contacto (y el configurador embebido, del mismo origen).
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        frameSrc: ["'self'", 'https://maps.google.com', 'https://www.google.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://kasac.pe', 'https://www.kasac.pe']
      }
    }
  })
);
// Acepta cualquier origen, igual que antes en producción: así la web funciona abierta como localhost,
// 127.0.0.1 o la IP de red. Los endpoints comerciales se protegen con el token, no con CORS.
app.use(cors({ origin: true }));
// Las fotos del vehículo llegan en base64: solo esa ruta acepta cuerpos grandes.
const jsonSmall = express.json({ limit: '1mb' }),
  jsonPhotos = express.json({ limit: '15mb' });
app.use((req, res, next) => (req.path.endsWith('/photos') ? next() : jsonSmall(req, res, next)));

const safe = s =>
  String(s ?? '')
    .trim()
    .slice(0, 1000);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+\d][\d\s()-]{5,19}$/;
// Flujo comercial: Nueva → Contactado → Negociando → Cotizada → Aprobada (o Perdida).
const STATUSES = ['NEW', 'CONTACTED', 'NEGOTIATING', 'QUOTED', 'APPROVED', 'LOST'];
const normalize = lead => (lead.status === 'WON' ? { ...lead, status: 'APPROVED' } : lead); // solicitudes anteriores a las cotizaciones

function publicToken() {
  return crypto.randomBytes(24).toString('hex');
}
function nextCode(rows) {
  const prefix = `SOL-${new Date().getFullYear()}-`;
  const last = rows
    .filter(x => x.code?.startsWith(prefix))
    .reduce((max, x) => Math.max(max, Number(x.code.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(last + 1).padStart(5, '0')}`;
}

// Sesión comercial (token firmado con HMAC)
const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const hmac = v => crypto.createHmac('sha256', secret).update(v).digest('base64url');
const sameText = (a, b) =>
  crypto.timingSafeEqual(
    crypto.createHash('sha256').update(a).digest(),
    crypto.createHash('sha256').update(b).digest()
  );
function signSession() {
  const payload = b64({ sub: 'commercial', exp: Date.now() + 12 * 60 * 60 * 1000 });
  return `${payload}.${hmac(payload)}`;
}
function verifySession(token) {
  try {
    const [p, s] = token.split('.');
    if (!p || !s || !sameText(s, hmac(p))) return false;
    const value = JSON.parse(Buffer.from(p, 'base64url').toString());
    return value.sub === 'commercial' && value.exp > Date.now();
  } catch {
    return false;
  }
}
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
  if (!verifySession(token)) return res.status(401).json({ message: 'Sesión inválida o expirada.' });
  next();
}

// Límite de intentos de login por IP: 5 fallos en 15 minutos bloquean hasta que pase la ventana.
const LOGIN_WINDOW_MS = 15 * 60 * 1000,
  LOGIN_MAX_FAILS = 5;
const loginFails = new Map();
function loginBlocked(ip) {
  const entry = loginFails.get(ip);
  if (!entry) return 0;
  if (Date.now() - entry.first > LOGIN_WINDOW_MS) {
    loginFails.delete(ip);
    return 0;
  }
  return entry.count >= LOGIN_MAX_FAILS ? Math.ceil((entry.first + LOGIN_WINDOW_MS - Date.now()) / 60000) : 0;
}
function registerLoginFail(ip) {
  if (loginFails.size > 5000)
    for (const [k, v] of loginFails) if (Date.now() - v.first > LOGIN_WINDOW_MS) loginFails.delete(k);
  const entry = loginFails.get(ip);
  if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS)
    loginFails.set(ip, { first: Date.now(), count: 1 });
  else entry.count++;
}

// Solicitudes
function validateCustomer(customer) {
  if (!customer) return 'Solicitud incompleta.';
  if (!safe(customer.fullName) || !safe(customer.email) || !safe(customer.phone))
    return 'Nombre, correo y teléfono son obligatorios.';
  if (!EMAIL.test(safe(customer.email))) return 'El correo no es válido.';
  if (!PHONE.test(safe(customer.phone))) return 'El teléfono no es válido.';
  if (customer.type !== 'personal' && (!safe(customer.companyName) || !safe(customer.ruc)))
    return 'Razón social y RUC son obligatorios para empresas.';
  return '';
}
function cleanCustomer(c) {
  return {
    type: c.type === 'personal' ? 'personal' : 'corporate',
    fullName: safe(c.fullName),
    email: safe(c.email),
    phone: safe(c.phone),
    document: safe(c.document),
    companyName: safe(c.companyName),
    ruc: safe(c.ruc),
    position: safe(c.position),
    city: safe(c.city),
    notes: safe(c.notes)
  };
}
// Lo que el cliente puede ver por su enlace: sin datos personales, estado, id interno ni notas comerciales.
function publicView(lead) {
  return { code: lead.code, createdAt: lead.createdAt, configuration: lead.configuration };
}

// Los manejadores async pasan sus errores al manejador final (Express 5 lo hace automáticamente).
app.get('/api/health', (req, res) =>
  res.json({
    ok: true,
    service: 'KASAC Pickup Configurator API',
    time: new Date().toISOString(),
    storage: storage.kind,
    persistent: storage.persistent
  })
);
app.get('/api/catalog', (req, res) => res.json(catalog));

app.post('/api/leads', async (req, res) => {
  const err = validateCustomer(req.body?.customer);
  if (err) return res.status(400).json({ message: err });
  const { configuration, error } = sanitizeConfiguration(req.body?.configuration, catalog);
  if (error) return res.status(400).json({ message: error });
  const lead = await store.update(rows => {
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(),
      code: nextCode(rows),
      publicToken: publicToken(),
      status: 'NEW',
      createdAt: now,
      updatedAt: now,
      customer: cleanCustomer(req.body.customer),
      configuration,
      commercialNotes: ''
    };
    rows.unshift(row);
    return row;
  });
  // Con la web servida aquí, el enlace usa la dirección desde la que el cliente envió la solicitud,
  // así siempre abre este mismo servidor (antes, un PUBLIC_FRONTEND_URL distinto generaba enlaces rotos).
  // PUBLIC_REQUEST_URL fuerza otro formato; ej. web en otro hosting: https://www.kasac.pe/configurador#/solicitud/{token}
  const here = originOf(req);
  const publicUrl = process.env.PUBLIC_REQUEST_URL
    ? process.env.PUBLIC_REQUEST_URL.replace('{token}', lead.publicToken)
    : hasWeb
      ? `${here}/configurador#/solicitud/${lead.publicToken}`
      : `${configuredFrontendUrl || (production ? here : 'http://localhost:4200')}/solicitud/${lead.publicToken}`;
  res.status(201).json({ lead: { code: lead.code }, publicUrl });
  // Aviso al área comercial (sin hacer esperar al cliente).
  notifier
    .newLead(lead, configuredFrontendUrl && !hasWeb ? configuredFrontendUrl : here)
    .catch(e => console.error('[aviso] No se pudo enviar el correo:', e.message));
});

app.get('/api/public/requests/:token', async (req, res) => {
  const lead = (await store.all()).find(x => x.publicToken === req.params.token);
  if (!lead) return res.status(404).json({ message: 'Solicitud no encontrada.' });
  res.json(publicView(lead));
});

if (commercialEnabled) {
  app.post('/api/auth/login', (req, res) => {
    const ip = req.ip || 'desconocida';
    const wait = loginBlocked(ip);
    if (wait)
      return res
        .status(429)
        .json({ message: `Demasiados intentos fallidos. Vuelve a intentarlo en ${wait} min.` });
    const email = safe(req.body?.email).toLowerCase(),
      password = String(req.body?.password || '');
    if (!sameText(email, commercialEmail) || !sameText(password, commercialPassword)) {
      registerLoginFail(ip);
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }
    loginFails.delete(ip);
    res.json({
      token: signSession(),
      user: { email: commercialEmail, name: process.env.COMMERCIAL_NAME || 'Equipo Comercial KASAC' }
    });
  });
  // Estado del sistema para el Área Comercial: dónde se guardan los datos y si el correo está activo.
  app.get('/api/commercial/system', auth, (req, res) =>
    res.json({
      storage: storage.kind,
      persistent: storage.persistent,
      retentionDays,
      email: { enabled: notifier.enabled, provider: notifier.provider, to: notifier.to }
    })
  );
  app.get('/api/commercial/requests', auth, async (req, res) =>
    res.json(
      (await store.all())
        .map(normalize)
        .map(l => ({ ...l, quoteTotal: l.quote ? { currency: l.quote.currency, ...totals(l.quote) } : null }))
    )
  );
  const findLead = async id => {
    const l = (await store.all()).find(x => x.id === id);
    return l ? normalize(l) : null;
  };
  app.get('/api/commercial/requests/:id', auth, async (req, res) => {
    const lead = await findLead(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Solicitud no encontrada.' });
    // Si aún no hay cotización, se propone un borrador armado con lo que eligió el cliente.
    res.json({ ...lead, quoteDraft: lead.quote ? null : draftQuote(lead, catalog) });
  });

  // Cotización
  app.put('/api/commercial/requests/:id/quote', auth, async (req, res) => {
    const result = await store.update(rows => {
      const row = rows.find(x => x.id === req.params.id);
      if (!row) return { status: 404, message: 'Solicitud no encontrada.' };
      if (normalize(row).status === 'APPROVED')
        return { status: 409, message: 'La cotización está aprobada. Reábrala para editarla.' };
      const now = new Date().toISOString();
      const base = row.quote || draftQuote(row, catalog);
      const quote = sanitizeQuote(req.body, base);
      quote.number = base.number || nextQuoteNumber(rows);
      quote.version = (base.version || 0) + 1;
      quote.createdAt = base.createdAt || now;
      quote.updatedAt = now;
      row.quote = quote;
      if (['NEW', 'CONTACTED', 'NEGOTIATING'].includes(row.status)) row.status = 'QUOTED';
      row.updatedAt = now;
      return { lead: row };
    });
    if (result.status) return res.status(result.status).json({ message: result.message });
    res.json(normalize(result.lead));
  });
  const setApproval = approve => async (req, res) => {
    const result = await store.update(rows => {
      const row = rows.find(x => x.id === req.params.id);
      if (!row) return { status: 404, message: 'Solicitud no encontrada.' };
      if (!row.quote) return { status: 409, message: 'Primero guarde la cotización.' };
      const now = new Date().toISOString();
      row.status = approve ? 'APPROVED' : 'QUOTED';
      row.quote.approvedAt = approve ? now : null;
      row.updatedAt = now;
      return { lead: row };
    });
    if (result.status) return res.status(result.status).json({ message: result.message });
    res.json(normalize(result.lead));
  };
  app.post('/api/commercial/requests/:id/quote/approve', auth, setApproval(true));
  app.post('/api/commercial/requests/:id/quote/reopen', auth, setApproval(false));

  // Fotos de cada lado (capturadas en el visor del Área Comercial)
  app.put('/api/commercial/requests/:id/photos', auth, jsonPhotos, async (req, res) => {
    if (!(await findLead(req.params.id)))
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    const saved = await photoStore.save(req.params.id, req.body?.views);
    res.json({ saved });
  });
  app.get('/api/commercial/requests/:id/photos', auth, async (req, res) => {
    if (!(await findLead(req.params.id)))
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    const photos = await photoStore.load(req.params.id);
    res.json(
      photos.map(p => ({
        id: p.id,
        name: p.name,
        src: `data:image/jpeg;base64,${p.buffer.toString('base64')}`
      }))
    );
  });

  // Documentos para el cliente / otros sistemas
  const sendDoc = (build, type, ext) => async (req, res) => {
    const lead = await findLead(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Solicitud no encontrada.' });
    if (!lead.quote) return res.status(409).json({ message: 'Primero guarde la cotización.' });
    const buf = await build(lead, await photoStore.load(lead.id));
    res
      .set({
        'Content-Type': type,
        'Content-Disposition': `attachment; filename="${lead.quote.number}.${ext}"`,
        'Cache-Control': 'no-store'
      })
      .send(buf);
  };
  app.get('/api/commercial/requests/:id/quote.pdf', auth, sendDoc(buildQuotePdf, 'application/pdf', 'pdf'));
  app.get(
    '/api/commercial/requests/:id/quote.xlsx',
    auth,
    sendDoc(buildQuoteXlsx, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx')
  );
  app.patch('/api/commercial/requests/:id', auth, async (req, res) => {
    const lead = await store.update(rows => {
      const row = rows.find(x => x.id === req.params.id);
      if (!row) return null;
      // Cotizada y Aprobada solo se asignan al guardar y al aprobar la cotización.
      if (['NEW', 'CONTACTED', 'NEGOTIATING', 'LOST'].includes(req.body?.status))
        row.status = req.body.status;
      if (typeof req.body?.commercialNotes === 'string') row.commercialNotes = safe(req.body.commercialNotes);
      row.updatedAt = new Date().toISOString();
      return row;
    });
    if (!lead) return res.status(404).json({ message: 'Solicitud no encontrada.' });
    res.json(lead);
  });
}

// Las apps Angular leen la dirección de la API de config.js: aquí siempre es este mismo servidor.
const sameOriginConfig = (req, res) =>
  res
    .type('application/javascript')
    .set('Cache-Control', 'no-store')
    .send('window.__KASAC_CONFIG__={apiBaseUrl:"/api"};');
app.get('/configurador-app/config.js', sameOriginConfig);
app.get('/comercial/config.js', sameOriginConfig);

// Área Comercial (pestaña interna, con login): /comercial
if (commercialEnabled && (await exists(path.join(comercialDist, 'index.html')))) {
  app.use('/comercial', express.static(comercialDist, { maxAge: '1h', index: false }));
  app.get(/^\/comercial(\/.*)?$/, (req, res) => res.sendFile(path.join(comercialDist, 'index.html')));
}

if (hasWeb) {
  // URLs limpias: /contacto.html → /contacto e /index.html → / (301, conserva ?consulta); /contacto sirve contacto.html.
  app.use((req, res, next) => {
    const m = (req.method === 'GET' || req.method === 'HEAD') && req.path.match(/^\/([\w-]+)\.html$/);
    if (!m) return next();
    res.redirect(301, (m[1] === 'index' ? '/' : '/' + m[1]) + req.url.slice(req.path.length));
  });
  // Web pública de KASAC en la raíz, con el configurador 3D embebido (/configurador → configurador-app/).
  app.use(express.static(webDir, { maxAge: '1h', extensions: ['html'] }));
} else {
  // Sin la carpeta de la web: se sirve la app Angular interna como antes.
  const dist = path.resolve(__dirname, '../../frontend/dist/kasac-configurator/browser');
  if (await exists(dist)) {
    app.use(express.static(dist, { maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }
}

app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.too.large')
    return res.status(413).json({ message: 'La configuración enviada es demasiado grande.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Solicitud mal formada.' });
  res.status(500).json({ message: 'Error interno del servidor.' });
});
// Limpieza periódica: elimina solicitudes sin cotizar más antiguas que RETENTION_DAYS (0 = nunca).
async function purgeExpired() {
  if (!(retentionDays > 0)) return;
  const limit = Date.now() - retentionDays * 864e5;
  const removed = await store.update(rows => {
    const gone = rows
      .filter(
        r =>
          !r.quote &&
          !['QUOTED', 'APPROVED', 'WON'].includes(r.status) &&
          new Date(r.createdAt).getTime() < limit
      )
      .map(r => r.id);
    for (const id of gone)
      rows.splice(
        rows.findIndex(r => r.id === id),
        1
      );
    return gone;
  });
  for (const id of removed) await photoStore.remove(id).catch(() => {});
  if (removed.length)
    console.log(
      `Limpieza: ${removed.length} solicitud(es) sin cotizar de más de ${retentionDays} días eliminadas.`
    );
}
purgeExpired().catch(e => console.error('Limpieza fallida:', e.message));
setInterval(
  () => purgeExpired().catch(e => console.error('Limpieza fallida:', e.message)),
  12 * 36e5
).unref();

app.listen(port, () => {
  console.log(`KASAC API en http://localhost:${port} · ${commercialEnabled ? 'con' : 'SIN'} Área Comercial`);
  if (hasWeb) console.log(`  Web KASAC:       http://localhost:${port}/`);
  if (commercialEnabled) console.log(`  Área Comercial:  http://localhost:${port}/comercial`);
  console.log(
    `  Datos:           ${storage.kind === 'postgres' ? 'PostgreSQL (DATABASE_URL)' : storage.file}`
  );
  if (!storage.persistent)
    console.warn(
      '  ATENCIÓN: este hosting no tiene disco permanente; las solicitudes se perderán al reiniciar. Configure DATABASE_URL.'
    );
  console.log(
    `  Aviso por correo: ${notifier.enabled ? `${notifier.provider} → ${notifier.to.join(', ')}` : 'desactivado (NOTIFY_EMAIL + RESEND_API_KEY o SMTP_HOST)'}`
  );
});
