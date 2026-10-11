// Excel de la cotización: hoja "Cotización" (logo arriba a la izquierda, datos, detalle por sección,
// resumen, observaciones y condiciones), hoja "Detalle" en tabla plana para importar a otro sistema
// y hoja "Fotos" con cada lado del vehículo.
// Los importes son fórmulas: si Comercial cambia una cantidad o un precio en Excel, todo se recalcula.
import ExcelJS from 'exceljs';
import { empresa } from './empresa.js';
import { LOGO } from './pdf.js';
import { SECTIONS, CURRENCIES, totals, montoEnLetras } from './quotes.js';

const INK = 'FF232834',
  BLUE = 'FF1C85D1',
  MUTED = 'FF5E6675',
  SOFT = 'FFF2F6FA',
  TINT = 'FFE4F0FA',
  WHITE = 'FFFFFFFF';
const font = (extra = {}) => ({ name: 'Arial', size: 9, color: { argb: INK }, ...extra });
const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const line = { style: 'thin', color: { argb: 'FFD5DAE0' } };
// Fecha del día en Lima (sin hora), para que Excel muestre el mismo día que el PDF.
const date = iso => {
  const [d, m, y] = new Date(iso || Date.now())
    .toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Lima'
    })
    .split('/')
    .map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export async function buildQuoteXlsx(lead, photos = []) {
  const q = lead.quote;
  const cur = CURRENCIES[q.currency] || CURRENCIES.USD;
  const wb = new ExcelJS.Workbook();
  wb.creator = empresa.razonSocial;
  wb.created = new Date();
  const logoId = LOGO ? wb.addImage({ buffer: LOGO, extension: 'png' }) : null;

  // Hoja 1: Cotización
  const ws = wb.addWorksheet('Cotización', {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
    },
    views: [{ showGridLines: false }]
  });
  ws.columns = [5, 15, 44, 8, 8, 13, 9, 15].map(width => ({ width }));
  const set = (addr, value, f = {}, extra = {}) => {
    const c = ws.getCell(addr);
    c.value = value;
    c.font = font(f);
    Object.assign(c, extra);
    return c;
  };
  const merge = (range, value, f = {}, extra = {}) => {
    ws.mergeCells(range);
    return set(range.split(':')[0], value, f, extra);
  };
  const right = { alignment: { horizontal: 'right', vertical: 'middle' } };

  // Cabecera: logo (A1) y número de cotización (derecha).
  for (let i = 1; i <= 4; i++) ws.getRow(i).height = 21;
  if (logoId !== null) ws.addImage(logoId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 160, height: 88 } });
  else merge('A1:C2', 'KASAC', { size: 22, bold: true, color: { argb: BLUE } });
  merge('E1:H1', 'COTIZACIÓN', { size: 18, bold: true }, right);
  merge('E2:H2', q.number, { size: 12, bold: true, color: { argb: BLUE } }, right);
  merge('E3:G3', 'Emisión', { color: { argb: MUTED } }, right);
  set('H3', date(q.updatedAt), { bold: true }, { numFmt: 'dd/mm/yyyy', ...right });
  merge('E4:G4', 'Válida hasta', { color: { argb: MUTED } }, right);
  set('H4', { formula: `H3+${q.validityDays}` }, { bold: true }, { numFmt: 'dd/mm/yyyy', ...right });
  merge('E5:G5', 'Solicitud web', { color: { argb: MUTED } }, right);
  set('H5', lead.code || '', { bold: true }, right);
  merge('A5:D5', `${empresa.razonSocial} · RUC ${empresa.ruc}`, { size: 8, color: { argb: MUTED } });
  merge('A6:D6', `${empresa.direccion} · ${empresa.telefonos} · ${empresa.correo}`, {
    size: 8,
    color: { argb: MUTED }
  });

  let r = 7;
  if (empresa.modoPrueba) {
    merge(
      `A${r}:H${r}`,
      'DOCUMENTO DE PRUEBA · Datos del emisor ficticios · Sin valor comercial',
      { bold: true, size: 8.5, color: { argb: 'FFB45309' } },
      { alignment: { horizontal: 'center', vertical: 'middle' }, fill: fill('FFFEF3C7') }
    );
    ws.getRow(r).height = 18;
    r++;
  }
  for (const col of 'ABCDEFGH')
    ws.getCell(`${col}${r}`).border = { bottom: { style: 'medium', color: { argb: BLUE } } };
  r += 2;

  // Datos: cliente a la izquierda (B:C), unidad y servicio a la derecha (D:H).
  const client = [
    ['Cliente', q.customerName],
    ['RUC / DNI', q.customerDocument],
    ['Contacto', q.contact],
    ['Correo', lead.customer.email],
    ['Teléfono', lead.customer.phone],
    ['Dirección', q.address],
    ['Orden de compra', q.purchaseOrder],
    ['Forma de pago', q.paymentTerms]
  ];
  const unit = [
    ['Vehículo', [q.model, q.year].filter(Boolean).join(' · ')],
    ['Color', q.color],
    ['Placa', q.plate],
    ['Chasis', q.chassis],
    ['Servicio', q.serviceType],
    ['Motivo', q.motive],
    ['Operación', q.operation],
    ['Moneda', q.currency === 'PEN' ? 'Soles' : 'Dólares americanos']
  ];
  merge(`A${r}:C${r}`, 'CLIENTE', { bold: true, color: { argb: BLUE } });
  merge(`D${r}:H${r}`, 'UNIDAD Y SERVICIO', { bold: true, color: { argb: BLUE } });
  r++;
  for (let i = 0; i < client.length; i++, r++) {
    merge(`A${r}:B${r}`, client[i][0], { color: { argb: MUTED } }, { fill: fill(SOFT) });
    set(`C${r}`, client[i][1] || '-', {}, { numFmt: '@', fill: fill(SOFT) });
    merge(`D${r}:E${r}`, unit[i][0], { color: { argb: MUTED } }, { fill: fill(SOFT) });
    merge(`F${r}:H${r}`, unit[i][1] || '-', {}, { numFmt: '@', fill: fill(SOFT) });
  }
  r++;
  merge(`A${r}:H${r}`, empresa.introduccion, {}, { alignment: { wrapText: true, vertical: 'middle' } });
  ws.getRow(r).height = 26;
  r += 2;

  // Detalle por secciones.
  const head = ['N°', 'Código', 'Descripción', 'Vehíc.', 'Cant.', 'P. unit.', 'Dscto.', 'Importe'];
  head.forEach((h, i) => {
    const c = ws.getCell(r, i + 1);
    c.value = h;
    c.font = font({ bold: true, color: { argb: WHITE } });
    c.fill = fill(INK);
    c.alignment = { horizontal: i >= 3 ? 'right' : i === 0 ? 'center' : 'left', vertical: 'middle' };
  });
  ws.getRow(r).height = 18;
  r++;
  const subtotalCells = [];
  let n = 0;
  for (const s of SECTIONS) {
    const items = q.items.filter(i => i.section === s.id);
    if (!items.length) continue;
    merge(
      `A${r}:H${r}`,
      s.name,
      { bold: true },
      { fill: fill(TINT), border: { left: { style: 'thick', color: { argb: BLUE } } } }
    );
    ws.getRow(r).height = 16;
    r++;
    const first = r;
    for (const i of items) {
      set(`A${r}`, ++n, { color: { argb: MUTED } }, { alignment: { horizontal: 'center', vertical: 'top' } });
      set(`B${r}`, i.code || '', { color: { argb: MUTED } }, { numFmt: '@', alignment: { vertical: 'top' } });
      set(`C${r}`, i.description, {}, { alignment: { wrapText: true, vertical: 'top' } });
      set(`D${r}`, i.vehicles, {}, { numFmt: '#,##0', alignment: { vertical: 'top' } });
      set(`E${r}`, i.quantity, {}, { numFmt: '#,##0.##', alignment: { vertical: 'top' } });
      set(`F${r}`, i.unitPrice, {}, { numFmt: '#,##0.00', alignment: { vertical: 'top' } });
      set(
        `G${r}`,
        i.discount / 100,
        {},
        { numFmt: '0%;-0%;"-"', alignment: { horizontal: 'right', vertical: 'top' } }
      );
      set(
        `H${r}`,
        { formula: `ROUND(D${r}*E${r}*F${r}*(1-G${r}),2)` },
        { bold: true },
        { numFmt: '#,##0.00', alignment: { vertical: 'top' } }
      );
      for (const col of 'ABCDEFGH') ws.getCell(`${col}${r}`).border = { bottom: line };
      r++;
    }
    merge(`E${r}:G${r}`, `Subtotal ${s.name.toLowerCase()}`, { italic: true, color: { argb: MUTED } }, right);
    set(`H${r}`, { formula: `SUM(H${first}:H${r - 1})` }, { bold: true }, { numFmt: '#,##0.00' });
    subtotalCells.push(`H${r}`);
    r += 2;
  }

  // Resumen.
  const t = totals(q);
  const sub = r,
    igv = r + 1,
    tot = r + 2;
  merge(`A${sub}:C${sub}`, 'Son:', { color: { argb: MUTED } });
  merge(
    `A${igv}:C${tot}`,
    montoEnLetras(t.total, q.currency),
    { bold: true },
    { alignment: { wrapText: true, vertical: 'top' } }
  );
  ws.getCell(`A${igv}`).note =
    'Monto en letras calculado al generar el archivo: actualícelo si cambia el total.';
  merge(
    `E${sub}:G${sub}`,
    `Subtotal ${cur.symbol}`,
    { color: { argb: MUTED } },
    { ...right, fill: fill(SOFT) }
  );
  set(
    `H${sub}`,
    { formula: subtotalCells.length ? subtotalCells.join('+') : '0' },
    { bold: true },
    { numFmt: '#,##0.00', fill: fill(SOFT) }
  );
  merge(`E${igv}:F${igv}`, `IGV ${cur.symbol}`, { color: { argb: MUTED } }, { ...right, fill: fill(SOFT) });
  // Tasa de IGV en su propia celda: cámbiela aquí y el total se recalcula.
  set(`G${igv}`, q.igvRate, {}, { numFmt: '0%', ...right, fill: fill(SOFT) }).note =
    'Tasa de IGV (18 % en Perú). Cámbiela aquí si corresponde.';
  set(
    `H${igv}`,
    { formula: `ROUND(H${sub}*G${igv},2)` },
    { bold: true },
    { numFmt: '#,##0.00', fill: fill(SOFT) }
  );
  merge(
    `E${tot}:G${tot}`,
    `TOTAL ${cur.symbol}`,
    { bold: true, size: 11, color: { argb: WHITE } },
    { ...right, fill: fill(BLUE) }
  );
  set(
    `H${tot}`,
    { formula: `H${sub}+H${igv}` },
    { bold: true, size: 11, color: { argb: WHITE } },
    { numFmt: '#,##0.00', fill: fill(BLUE) }
  );
  ws.getRow(tot).height = 20;
  r = tot + 2;

  // Observaciones: una línea por punto.
  const obs = (q.observations || '')
    .split('\n')
    .map(l => l.trim().replace(/^[-–•·]\s*/, ''))
    .filter(Boolean);
  if (obs.length) {
    merge(
      `A${r}:H${r}`,
      'OBSERVACIONES',
      { bold: true, color: { argb: BLUE } },
      { border: { bottom: { style: 'thin', color: { argb: BLUE } } } }
    );
    r++;
    for (const l of obs) {
      merge(`A${r}:H${r}`, `•  ${l}`, {}, { alignment: { wrapText: true, vertical: 'top' } });
      ws.getRow(r).height = Math.max(15, Math.ceil(l.length / 110) * 13);
      r++;
    }
    r++;
  }
  const list = (title, lines) => {
    merge(`A${r}:H${r}`, title, { bold: true });
    r++;
    for (const l of lines) {
      merge(`A${r}:H${r}`, `–  ${l}`, { color: { argb: MUTED } }, { alignment: { wrapText: true } });
      r++;
    }
    r++;
  };
  list(
    'Condiciones de la propuesta',
    empresa.terminos.map(l => l.replace('{validez}', q.validityDays).replace('{entrega}', q.delivery))
  );
  list('Garantía', empresa.garantia);

  merge(`A${r}:H${r}`, 'Cuentas para el pago', { bold: true });
  r++;
  const bankHead = [
    ['A', 'B', 'Banco'],
    ['C', 'C', 'Tipo'],
    ['D', 'D', 'Moneda'],
    ['E', 'F', 'N° de cuenta'],
    ['G', 'H', 'CCI']
  ];
  const bankRow = (values, f) => {
    bankHead.forEach(([a, b], i) => {
      if (a !== b) ws.mergeCells(`${a}${r}:${b}${r}`);
      const c = set(`${a}${r}`, values[i], f, { numFmt: '@' });
      c.border = { bottom: line };
    });
    r++;
  };
  bankRow(
    bankHead.map(h => h[2]),
    { color: { argb: MUTED } }
  );
  for (const c of empresa.cuentas) bankRow([c.banco, c.tipo, c.moneda, c.numero, c.cci], {});
  r++;
  merge(`A${r}:H${r}`, empresa.cierre, { color: { argb: MUTED } });
  r += 4;
  merge(
    `F${r}:H${r}`,
    'Área Comercial',
    { bold: true },
    { alignment: { horizontal: 'center' }, border: { top: { style: 'thin', color: { argb: INK } } } }
  );
  merge(
    `F${r + 1}:H${r + 1}`,
    empresa.razonSocial,
    { size: 8, color: { argb: MUTED } },
    { alignment: { horizontal: 'center' } }
  );
  ws.headerFooter.oddFooter = `&L&8${empresa.razonSocial}${empresa.modoPrueba ? ' · documento de prueba' : ''}&R&8${q.number} · &P / &N`;

  // Hoja 2: Detalle (tabla plana para importar)
  const wd = wb.addWorksheet('Detalle', { views: [{ state: 'frozen', ySplit: 1 }] });
  wd.columns = [
    { header: 'N° COTIZACIÓN', key: 'n', width: 16 },
    { header: 'SOLICITUD', key: 'sol', width: 16 },
    { header: 'SECCIÓN', key: 's', width: 20 },
    { header: 'CÓDIGO', key: 'c', width: 16 },
    { header: 'DESCRIPCIÓN', key: 'd', width: 48 },
    { header: 'CANT. VEHÍC.', key: 'v', width: 12 },
    { header: 'CANTIDAD', key: 'q', width: 10 },
    { header: 'PRECIO UNIT.', key: 'p', width: 13 },
    { header: 'DSCTO %', key: 'x', width: 9 },
    { header: 'TOTAL', key: 't', width: 13 },
    { header: 'MONEDA', key: 'm', width: 9 }
  ];
  wd.getRow(1).eachCell(c => {
    c.font = font({ bold: true, color: { argb: WHITE } });
    c.fill = fill(BLUE);
  });
  for (const s of SECTIONS)
    for (const i of q.items.filter(x => x.section === s.id)) {
      const row = wd.addRow({
        n: q.number,
        sol: lead.code,
        s: s.name,
        c: i.code,
        d: i.description,
        v: i.vehicles,
        q: i.quantity,
        p: i.unitPrice,
        x: i.discount / 100,
        m: q.currency
      });
      const rn = row.number;
      row.getCell('t').value = { formula: `ROUND(F${rn}*G${rn}*H${rn}*(1-I${rn}),2)` };
      row.eachCell(c => {
        c.font = font();
      });
      row.getCell('p').numFmt = '#,##0.00';
      row.getCell('t').numFmt = '#,##0.00';
      row.getCell('x').numFmt = '0%';
    }
  wd.autoFilter = { from: 'A1', to: 'K1' };

  // Hoja 3: Fotos
  if (photos.length) {
    const wf = wb.addWorksheet('Fotos', { views: [{ showGridLines: false }] });
    wf.columns = [{ width: 2 }, ...Array(12).fill({ width: 9 })];
    wf.getRow(1).height = 30;
    wf.getCell('B1').value =
      `Vistas de la configuración · ${q.model}${q.color ? ' · ' + q.color : ''} · ${q.number}`;
    wf.getCell('B1').font = font({ size: 12, bold: true });
    wf.getCell('B1').alignment = { vertical: 'middle' };
    photos.forEach((p, i) => {
      const col = 1 + (i % 2) * 6,
        row = 3 + Math.floor(i / 2) * 18;
      wf.getCell(row - 1, col + 1).value = p.name;
      wf.getCell(row - 1, col + 1).font = font({ bold: true });
      const id = wb.addImage({ buffer: p.buffer, extension: 'jpeg' });
      wf.addImage(id, { tl: { col, row }, ext: { width: 400, height: 250 } });
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
