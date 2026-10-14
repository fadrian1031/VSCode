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
import { draftQuote, sanitizeQuote, nextQuoteNumber, totals, quoteState, expiresAt } from './quotes.js';
import { buildQuotePdf } from './pdf.js';
import { buildQuoteXlsx } from './excel.js';
import { createUsers, publicUser } from './usuarios.js';
import { registerModules } from './modulos.js';
import { expiryInfo } from './avisos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localData = path.join(__dirname, '../data');
const storage = await createStorage({
  databaseUrl: process.env.DATABASE_URL,
  dataFile: path.resolve(process.env.DATA_FILE || path.join(localData, 'requests.json')),
  fallbackDir: localData
});
const { store, photos: photoStore } = storage;
const users = createUsers(storage.collection('usuarios'));
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
// Flujo de la solicitud: Nueva → Contactado → Negociando → Cotizada → Aprobada o Rechazada.
// "Perdida" se usa para cerrar una solicitud que no llegó a cotizarse.
// Cotizada, Aprobada y Rechazada las asigna el sistema según la cotización.
const MANUAL_STATUSES = ['NEW', 'CONTACTED', 'NEGOTIATING', 'LOST'];
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

/** Registra un cambio en el historial de la solicitud (trazabilidad: quién, cuándo y qué). */
function addEvent(row, by, action, detail = '') {
  row.history = row.history || [];
  row.history.push({ at: new Date().toISOString(), by, action, detail });
}
const STATUS_TEXT = {
  NEW: 'Nueva',
  CONTACTED: 'Contactado',
  NEGOTIATING: 'Negociando',
  QUOTED: 'Cotizada',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  LOST: 'Perdida'
};

// Sesión comercial (token firmado con HMAC)
const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const hmac = v => crypto.createHmac('sha256', secret).update(v).digest('base64url');
const sameText = (a, b) =>
  crypto.timingSafeEqual(
    crypto.createHash('sha256').update(a).digest(),
    crypto.createHash('sha256').update(b).digest()
  );
function signSession(user) {
  const payload = b64({ sub: 'commercial', uid: user.id, exp: Date.now() + 12 * 60 * 60 * 1000 });
  return `${payload}.${hmac(payload)}`;
}
function verifySession(token) {
  try {
    const [p, s] = token.split('.');
    if (!p || !s || !sameText(s, hmac(p))) return null;
    const value = JSON.parse(Buffer.from(p, 'base64url').toString());
    return value.sub === 'commercial' && value.uid && value.exp > Date.now() ? value : null;
  } catch {
    return null;
  }
}
/** Exige sesión válida de un usuario activo; deja el usuario en req.user. */
async function auth(req, res, next) {
  const session = verifySession((req.headers.authorization || '').replace(/^Bearer\s+/, ''));
  const user = session && (await users.find(session.uid));
  if (!user || !user.active) return res.status(401).json({ message: 'Sesión inválida o expirada.' });
  req.user = publicUser(user);
  next();
}
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Solo un administrador puede hacer esto.' });
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
// Lo que el cliente puede ver por su enlace: sin datos personales, id interno ni notas comerciales.
// La cotización solo aparece cuando Comercial la emitió (un borrador nunca se muestra).
function publicQuote(q) {
  const state = quoteState(q);
  if (!state || state === 'BORRADOR') return null;
  return {
    number: q.number,
    state,
    issuedAt: q.issuedAt,
    expiresAt: expiresAt(q),
    validityDays: q.validityDays,
    currency: q.currency,
    model: q.model,
    color: q.color,
    delivery: q.delivery,
    paymentTerms: q.paymentTerms,
    items: q.items.map(i => ({
      section: i.section,
      description: i.description,
      vehicles: i.vehicles,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount
    })),
    totals: totals(q),
    approvedAt: state === 'APROBADA' ? q.approvedAt : null,
    rejectedAt: state === 'RECHAZADA' ? q.rejectedAt : null,
    rejectionReason: state === 'RECHAZADA' ? q.rejectionReason : null
  };
}
function publicView(lead) {
  return {
    code: lead.code,
    createdAt: lead.createdAt,
    configuration: lead.configuration,
    quote: publicQuote(lead.quote)
  };
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
    addEvent(row, 'Cliente (web)', 'Solicitud recibida desde el configurador 3D');
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

const byToken = async token => (await store.all()).find(x => x.publicToken === token);
app.get('/api/public/requests/:token', async (req, res) => {
  const lead = await byToken(req.params.token);
  if (!lead) return res.status(404).json({ message: 'Solicitud no encontrada.' });
  res.json(publicView(lead));
});
// PDF de la cotización emitida, para que el cliente lo descargue desde su enlace.
app.get('/api/public/requests/:token/quote.pdf', async (req, res) => {
  const lead = await byToken(req.params.token);
  if (!lead || !publicQuote(lead.quote))
    return res.status(404).json({ message: 'Cotización no disponible.' });
  const buf = await buildQuotePdf(lead, await photoStore.load(lead.id));
  res
    .set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${lead.quote.number}.pdf"`,
      'Cache-Control': 'no-store'
    })
    .send(buf);
});

/**
 * Registra la respuesta del cliente a una cotización emitida: aprobada (FA) o rechazada (con motivo).
 * by: quién la registra; date: fecha de la respuesta (por defecto, ahora).
 */
function answerQuote(row, { decision, reason, by, date }) {
  const q = row.quote;
  if (quoteState(q) !== 'EMITIDA')
    return { status: 409, message: 'La cotización no está pendiente de respuesta del cliente.' };
  const at = date || new Date().toISOString();
  if (Date.parse(at) < Date.parse(q.issuedAt))
    return { status: 400, message: 'La fecha de respuesta no puede ser anterior a la fecha de emisión.' };
  if (decision === 'aprobar') {
    q.state = 'APROBADA';
    q.approvedAt = at;
    row.status = 'APPROVED';
    addEvent(row, by, `Cotización ${q.number} aprobada`, `Fecha de aprobación (FA): ${at.slice(0, 10)}`);
  } else if (decision === 'rechazar') {
    if (!safe(reason)) return { status: 400, message: 'Indique el motivo del rechazo.' };
    q.state = 'RECHAZADA';
    q.rejectedAt = at;
    q.rejectionReason = safe(reason).slice(0, 300);
    row.status = 'REJECTED';
    addEvent(row, by, `Cotización ${q.number} rechazada`, `Motivo: ${q.rejectionReason}`);
  } else return { status: 400, message: 'Respuesta no válida.' };
  q.answeredBy = by;
  row.updatedAt = new Date().toISOString();
  return { lead: row };
}

app.post('/api/public/requests/:token/respuesta', async (req, res) => {
  const result = await store.update(rows => {
    const row = rows.find(x => x.publicToken === req.params.token);
    if (!row?.quote) return { status: 404, message: 'Cotización no encontrada.' };
    return answerQuote(row, {
      decision: req.body?.decision,
      reason: req.body?.reason,
      by: 'Cliente (enlace)'
    });
  });
  if (result.status) return res.status(result.status).json({ message: result.message });
  res.json(publicView(result.lead));
  notifier
    .quoteAnswered(result.lead, originOf(req))
    .catch(e => console.error('[aviso] No se pudo enviar el correo:', e.message));
});

if (commercialEnabled) {
  app.post('/api/auth/login', async (req, res) => {
    const ip = req.ip || 'desconocida';
    const wait = loginBlocked(ip);
    if (wait)
      return res
        .status(429)
        .json({ message: `Demasiados intentos fallidos. Vuelve a intentarlo en ${wait} min.` });
    const user = await users.login(req.body?.email, req.body?.password);
    if (!user) {
      registerLoginFail(ip);
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }
    loginFails.delete(ip);
    res.json({ token: signSession(user), user: publicUser(user) });
  });
  app.get('/api/commercial/me', auth, (req, res) => res.json(req.user));
  // Estado del sistema para el Área Comercial: dónde se guardan los datos y si el correo está activo.
  app.get('/api/commercial/system', auth, (req, res) =>
    res.json({
      storage: storage.kind,
      persistent: storage.persistent,
      retentionDays,
      email: { enabled: notifier.enabled, provider: notifier.provider, to: notifier.to }
    })
  );
  // En la bandeja cada solicitud lleva el estado de su cotización, FE, FA y el vencimiento (para resaltarlo).
  const summary = l => ({
    ...l,
    quoteState: quoteState(l.quote),
    quoteExpiry: expiryInfo(l.quote),
    quoteTotal: l.quote ? { currency: l.quote.currency, ...totals(l.quote) } : null
  });
  app.get('/api/commercial/requests', auth, async (req, res) =>
    res.json((await store.all()).map(normalize).map(summary))
  );
  const findLead = async id => {
    const l = (await store.all()).find(x => x.id === id);
    return l ? normalize(l) : null;
  };
  app.get('/api/commercial/requests/:id', auth, async (req, res) => {
    const lead = await findLead(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Solicitud no encontrada.' });
    // Si aún no hay cotización, se propone un borrador armado con lo que eligió el cliente.
    res.json({ ...summary(lead), quoteDraft: lead.quote ? null : draftQuote(lead, catalog) });
  });

  // Cotización
  app.put('/api/commercial/requests/:id/quote', auth, async (req, res) => {
    const result = await store.update(rows => {
      const row = rows.find(x => x.id === req.params.id);
      if (!row) return { status: 404, message: 'Solicitud no encontrada.' };
      const state = quoteState(row.quote);
      if (state === 'APROBADA' || state === 'RECHAZADA')
        return { status: 409, message: 'El cliente ya respondió esta cotización; no se puede modificar.' };
      const now = new Date().toISOString();
      const base = row.quote || { ...draftQuote(row, catalog), state: 'BORRADOR' };
      const quote = sanitizeQuote(req.body, base);
      quote.number = base.number || nextQuoteNumber(rows);
      quote.version = (base.version || 0) + 1;
      quote.createdAt = base.createdAt || now;
      quote.updatedAt = now;
      quote.state = state || 'BORRADOR';
      row.quote = quote;
      addEvent(
        row,
        req.user.name,
        `Cotización ${quote.number} guardada (versión ${quote.version})`,
        state === 'EMITIDA' ? 'Modificada después de emitida' : ''
      );
      row.updatedAt = now;
      return { lead: row };
    });
    if (result.status) return res.status(result.status).json({ message: result.message });
    res.json(summary(normalize(result.lead)));
  });
  /** Cambia la cotización dentro de store.update y responde con la solicitud actualizada. */
  const quoteAction = fn => async (req, res) => {
    const result = await store.update(rows => {
      const row = rows.find(x => x.id === req.params.id);
      if (!row) return { status: 404, message: 'Solicitud no encontrada.' };
      if (!row.quote) return { status: 409, message: 'Primero guarde la cotización.' };
      return fn(row, req);
    });
    if (result.status) return res.status(result.status).json({ message: result.message });
    res.json(summary(normalize(result.lead)));
  };
  // Emitir: la cotización se envía al cliente y queda pendiente por aprobar. Aquí se registra la FE.
  app.post(
    '/api/commercial/requests/:id/quote/emit',
    auth,
    quoteAction((row, req) => {
      const q = row.quote;
      const state = quoteState(q);
      if (state === 'APROBADA' || state === 'RECHAZADA')
        return { status: 409, message: 'El cliente ya respondió esta cotización.' };
      const now = new Date().toISOString();
      const first = !q.issuedAt;
      if (first) q.issuedAt = now;
      q.lastSentAt = now;
      q.state = 'EMITIDA';
      row.status = 'QUOTED';
      row.updatedAt = now;
      addEvent(
        row,
        req.user.name,
        first
          ? `Cotización ${q.number} emitida y enviada al cliente`
          : `Cotización ${q.number} reenviada al cliente`,
        first ? `Fecha de emisión (FE): ${now.slice(0, 10)}` : `Versión ${q.version}`
      );
      return { lead: row };
    })
  );
  // Comercial registra la respuesta que el cliente dio por correo o teléfono (con la fecha de ese correo).
  app.post(
    '/api/commercial/requests/:id/quote/response',
    auth,
    quoteAction((row, req) => {
      const raw = safe(req.body?.date);
      let date;
      if (raw) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { status: 400, message: 'Fecha no válida.' };
        // Respuesta del mismo día de la emisión: se toma la hora actual para no quedar antes de la FE.
        const today = new Date().toISOString().slice(0, 10);
        date = raw === today ? new Date().toISOString() : `${raw}T12:00:00.000Z`;
        if (raw > today) return { status: 400, message: 'La fecha no puede ser futura.' };
        if (raw === row.quote.issuedAt?.slice(0, 10) && Date.parse(date) < Date.parse(row.quote.issuedAt))
          date = row.quote.issuedAt;
      }
      const channel = safe(req.body?.channel) || 'correo';
      return answerQuote(row, {
        decision: req.body?.decision,
        reason: req.body?.reason,
        by: `${req.user.name} (respuesta por ${channel})`,
        date
      });
    })
  );
  // Corregir una respuesta registrada por error (solo administrador): vuelve a pendiente por aprobar.
  app.post(
    '/api/commercial/requests/:id/quote/undo-response',
    auth,
    adminOnly,
    quoteAction((row, req) => {
      const q = row.quote;
      const state = quoteState(q);
      if (state !== 'APROBADA' && state !== 'RECHAZADA')
        return { status: 409, message: 'La cotización no tiene una respuesta registrada.' };
      const reason = safe(req.body?.reason);
      if (!reason) return { status: 400, message: 'Indique por qué se corrige la respuesta.' };
      q.state = q.issuedAt ? 'EMITIDA' : 'BORRADOR';
      q.approvedAt = null;
      q.rejectedAt = null;
      q.rejectionReason = null;
      row.status = 'QUOTED';
      row.updatedAt = new Date().toISOString();
      addEvent(
        row,
        req.user.name,
        `Respuesta de ${q.number} anulada (estaba ${state.toLowerCase()})`,
        reason
      );
      return { lead: row };
    })
  );

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
      // Cotizada, Aprobada y Rechazada las asigna el sistema; a mano solo se eligen los estados previos.
      const status = req.body?.status;
      if (MANUAL_STATUSES.includes(status) && status !== row.status) {
        addEvent(
          row,
          req.user.name,
          `Estado: ${STATUS_TEXT[row.status] || row.status} → ${STATUS_TEXT[status]}`
        );
        row.status = status;
      }
      if (
        typeof req.body?.commercialNotes === 'string' &&
        safe(req.body.commercialNotes) !== row.commercialNotes
      ) {
        row.commercialNotes = safe(req.body.commercialNotes);
        addEvent(row, req.user.name, 'Notas internas actualizadas');
      }
      row.updatedAt = new Date().toISOString();
      return row;
    });
    if (!lead) return res.status(404).json({ message: 'Solicitud no encontrada.' });
    res.json(summary(normalize(lead)));
  });

  // Módulos de clientes, indicadores, histórico, avisos y usuarios (modulos.js).
  registerModules(app, { storage, store, users, auth, adminOnly, safe, normalize });
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
          !['QUOTED', 'APPROVED', 'REJECTED', 'WON'].includes(r.status) &&
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
// Primer arranque: crea el administrador con COMMERCIAL_EMAIL / COMMERCIAL_PASSWORD.
if (commercialEnabled)
  await users.ensureAdmin({
    email: commercialEmail,
    password: commercialPassword,
    name: process.env.COMMERCIAL_NAME || 'Administrador'
  });
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
