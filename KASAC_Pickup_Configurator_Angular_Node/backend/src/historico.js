// Módulo de registro histórico (pre-prueba): importa desde Excel las cotizaciones que la empresa
// emitió antes del sistema, para que los indicadores de la pre-prueba también los calcule el sistema.
//
// Columnas que se reconocen (el orden no importa; mayúsculas y tildes tampoco):
//   N° cotización | Cliente | Fecha de emisión | Estado | Fecha de aprobación | Observación
// Estado: Aprobada, Rechazada o Pendiente (también acepta aprobado, aceptada, rechazado, en espera, etc.).
import ExcelJS from 'exceljs';

const plain = s =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const COLUMNS = {
  numero: [
    'n cotizacion',
    'no cotizacion',
    'nro cotizacion',
    'numero',
    'numero de cotizacion',
    'cotizacion',
    'n'
  ],
  cliente: ['cliente', 'razon social', 'empresa'],
  fechaEmision: ['fecha de emision', 'fecha emision', 'emision', 'fe'],
  estado: ['estado', 'estado registrado', 'resultado'],
  fechaAprobacion: ['fecha de aprobacion', 'fecha aprobacion', 'aprobacion', 'fa', 'fecha de respuesta'],
  observacion: ['observacion', 'observaciones', 'comentario']
};

function toState(v) {
  const s = plain(v);
  if (/^(aprob|acept|ganad)/.test(s)) return 'APROBADA';
  if (/^(rechaz|perdid|no aprob|denegad)/.test(s)) return 'RECHAZADA';
  if (/^(pendient|en espera|emitid|enviad|en proceso|por aprobar)/.test(s)) return 'PENDIENTE';
  return null;
}

/** Fecha desde una celda de Excel: objeto Date, número de serie o texto dd/mm/aaaa o aaaa-mm-dd. */
function toDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString();
  if (typeof v === 'object' && v.result !== undefined) return toDate(v.result);
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 864e5)).toISOString();
  const s = String(v).trim();
  let m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).toISOString();
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString();
  return undefined; // texto que no es fecha
}

const cellText = v => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map(t => t.text).join('');
  if (typeof v === 'object' && v.text) return v.text;
  if (typeof v === 'object' && v.result !== undefined) return String(v.result);
  return String(v).trim();
};

/** Lee el Excel y devuelve { rows, errors }. Cada fila válida queda lista para guardarse. */
export async function parseHistory(buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { rows: [], errors: [{ fila: 0, motivo: 'El archivo no es un Excel válido (.xlsx).' }] };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], errors: [{ fila: 0, motivo: 'El archivo no tiene hojas.' }] };

  // Busca la fila de encabezados en las primeras 10 filas.
  let headerRow = 0;
  const map = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount) && !headerRow; r++) {
    const found = {};
    ws.getRow(r).eachCell((c, col) => {
      const h = plain(cellText(c.value));
      for (const [key, names] of Object.entries(COLUMNS))
        if (names.includes(h) && !found[key]) found[key] = col;
    });
    if (found.numero && found.estado && found.fechaEmision) {
      headerRow = r;
      Object.assign(map, found);
    }
  }
  if (!headerRow)
    return {
      rows: [],
      errors: [
        { fila: 0, motivo: 'No se encontraron las columnas "N° cotización", "Fecha de emisión" y "Estado".' }
      ]
    };

  const rows = [],
    errors = [],
    seen = new Set();
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = key => (map[key] ? row.getCell(map[key]).value : null);
    const numero = cellText(get('numero'));
    if (!numero && !cellText(get('estado'))) continue; // fila vacía
    const estado = toState(cellText(get('estado')));
    const fechaEmision = toDate(get('fechaEmision'));
    const fechaAprobacion = toDate(get('fechaAprobacion'));
    let motivo = '';
    if (!numero) motivo = 'Falta el número de cotización.';
    else if (seen.has(numero)) motivo = `El número ${numero} está repetido en el archivo.`;
    else if (!estado) motivo = `Estado no reconocido: "${cellText(get('estado'))}".`;
    else if (!fechaEmision) motivo = 'Falta o no se entiende la fecha de emisión.';
    else if (fechaAprobacion === undefined) motivo = 'La fecha de aprobación no es una fecha.';
    if (motivo) {
      errors.push({ fila: r, motivo });
      continue;
    }
    seen.add(numero);
    rows.push({
      id: numero,
      numero,
      cliente: cellText(get('cliente')).slice(0, 200),
      estado,
      fechaEmision,
      fechaAprobacion: estado === 'APROBADA' ? fechaAprobacion || null : null,
      observacion: cellText(get('observacion')).slice(0, 300)
    });
  }
  return { rows, errors };
}

/** Plantilla vacía para que la empresa llene su registro histórico. */
export async function historyTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Histórico');
  ws.columns = [
    { header: 'N° cotización', width: 18 },
    { header: 'Cliente', width: 34 },
    { header: 'Fecha de emisión', width: 18 },
    { header: 'Estado', width: 14 },
    { header: 'Fecha de aprobación', width: 20 },
    { header: 'Observación', width: 40 }
  ];
  ws.getRow(1).eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF232834' } };
  });
  for (let r = 2; r <= 400; r++) {
    ws.getCell(r, 3).numFmt = 'dd/mm/yyyy';
    ws.getCell(r, 5).numFmt = 'dd/mm/yyyy';
    ws.getCell(r, 4).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Aprobada,Rechazada,Pendiente"']
    };
  }
  const help = wb.addWorksheet('Instrucciones');
  help.columns = [{ width: 110 }];
  [
    'Cómo llenar el registro histórico (pre-prueba)',
    '',
    '1. Una fila por cotización emitida antes de usar el sistema web.',
    '2. N° cotización: el número que figura en el ERP. No se puede repetir.',
    '3. Fecha de emisión (FE): la fecha de la cotización en el ERP (dd/mm/aaaa).',
    '4. Estado: Aprobada, Rechazada o Pendiente.',
    '5. Fecha de aprobación (FA): solo para las aprobadas; tomarla del correo en que el cliente confirmó.',
    '   Si no se encuentra, dejarla vacía: la cotización cuenta como aprobada, pero no entra al tiempo promedio.',
    '6. Observación: opcional (por ejemplo, el motivo del rechazo o de dónde se tomó la fecha).'
  ].forEach((t, i) => {
    help.getCell(i + 1, 1).value = t;
    if (i === 0) help.getCell(1, 1).font = { bold: true, size: 13 };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
