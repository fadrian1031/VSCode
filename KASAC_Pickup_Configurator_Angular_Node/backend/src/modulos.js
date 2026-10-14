// Rutas de los módulos del Área Comercial que no son la bandeja de solicitudes:
// clientes, indicadores, registro histórico (pre-prueba), avisos y usuarios.
import express from 'express';
import { tesis } from './tesis.js';
import { listCustomers, customerKey } from './clientes.js';
import { computeNotices } from './avisos.js';
import { parseHistory, historyTemplate } from './historico.js';
import {
  recordsFromLeads,
  recordsFromHistory,
  inPeriod,
  calculate,
  monthly,
  buildFichas
} from './indicadores.js';
import { publicUser } from './usuarios.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

function sendXlsx(res, name, buf) {
  res
    .set({
      'Content-Type': XLSX,
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store'
    })
    .send(buf);
}

export function registerModules(app, { storage, store, users, auth, adminOnly, safe, normalize }) {
  const history = storage.collection('historico');
  const dismissed = storage.collection('avisos-descartados');
  const leads = async () => (await store.all()).map(normalize);

  // Clientes
  app.get('/api/commercial/clientes', auth, async (req, res) => res.json(listCustomers(await leads())));
  app.get('/api/commercial/clientes/:key', auth, async (req, res) => {
    const all = await leads();
    const customer = listCustomers(all).find(c => c.key === req.params.key);
    if (!customer) return res.status(404).json({ message: 'Cliente no encontrado.' });
    const requests = all
      .filter(l => customerKey(l.customer) === req.params.key)
      .map(l => ({
        id: l.id,
        code: l.code,
        status: l.status,
        createdAt: l.createdAt,
        vehicle: `${l.configuration.vehicle.brand} ${l.configuration.vehicle.model}`,
        accessories: l.configuration.accessories.length,
        quote: l.quote
          ? {
              number: l.quote.number,
              state: recordsFromLeads([l])[0].estado,
              issuedAt: l.quote.issuedAt || null,
              approvedAt: l.quote.approvedAt || null
            }
          : null
      }));
    res.json({ ...customer, requests });
  });

  // Indicadores (pre-prueba = histórico importado; post-prueba = cotizaciones del sistema)
  const indicatorData = async q => {
    const desde = isDay(q.desde) ? q.desde : '';
    const hasta = isDay(q.hasta) ? q.hasta : '';
    const post = inPeriod(recordsFromLeads(await leads()), desde, hasta);
    const pre = recordsFromHistory(await history.all());
    return { desde, hasta, pre, post };
  };
  app.get('/api/commercial/indicadores', auth, async (req, res) => {
    const { desde, hasta, pre, post } = await indicatorData(req.query);
    res.json({
      periodo: { desde, hasta },
      indicadores: tesis.indicadores,
      pre: {
        ...calculate(pre),
        desde: pre.map(r => r.fechaEmision).sort()[0] || null,
        hasta:
          pre
            .map(r => r.fechaEmision)
            .sort()
            .at(-1) || null
      },
      post: calculate(post),
      evolucion: monthly(post),
      generadoEn: new Date().toISOString()
    });
  });
  app.get('/api/commercial/indicadores/fichas.xlsx', auth, async (req, res) => {
    const { desde, hasta, pre, post } = await indicatorData(req.query);
    const fuente = req.query.fuente === 'pre' ? 'historico' : 'sistema';
    const records = fuente === 'historico' ? pre : post;
    const first = records.map(r => r.fechaRegistro).sort()[0];
    const last = records
      .map(r => r.fechaRegistro)
      .sort()
      .at(-1);
    const buf = await buildFichas(records, {
      fuente,
      desde: fuente === 'historico' ? first?.slice(0, 10) : desde || first?.slice(0, 10),
      hasta: fuente === 'historico' ? last?.slice(0, 10) : hasta || last?.slice(0, 10)
    });
    sendXlsx(res, `fichas-observacion-${fuente === 'historico' ? 'pretest' : 'postest'}.xlsx`, buf);
  });

  // Registro histórico (pre-prueba)
  app.get('/api/commercial/historico', auth, async (req, res) => {
    const rows = (await history.all()).sort((a, b) => (a.fechaEmision < b.fechaEmision ? -1 : 1));
    res.json({ rows, resumen: calculate(recordsFromHistory(rows)) });
  });
  app.get('/api/commercial/historico/plantilla.xlsx', auth, async (req, res) =>
    sendXlsx(res, 'plantilla-historico-cotizaciones.xlsx', await historyTemplate())
  );
  app.post(
    '/api/commercial/historico',
    auth,
    express.raw({ type: () => true, limit: '5mb' }),
    async (req, res) => {
      if (!req.body?.length) return res.status(400).json({ message: 'Adjunte el archivo Excel.' });
      const { rows, errors } = await parseHistory(req.body);
      if (!rows.length)
        return res
          .status(400)
          .json({ message: errors[0]?.motivo || 'El archivo no tiene filas válidas.', errors });
      const by = req.user.name;
      const result = await history.update(list => {
        let added = 0,
          updated = 0;
        for (const r of rows) {
          const i = list.findIndex(x => x.id === r.id);
          const rec = { ...r, importadoPor: by, importadoEn: new Date().toISOString() };
          if (i >= 0) {
            list[i] = rec;
            updated++;
          } else {
            list.push(rec);
            added++;
          }
        }
        return { added, updated, total: list.length };
      });
      res.json({ ...result, errors });
    }
  );
  app.delete('/api/commercial/historico', auth, adminOnly, async (req, res) => {
    const removed = await history.update(list => list.splice(0, list.length).length);
    res.json({ removed });
  });

  // Avisos
  const noticesFor = async userId => {
    const gone = new Set((await dismissed.all()).filter(d => d.userId === userId).map(d => d.key));
    return computeNotices(await leads()).map(n => ({ ...n, descartado: gone.has(n.key) }));
  };
  app.get('/api/commercial/avisos', auth, async (req, res) => res.json(await noticesFor(req.user.id)));
  app.post('/api/commercial/avisos/descartar', auth, async (req, res) => {
    const keys = (Array.isArray(req.body?.keys) ? req.body.keys : [])
      .map(k => safe(k))
      .filter(Boolean)
      .slice(0, 500);
    await dismissed.update(list => {
      for (const key of keys) {
        const id = `${req.user.id}|${key}`;
        if (!list.some(d => d.id === id))
          list.push({ id, userId: req.user.id, key, at: new Date().toISOString() });
      }
    });
    res.json(await noticesFor(req.user.id));
  });

  // Usuarios y roles
  app.get('/api/commercial/usuarios', auth, adminOnly, async (req, res) =>
    res.json((await users.all()).map(publicUser))
  );
  app.post('/api/commercial/usuarios', auth, adminOnly, async (req, res) => {
    const { user, error } = await users.create(req.body);
    if (error) return res.status(400).json({ message: error });
    res.status(201).json(publicUser(user));
  });
  app.patch('/api/commercial/usuarios/:id', auth, adminOnly, async (req, res) => {
    const { user, error, status } = await users.update(req.params.id, req.body);
    if (error) return res.status(status || 400).json({ message: error });
    res.json(publicUser(user));
  });
}
