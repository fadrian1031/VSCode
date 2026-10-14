import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let dir, server, base;

function start(env, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/server.js', ...args], {
      cwd: root,
      env: { ...process.env, DOTENV_CONFIG_PATH: '/dev/null', ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    const onData = d => {
      output += d;
      if (output.includes('KASAC API en')) resolve({ child, output });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', d => (output += d));
    child.on('exit', code => resolve({ child, output, code }));
    child.on('error', reject);
  });
}

const customer = { type: 'personal', fullName: 'Prueba', email: 'qa@example.com', phone: '999888777' };
const post = (url, body, headers = {}) =>
  fetch(base + url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kasac-'));
  const port = 3900 + Math.floor(Math.random() * 90);
  base = `http://localhost:${port}`;
  ({ child: server } = await start({
    PORT: String(port),
    NODE_ENV: 'development',
    DATA_FILE: path.join(dir, 'requests.json')
  }));
});
after(async () => {
  server?.kill();
  await fs.rm(dir, { recursive: true, force: true });
});

test('20 envíos simultáneos se guardan todos, con códigos únicos', async () => {
  const res = await Promise.all(
    Array.from({ length: 20 }, () =>
      post('/api/leads', { customer, configuration: { vehicle: { id: 'hilux-2024' } } })
    )
  );
  assert.ok(res.every(r => r.status === 201));
  const rows = JSON.parse(await fs.readFile(path.join(dir, 'requests.json'), 'utf8'));
  assert.equal(rows.length, 20);
  assert.equal(new Set(rows.map(r => r.code)).size, 20);
});

test('la configuración se reconstruye desde el catálogo', async () => {
  const r = await post('/api/leads', {
    customer,
    configuration: {
      vehicle: { id: 'hilux-2024', modelPath: 'https://evil.example/x.glb' },
      paint: { id: 'rojo', color: '#000000' },
      accessories: [
        {
          catalogItemId: 'toolbox',
          name: '<b>falso</b>',
          fitment: { modelPath: 'https://evil.example/y.glb' },
          transform: {
            position: { x: 9, y: 9, z: 9 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 50, y: 1, z: 1 }
          }
        },
        { catalogItemId: 'no-existe' },
        { catalogItemId: 'rollbar-floor-4p', transform: { position: { x: 3, y: 3, z: 3 } } }
      ],
      junk: 'x'.repeat(1000)
    }
  });
  assert.equal(r.status, 201);
  const rows = JSON.parse(await fs.readFile(path.join(dir, 'requests.json'), 'utf8'));
  const c = rows[0].configuration;
  assert.equal(c.vehicle.modelPath, '/assets/models/vehicles/toyota_hilux_2024.glb');
  assert.deepEqual(c.paint, { id: 'rojo', name: 'Rojo', color: '#8f1d22' });
  assert.equal(c.junk, undefined);
  assert.equal(c.accessories.length, 2);
  const [box, cage] = c.accessories;
  assert.equal(box.name, 'Caja de herramientas en tolva');
  assert.equal(box.fitment.modelPath, '/assets/models/equipment/toolbox.glb');
  assert.deepEqual(box.transform.position, { x: 0.22, y: 1.2, z: 2.08 }); // límites del catálogo
  assert.equal(box.transform.scale.x, 2);
  assert.deepEqual(cage.transform.position, { x: 0, y: 0.84, z: 1.52 }); // pieza fija: posición técnica
});

test('valida correo y teléfono', async () => {
  assert.equal(
    (
      await post('/api/leads', {
        customer: { ...customer, email: 'Sapo' },
        configuration: { vehicle: { id: 'hilux-2024' } }
      })
    ).status,
    400
  );
  assert.equal(
    (
      await post('/api/leads', {
        customer: { ...customer, phone: 'abc' },
        configuration: { vehicle: { id: 'hilux-2024' } }
      })
    ).status,
    400
  );
});

test('el enlace público no expone datos del cliente', async () => {
  const r = await post('/api/leads', { customer, configuration: { vehicle: { id: 'l200-2024' } } });
  const { publicUrl } = await r.json();
  const view = await (await fetch(`${base}/api/public/requests/${publicUrl.split('/').pop()}`)).json();
  assert.deepEqual(Object.keys(view).sort(), ['code', 'configuration', 'createdAt', 'quote']);
  assert.equal(view.quote, null); // sin cotización emitida no hay nada que mostrar
});

test('login: sesión válida y bloqueo tras 5 fallos', async () => {
  const ok = await post('/api/auth/login', { email: 'comercial@kasac.pe', password: 'Kasac2026!' });
  assert.equal(ok.status, 200);
  const { token } = await ok.json();
  assert.equal(
    (await fetch(`${base}/api/commercial/requests`, { headers: { authorization: `Bearer ${token}` } }))
      .status,
    200
  );
  assert.equal(
    (await fetch(`${base}/api/commercial/requests`, { headers: { authorization: `Bearer ${token}x` } }))
      .status,
    401
  );
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await post('/api/auth/login', { email: 'comercial@kasac.pe', password: 'mal' })).status,
      401
    );
  assert.equal(
    (await post('/api/auth/login', { email: 'comercial@kasac.pe', password: 'Kasac2026!' })).status,
    429
  );
});

test('un archivo de datos dañado no se sobrescribe', async () => {
  const file = path.join(dir, 'requests.json');
  await fs.writeFile(file, '[{"roto":');
  assert.equal(
    (await post('/api/leads', { customer, configuration: { vehicle: { id: 'hilux-2024' } } })).status,
    500
  );
  assert.equal(await fs.readFile(file, 'utf8'), '[{"roto":');
});

test('producción no arranca con credenciales demo', async () => {
  const { code, output } = await start({
    PORT: '3999',
    NODE_ENV: 'production',
    DATA_FILE: path.join(dir, 'p.json')
  });
  assert.equal(code, 1);
  assert.match(output, /SESSION_SECRET/);
});

// Cotizaciones
const login = async () =>
  (
    await (
      await post(
        '/api/auth/login',
        { email: 'comercial@kasac.pe', password: 'Kasac2026!' },
        { 'x-forwarded-for': 'otra' }
      )
    ).json()
  ).token;
const call = (token, method, url, body) =>
  fetch(base + url, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

test('flujo de cotización: borrador, emisión (FE), respuesta del cliente (FA) y corrección', async () => {
  // Servidor aparte: el test de login dejó bloqueada esta IP en el servidor principal.
  const port = 3800 + Math.floor(Math.random() * 90);
  const { child } = await start({
    PORT: String(port),
    NODE_ENV: 'development',
    DATA_FILE: path.join(dir, 'q.json')
  });
  const prevBase = base;
  base = `http://localhost:${port}`;
  try {
    const r = await post('/api/leads', {
      customer,
      configuration: {
        vehicle: { id: 'hilux-2024' },
        paint: { id: 'blanco' },
        accessories: [
          { catalogItemId: 'beacon' },
          { catalogItemId: 'beacon' },
          { catalogItemId: 'side-steps' }
        ]
      }
    });
    const { publicUrl } = await r.json();
    const token = await login();
    const [lead] = await (await call(token, 'GET', '/api/commercial/requests')).json();
    const detail = await (await call(token, 'GET', `/api/commercial/requests/${lead.id}`)).json();
    // Borrador: las dos circulinas se agrupan en una línea con cantidad 2, en "Sistema eléctrico".
    const beacon = detail.quoteDraft.items.find(i => i.code.startsWith('SE-CIR'));
    assert.equal(beacon.quantity, 2);
    assert.equal(beacon.section, 'electrico');
    assert.equal(detail.quoteDraft.items.find(i => i.code.startsWith('EM-EST')).section, 'metalica');

    const q = {
      ...detail.quoteDraft,
      items: detail.quoteDraft.items.map(i => ({ ...i, unitPrice: 100, vehicles: 2 }))
    };
    const saved = await (await call(token, 'PUT', `/api/commercial/requests/${lead.id}/quote`, q)).json();
    assert.equal(saved.quoteState, 'BORRADOR');
    assert.equal(saved.status, 'NEW'); // guardar no cambia el estado: la solicitud pasa a Cotizada al emitir
    assert.match(saved.quote.number, /^COT-\d{4}-00001$/);
    const list = await (await call(token, 'GET', '/api/commercial/requests')).json();
    assert.equal(list[0].quoteTotal.subtotal, 600); // (2 circulinas + 1 estribo) × 2 vehículos × 100
    assert.equal(list[0].quoteTotal.total, 708); // + IGV 18 %

    // PATCH no puede saltarse la cotización para aprobar.
    await call(token, 'PATCH', `/api/commercial/requests/${lead.id}`, { status: 'APPROVED' });
    assert.equal(
      (await (await call(token, 'GET', `/api/commercial/requests/${lead.id}`)).json()).status,
      'NEW'
    );

    // Fotos, PDF y Excel.
    const jpg =
      'data:image/jpeg;base64,' +
      Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9
      ]).toString('base64');
    const ph = await (
      await call(token, 'PUT', `/api/commercial/requests/${lead.id}/photos`, {
        views: { frente: jpg, '../../x': jpg }
      })
    ).json();
    assert.deepEqual(ph.saved, ['frente']);
    const pdf = await call(token, 'GET', `/api/commercial/requests/${lead.id}/quote.pdf`);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
      '%PDF'
    );
    const xlsx = await call(token, 'GET', `/api/commercial/requests/${lead.id}/quote.xlsx`);
    assert.equal(
      Buffer.from(await xlsx.arrayBuffer())
        .subarray(0, 2)
        .toString(),
      'PK'
    );
    assert.equal((await fetch(`${base}/api/commercial/requests/${lead.id}/quote.pdf`)).status, 401);

    // Mientras es borrador, el cliente no ve precios ni la cotización.
    const pub = `${base}/api/public/requests/${publicUrl.split('/').pop()}`;
    const postAbs = (url, body) =>
      fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
    let view = await (await fetch(pub)).json();
    assert.equal(view.quote, null);
    assert.ok(!JSON.stringify(view).includes('unitPrice'));
    assert.ok(!/precio|unitPrice/i.test(await (await fetch(`${base}/api/catalog`)).text()));
    // El cliente no puede responder una cotización que no se le ha enviado.
    assert.equal(
      (
        await fetch(pub + '/respuesta', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{"decision":"aprobar"}'
        })
      ).status,
      409
    );

    // Emitir: queda la fecha de emisión (FE) y la solicitud pasa a Cotizada.
    const emitted = await (
      await call(token, 'POST', `/api/commercial/requests/${lead.id}/quote/emit`)
    ).json();
    assert.equal(emitted.quoteState, 'EMITIDA');
    assert.equal(emitted.status, 'QUOTED');
    assert.ok(emitted.quote.issuedAt);
    view = await (await fetch(pub)).json();
    assert.equal(view.quote.state, 'EMITIDA');
    assert.equal(view.quote.totals.total, 708);
    assert.equal((await fetch(`${pub}/quote.pdf`)).headers.get('content-type'), 'application/pdf');

    // Rechazar exige motivo; aprobar registra la fecha de aprobación (FA).
    assert.equal((await postAbs(`${pub}/respuesta`, { decision: 'rechazar' })).status, 400);
    view = await (await postAbs(`${pub}/respuesta`, { decision: 'aprobar' })).json();
    assert.equal(view.quote.state, 'APROBADA');
    assert.ok(view.quote.approvedAt >= emitted.quote.issuedAt);
    assert.equal((await postAbs(`${pub}/respuesta`, { decision: 'rechazar', reason: 'x' })).status, 409);
    // Una cotización respondida ya no se edita.
    assert.equal((await call(token, 'PUT', `/api/commercial/requests/${lead.id}/quote`, q)).status, 409);

    // El administrador puede anular una respuesta registrada por error, indicando el motivo.
    assert.equal(
      (await call(token, 'POST', `/api/commercial/requests/${lead.id}/quote/undo-response`, {})).status,
      400
    );
    const undone = await (
      await call(token, 'POST', `/api/commercial/requests/${lead.id}/quote/undo-response`, {
        reason: 'Prueba'
      })
    ).json();
    assert.equal(undone.quoteState, 'EMITIDA');
    assert.ok(undone.history.some(h => h.action.startsWith('Respuesta de')));
  } finally {
    child.kill();
    base = prevBase;
  }
});

test('monto en letras', async () => {
  const { montoEnLetras } = await import('../src/quotes.js');
  assert.equal(montoEnLetras(100, 'USD'), 'CIEN Y 00/100 DÓLARES AMERICANOS');
  assert.equal(montoEnLetras(21.5, 'PEN'), 'VEINTIUNO Y 50/100 SOLES');
  assert.equal(montoEnLetras(22600.78, 'USD'), 'VEINTIDÓS MIL SEISCIENTOS Y 78/100 DÓLARES AMERICANOS');
  assert.equal(montoEnLetras(1, 'USD'), 'UNO Y 00/100 DÓLAR AMERICANO');
});

// Correo, enlace, retención y PostgreSQL
import http from 'node:http';

test('aviso por correo (Resend simulado) y enlace con el origen del cliente', async () => {
  const mails = [];
  const mock = http.createServer((req, res) => {
    let b = '';
    req.on('data', d => (b += d));
    req.on('end', () => {
      mails.push({ auth: req.headers.authorization, body: JSON.parse(b) });
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"id":"x"}');
    });
  });
  await new Promise(r => mock.listen(0, r));
  const port = 3700 + Math.floor(Math.random() * 90);
  const { child } = await start({
    PORT: String(port),
    NODE_ENV: 'development',
    DATA_FILE: path.join(dir, 'mail.json'),
    NOTIFY_EMAIL: 'avisos@example.com',
    RESEND_API_KEY: 'test-key',
    RESEND_API_URL: `http://localhost:${mock.address().port}/emails`,
    PUBLIC_FRONTEND_URL: 'https://www.kasac.pe'
  });
  try {
    const r = await fetch(`http://localhost:${port}/api/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://kasac-configurador.onrender.com' },
      body: JSON.stringify({
        customer: { ...customer, type: 'corporate', companyName: 'ACME S.A.C.', ruc: '20123456789' },
        configuration: { vehicle: { id: 'hilux-2024' }, accessories: [{ catalogItemId: 'beacon' }] }
      })
    });
    const { publicUrl } = await r.json();
    // PUBLIC_FRONTEND_URL apuntaba a otro dominio: el enlace igual debe abrir este servidor.
    assert.match(
      publicUrl,
      /^https:\/\/kasac-configurador\.onrender\.com\/configurador#\/solicitud\/[0-9a-f]{48}$/
    );
    for (let i = 0; i < 40 && !mails.length; i++) await new Promise(res => setTimeout(res, 50));
    assert.equal(mails.length, 1);
    assert.equal(mails[0].auth, 'Bearer test-key');
    assert.deepEqual(mails[0].body.to, ['avisos@example.com']);
    assert.match(mails[0].body.subject, /^Nueva solicitud SOL-\d{4}-\d{5} · ACME S\.A\.C\. · Toyota Hilux$/);
    assert.match(mails[0].body.html, /https:\/\/kasac-configurador\.onrender\.com\/comercial\/solicitud\//);
  } finally {
    child.kill();
    mock.close();
  }
});

test('limpieza: solicitudes sin cotizar de más de 30 días se eliminan; cotizadas se conservan', async () => {
  const file = path.join(dir, 'ret.json');
  const old = new Date(Date.now() - 40 * 864e5).toISOString(),
    recent = new Date().toISOString();
  const base = {
    publicToken: 'x',
    customer,
    configuration: { vehicle: { id: 'hilux-2024' }, accessories: [], graphics: [] },
    commercialNotes: ''
  };
  await fs.writeFile(
    file,
    JSON.stringify([
      { ...base, id: crypto.randomUUID(), code: 'SOL-1', status: 'NEW', createdAt: old },
      {
        ...base,
        id: crypto.randomUUID(),
        code: 'SOL-2',
        status: 'QUOTED',
        createdAt: old,
        quote: { items: [] }
      },
      { ...base, id: crypto.randomUUID(), code: 'SOL-3', status: 'NEW', createdAt: recent }
    ])
  );
  const port = 3600 + Math.floor(Math.random() * 90);
  const { child } = await start({ PORT: String(port), NODE_ENV: 'development', DATA_FILE: file });
  try {
    await new Promise(r => setTimeout(r, 300));
    const codes = JSON.parse(await fs.readFile(file, 'utf8'))
      .map(r => r.code)
      .sort();
    assert.deepEqual(codes, ['SOL-2', 'SOL-3']);
  } finally {
    child.kill();
  }
});

test('indicadores: PCA, PCR y PCP suman 100 % y el TPA solo usa fechas válidas', async () => {
  const { calculate } = await import('../src/indicadores.js');
  const r = (estado, fe, fa) => ({ estado, fechaEmision: fe, fechaAprobacion: fa, fechaRegistro: fe });
  const res = calculate([
    r('APROBADA', '2026-01-01T00:00:00Z', '2026-01-11T00:00:00Z'), // 10 días
    r('APROBADA', '2026-01-01T00:00:00Z', '2026-01-21T00:00:00Z'), // 20 días
    r('APROBADA', '2026-01-01T00:00:00Z', null), // sin FA: cuenta como aprobada, no entra al TPA
    r('RECHAZADA', '2026-01-02T00:00:00Z', null),
    r('PENDIENTE', null, null)
  ]);
  assert.equal(res.tc, 5);
  assert.equal(res.pca, 60);
  assert.equal(res.pcr, 20);
  assert.equal(res.pcp, 20);
  assert.equal(res.pca + res.pcr + res.pcp, 100);
  assert.equal(res.tpa, 15);
  assert.equal(res.nTpa, 2);
  assert.equal(calculate([]).pca, null);
});

test('histórico: importa el Excel, reconoce estados y fechas y reporta filas con error', async () => {
  const ExcelJS = (await import('exceljs')).default;
  const { parseHistory } = await import('../src/historico.js');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('H');
  ws.addRow(['Registro de cotizaciones 2026']);
  ws.addRow(['N° Cotización', 'Cliente', 'Fecha de Emisión', 'Estado', 'Fecha de Aprobación']);
  ws.addRow(['C-1', 'A', new Date('2026-01-05'), 'Aprobado', '03/02/2026']);
  ws.addRow(['C-2', 'B', '2026-01-10', 'RECHAZADA', '']);
  ws.addRow(['C-3', 'C', '12/01/2026', 'en espera', '']);
  ws.addRow(['C-1', 'D', '12/01/2026', 'Pendiente', '']); // número repetido
  ws.addRow(['C-5', 'E', 'sin fecha', 'Aprobada', '']);
  const { rows, errors } = await parseHistory(Buffer.from(await wb.xlsx.writeBuffer()));
  assert.deepEqual(
    rows.map(r => r.estado),
    ['APROBADA', 'RECHAZADA', 'PENDIENTE']
  );
  assert.equal(rows[0].fechaAprobacion.slice(0, 10), '2026-02-03');
  assert.deepEqual(
    errors.map(e => e.fila),
    [6, 7]
  );
});

test('usuarios: el comercial no administra usuarios y siempre queda un administrador', async () => {
  const port = 3700 + Math.floor(Math.random() * 90);
  const { child } = await start({
    PORT: String(port),
    NODE_ENV: 'development',
    DATA_FILE: path.join(dir, 'u.json')
  });
  const prevBase = base;
  base = `http://localhost:${port}`;
  try {
    const admin = await login();
    const created = await call(admin, 'POST', '/api/commercial/usuarios', {
      name: 'Vendedor',
      email: 'vendedor@kasac.pe',
      password: 'clave-segura',
      role: 'comercial'
    });
    assert.equal(created.status, 201);
    assert.ok(!('password' in (await created.json())));
    const seller = (
      await (await post('/api/auth/login', { email: 'vendedor@kasac.pe', password: 'clave-segura' })).json()
    ).token;
    assert.equal((await call(seller, 'GET', '/api/commercial/usuarios')).status, 403);
    assert.equal((await call(seller, 'GET', '/api/commercial/indicadores')).status, 200);
    const users = await (await call(admin, 'GET', '/api/commercial/usuarios')).json();
    const me = users.find(u => u.role === 'admin');
    assert.equal(
      (await call(admin, 'PATCH', `/api/commercial/usuarios/${me.id}`, { role: 'comercial' })).status,
      400
    );
    // Un usuario desactivado ya no puede usar su sesión.
    const v = users.find(u => u.email === 'vendedor@kasac.pe');
    await call(admin, 'PATCH', `/api/commercial/usuarios/${v.id}`, { active: false });
    assert.equal((await call(seller, 'GET', '/api/commercial/requests')).status, 401);
  } finally {
    child.kill();
    base = prevBase;
  }
});

test('avisos: una cotización emitida sin respuesta avisa antes y después de vencer', async () => {
  const { computeNotices } = await import('../src/avisos.js');
  const day = 864e5,
    now = Date.parse('2026-06-30T12:00:00Z');
  const lead = (id, issuedDaysAgo) => ({
    id,
    code: id,
    status: 'QUOTED',
    createdAt: '2026-05-01T00:00:00Z',
    customer: { type: 'personal', fullName: 'Cliente' },
    configuration: { vehicle: { brand: 'Toyota', model: 'Hilux' } },
    quote: {
      number: `COT-${id}`,
      state: 'EMITIDA',
      validityDays: 30,
      issuedAt: new Date(now - issuedDaysAgo * day).toISOString()
    }
  });
  const tipos = computeNotices([lead('a', 10), lead('b', 27), lead('c', 40)], now).map(n => n.tipo);
  assert.deepEqual(tipos.sort(), ['por-vencer', 'vencida']);
});

test(
  'PostgreSQL: guarda y sobrevive a un reinicio (requiere TEST_DATABASE_URL)',
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const env = { NODE_ENV: 'development', DATABASE_URL: process.env.TEST_DATABASE_URL };
    const port = 3500 + Math.floor(Math.random() * 90);
    let { child } = await start({ ...env, PORT: String(port) });
    const r = await fetch(`http://localhost:${port}/api/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ customer, configuration: { vehicle: { id: 'l200-2024' } } })
    });
    const { lead } = await r.json();
    child.kill();
    await new Promise(res => setTimeout(res, 300));
    ({ child } = await start({ ...env, PORT: String(port) }));
    try {
      const t = (
        await (
          await fetch(`http://localhost:${port}/api/auth/login`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: 'comercial@kasac.pe', password: 'Kasac2026!' })
          })
        ).json()
      ).token;
      const rows = await (
        await fetch(`http://localhost:${port}/api/commercial/requests`, {
          headers: { authorization: `Bearer ${t}` }
        })
      ).json();
      assert.ok(rows.some(x => x.code === lead.code));
    } finally {
      child.kill();
    }
  }
);
