// Módulo de indicadores: calcula PCA, PCR, PCP y TPA a partir de las cotizaciones registradas
// y arma las fichas de observación (Anexos 3 a 6 de la tesis) en Excel.
//
// Fuentes de datos:
//   - "sistema":   cotizaciones hechas con el sistema web (post-prueba).
//   - "historico": cotizaciones anteriores importadas desde el registro de la empresa (pre-prueba).
import ExcelJS from 'exceljs';
import { tesis } from './tesis.js';
import { quoteState, expiresAt, daysBetween } from './quotes.js';

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const day = iso => (iso ? iso.slice(0, 10) : '');

/**
 * Convierte las solicitudes con cotización en registros para los indicadores.
 * TC = todas las cotizaciones registradas (también los borradores); las que no están aprobadas
 * ni rechazadas cuentan como pendientes por aprobar.
 */
export function recordsFromLeads(leads, now = Date.now()) {
  return leads
    .filter(l => l.quote)
    .map(l => {
      const q = l.quote;
      const state = quoteState(q);
      const vence = expiresAt(q);
      const vencida = state === 'EMITIDA' && vence && Date.parse(vence) < now;
      let observacion = '';
      if (state === 'BORRADOR') observacion = 'Borrador, aún no emitida';
      else if (state === 'RECHAZADA')
        observacion = q.rejectionReason ? `Motivo: ${q.rejectionReason}` : 'Rechazada';
      else if (vencida) observacion = 'Vencida sin respuesta del cliente';
      else if (state === 'APROBADA' && !q.issuedAt) observacion = 'Sin fecha de emisión registrada';
      return {
        numero: q.number || l.code,
        cliente: l.customer.type === 'corporate' ? l.customer.companyName : l.customer.fullName,
        estado: state === 'APROBADA' ? 'APROBADA' : state === 'RECHAZADA' ? 'RECHAZADA' : 'PENDIENTE',
        fechaRegistro: q.createdAt || l.createdAt,
        fechaEmision: q.issuedAt || null,
        fechaAprobacion: state === 'APROBADA' ? q.approvedAt || null : null,
        observacion,
        origen: 'sistema'
      };
    });
}

/** Registros importados del histórico (ya vienen normalizados por historico.js). */
export function recordsFromHistory(rows) {
  return rows.map(r => ({ ...r, fechaRegistro: r.fechaEmision, origen: 'historico' }));
}

/** Filtra por fecha de registro, ambos extremos incluidos (YYYY-MM-DD). */
export function inPeriod(records, desde, hasta) {
  return records.filter(r => {
    const d = day(r.fechaRegistro);
    return (!desde || d >= desde) && (!hasta || d <= hasta);
  });
}

/** Una cotización aprobada entra al TPA solo si tiene FE y FA, y FA no es anterior a FE. */
const validForTpa = r =>
  r.estado === 'APROBADA' &&
  r.fechaEmision &&
  r.fechaAprobacion &&
  Date.parse(r.fechaAprobacion) >= Date.parse(r.fechaEmision);

/** Cálculo de los cuatro indicadores de la matriz de operacionalización. */
export function calculate(records) {
  const tc = records.length;
  const nca = records.filter(r => r.estado === 'APROBADA').length;
  const ncr = records.filter(r => r.estado === 'RECHAZADA').length;
  const ncp = tc - nca - ncr;
  const valid = records.filter(validForTpa);
  const sumDays = valid.reduce((a, r) => a + daysBetween(r.fechaEmision, r.fechaAprobacion), 0);
  const pct = n => (tc ? round2((n / tc) * 100) : null);
  return {
    tc,
    nca,
    ncr,
    ncp,
    pca: pct(nca),
    pcr: pct(ncr),
    pcp: pct(ncp),
    tpa: valid.length ? round2(sumDays / valid.length) : null,
    nTpa: valid.length,
    sinFechaValida: nca - valid.length
  };
}

/** Indicadores mes a mes (para el gráfico de evolución). */
export function monthly(records) {
  const byMonth = new Map();
  for (const r of records) {
    const m = day(r.fechaRegistro).slice(0, 7);
    if (!m) continue;
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(r);
  }
  return [...byMonth.keys()].sort().map(mes => ({ mes, ...calculate(byMonth.get(mes)) }));
}

// Fichas de observación (Excel)

const thin = { style: 'thin', color: { argb: 'FF9AA0A8' } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const fmtDate = iso => (iso ? new Date(iso) : null);
// Al imprimir, cada ficha entra en una hoja A4 de ancho.
const PRINT = {
  paperSize: 9,
  orientation: 'portrait',
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
  margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
};

function headerBlock(ws, { tipo, desde, hasta, indicador, resultado, fuente }) {
  ws.columns = [{ width: 18 }, { width: 34 }, { width: 22 }, { width: 22 }, { width: 18 }, { width: 38 }];
  const rows = [
    ['Autor', tesis.autores.join('\n'), 'Tipo de prueba', tipo],
    [
      'Descripción',
      fuente === 'historico'
        ? 'Registro de cotizaciones de equipamiento vehicular antes de la implementación del sistema web con visualización 3D.'
        : 'Registro de cotizaciones de equipamiento vehicular gestionadas con el sistema web con visualización 3D.',
      'Fecha inicio',
      desde || '—'
    ],
    ['Variable', tesis.variable, 'Fecha fin', hasta || '—'],
    ['Indicador', indicador.nombre, 'Medida', indicador.unidad === '%' ? 'Porcentaje' : 'Días'],
    ['Fórmula', indicador.formula, 'Resultado / Meta', resultado],
    [
      'Definiciones',
      indicador.definiciones,
      'Observación',
      fuente === 'historico'
        ? 'Resultado obtenido del registro histórico de la empresa'
        : 'Resultado calculado por el sistema web a partir de su base de datos'
    ]
  ];
  rows.forEach((values, i) => {
    const row = ws.getRow(i + 1);
    row.values = values;
    row.height = i === 0 || i === 1 || i === 5 ? 34 : 20;
    row.eachCell(c => {
      c.border = box;
      c.alignment = { vertical: 'middle', wrapText: true };
      c.font = { name: 'Arial', size: 9 };
    });
    [1, 3].forEach(col => {
      ws.getCell(i + 1, col).font = { name: 'Arial', size: 9, bold: true };
      ws.getCell(i + 1, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4F0FA' } };
    });
  });
  return rows.length + 2;
}

function tableHead(ws, r, titles) {
  const row = ws.getRow(r);
  row.values = titles;
  row.eachCell(c => {
    c.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF232834' } };
    c.border = box;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
}

const cellStyle = c => {
  c.border = box;
  c.font = { name: 'Arial', size: 9 };
  c.alignment = { vertical: 'top', wrapText: true };
};

/** Ficha de un indicador porcentual: una fila por cotización con valor 1/0 y el resultado con fórmula de Excel. */
function percentSheet(wb, indicador, records, ctx, condition) {
  const ws = wb.addWorksheet(indicador.sigla, { pageSetup: PRINT });
  const value = calculate(records)[indicador.id];
  let r = headerBlock(ws, {
    ...ctx,
    indicador,
    resultado: `${value ?? '—'} % / meta ${indicador.meta} %`
  });
  tableHead(ws, r, [
    'Ítem',
    'N.º cotización',
    'Estado registrado',
    'Valor (1/0)',
    'Fecha de registro',
    'Observación'
  ]);
  const first = r + 1;
  records.forEach((rec, i) => {
    const row = ws.getRow(first + i);
    row.values = [
      i + 1,
      rec.numero,
      rec.estado.toLowerCase(),
      condition(rec) ? 1 : 0,
      fmtDate(rec.fechaRegistro),
      rec.observacion
    ];
    row.eachCell({ includeEmpty: true }, cellStyle);
    row.getCell(5).numFmt = 'dd/mm/yyyy';
  });
  const last = first + records.length - 1;
  r = last + 2;
  ws.getCell(r, 3).value = `Total (${indicador.sigla.replace('P', 'N')})`;
  ws.getCell(r, 4).value = records.length ? { formula: `SUM(D${first}:D${last})` } : 0;
  ws.getCell(r + 1, 3).value = 'TC';
  ws.getCell(r + 1, 4).value = records.length;
  ws.getCell(r + 2, 3).value = `${indicador.sigla} (%)`;
  ws.getCell(r + 2, 4).value = records.length ? { formula: `ROUND(D${r}/D${r + 1}*100,2)` } : null;
  for (let k = 0; k < 3; k++) {
    ws.getCell(r + k, 3).font = { name: 'Arial', size: 9, bold: true };
    ws.getCell(r + k, 4).font = { name: 'Arial', size: 9, bold: true };
  }
  ws.getCell(r + 4, 1).value =
    'Criterio de codificación: 1 = cumple la condición del indicador; 0 = no la cumple.';
  ws.getCell(r + 4, 1).font = { name: 'Arial', size: 9, italic: true };
}

/** Ficha del TPA: solo cotizaciones aprobadas, con FE, FA y días; el promedio se calcula con fórmula de Excel. */
function tpaSheet(wb, indicador, records, ctx) {
  const ws = wb.addWorksheet(indicador.sigla, { pageSetup: PRINT });
  const res = calculate(records);
  let r = headerBlock(ws, {
    ...ctx,
    indicador,
    resultado: `${res.tpa ?? '—'} días / meta ${indicador.meta} días`
  });
  tableHead(ws, r, [
    'Ítem',
    'N.º cotización',
    'Fecha de emisión (FE)',
    'Fecha de aprobación (FA)',
    'Días (FA − FE)',
    'Observación'
  ]);
  const approved = records.filter(x => x.estado === 'APROBADA');
  const first = r + 1;
  approved.forEach((rec, i) => {
    const row = ws.getRow(first + i);
    const valid = validForTpa(rec);
    row.values = [
      i + 1,
      rec.numero,
      fmtDate(rec.fechaEmision),
      fmtDate(rec.fechaAprobacion),
      valid ? daysBetween(rec.fechaEmision, rec.fechaAprobacion) : null,
      valid ? rec.observacion : 'Sin fecha válida: no entra al promedio'
    ];
    row.eachCell({ includeEmpty: true }, cellStyle);
    row.getCell(3).numFmt = 'dd/mm/yyyy';
    row.getCell(4).numFmt = 'dd/mm/yyyy';
  });
  const last = first + approved.length - 1;
  r = last + 2;
  ws.getCell(r, 4).value = 'n (con fecha válida)';
  ws.getCell(r, 5).value = approved.length ? { formula: `COUNT(E${first}:E${last})` } : 0;
  ws.getCell(r + 1, 4).value = 'TPA (días)';
  ws.getCell(r + 1, 5).value = approved.length
    ? { formula: `IF(E${r}=0,"",ROUND(AVERAGE(E${first}:E${last}),2))` }
    : null;
  for (let k = 0; k < 2; k++) {
    ws.getCell(r + k, 4).font = { name: 'Arial', size: 9, bold: true };
    ws.getCell(r + k, 5).font = { name: 'Arial', size: 9, bold: true };
  }
}

/** Libro con un resumen y una ficha por indicador. fuente: "historico" (pretest) o "sistema" (postest). */
export async function buildFichas(records, { fuente, desde, hasta }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = tesis.autores.join(' / ');
  const tipo = fuente === 'historico' ? 'Pretest' : 'Postest';
  const ctx = { tipo, desde, hasta, fuente };
  const res = calculate(records);

  const ws = wb.addWorksheet('Resumen', { pageSetup: PRINT });
  ws.columns = [{ width: 46 }, { width: 14 }, { width: 14 }, { width: 50 }];
  ws.getCell('A1').value = `Fichas de observación · ${tipo}`;
  ws.getCell('A1').font = { name: 'Arial', size: 13, bold: true };
  ws.getCell('A2').value = tesis.titulo;
  ws.getCell('A2').font = { name: 'Arial', size: 9, italic: true };
  ws.getCell('A3').value =
    `Período: ${desde || 'inicio'} a ${hasta || 'hoy'} · Cotizaciones observadas (TC): ${res.tc}`;
  ws.getCell('A3').font = { name: 'Arial', size: 9 };
  tableHead(ws, 5, ['Indicador', 'Resultado', 'Meta', 'Fórmula']);
  tesis.indicadores.forEach((ind, i) => {
    const row = ws.getRow(6 + i);
    row.values = [ind.nombre, res[ind.id], ind.meta, ind.formula];
    row.eachCell(cellStyle);
    row.getCell(2).numFmt = ind.unidad === '%' ? '0.00" %"' : '0.00" días"';
    row.getCell(3).numFmt = ind.unidad === '%' ? '0" %"' : '0" días"';
  });

  const [pca, pcr, pcp, tpa] = tesis.indicadores;
  percentSheet(wb, pca, records, ctx, r => r.estado === 'APROBADA');
  percentSheet(wb, pcr, records, ctx, r => r.estado === 'RECHAZADA');
  percentSheet(wb, pcp, records, ctx, r => r.estado === 'PENDIENTE');
  tpaSheet(wb, tpa, records, ctx);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
