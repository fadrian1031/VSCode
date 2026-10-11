// PDF de la cotización (A4) para enviar al cliente: cabecera con logo, datos del cliente y de la unidad,
// detalle por sección, resumen, observaciones, condiciones, cuentas y un anexo con las fotos del modelo 3D.
// Diseño propio del configurador; los datos del emisor vienen de empresa.js (de prueba por ahora).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { empresa } from './empresa.js';
import { CURRENCIES, lineTotal, totals, montoEnLetras } from './quotes.js';

const INK = '#232834',
  BLUE = '#1C85D1',
  MUTED = '#5E6675',
  LINE = '#D5DAE0',
  SOFT = '#F2F6FA',
  TINT = '#E4F0FA',
  WARN = '#B45309';
const M = 40,
  W = 595.28 - M * 2; // márgenes y ancho útil (A4 en puntos)
const money = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = n => (Number.isInteger(n) ? String(n) : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));
const date = iso =>
  new Date(iso || Date.now()).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Lima'
  });
const addDays = (iso, d) => new Date(new Date(iso || Date.now()).getTime() + d * 864e5).toISOString();

export const LOGO = (() => {
  try {
    return fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/logo-kasac.png')
    );
  } catch {
    return null;
  }
})();

// Columnas: ítem, descripción, código, vehículos, cantidad, precio, dscto, importe.
const COLS = [
  { key: 'n', title: 'N°', w: 22, align: 'center' },
  { key: 'description', title: 'Descripción', w: 196, align: 'left' },
  { key: 'code', title: 'Código', w: 70, align: 'left' },
  { key: 'vehicles', title: 'Vehíc.', w: 34, align: 'right' },
  { key: 'quantity', title: 'Cant.', w: 34, align: 'right' },
  { key: 'unitPrice', title: 'P. unit.', w: 56, align: 'right' },
  { key: 'discount', title: 'Dscto.', w: 37, align: 'right' },
  { key: 'total', title: 'Importe', w: 66, align: 'right' }
];

export function buildQuotePdf(lead, photos = []) {
  const q = lead.quote;
  const cur = CURRENCIES[q.currency] || CURRENCIES.USD;
  const t = totals(q);
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: M, bottom: 50, left: M, right: M },
    bufferPages: true,
    info: { Title: `Cotización ${q.number}`, Author: empresa.razonSocial }
  });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise(r => doc.on('end', () => r(Buffer.concat(chunks))));
  const bottom = () => doc.page.height - 60;

  // Cabecera: logo + emisor a la izquierda, número de cotización a la derecha
  if (LOGO) doc.image(LOGO, M, M - 4, { height: 52 });
  else doc.font('Helvetica-Bold').fontSize(26).fillColor(BLUE).text('KASAC', M, M);
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text(`${empresa.razonSocial} · RUC ${empresa.ruc}`, M, M + 54, { width: 300 })
    .text(empresa.direccion, { width: 300 })
    .text(`${empresa.telefonos} · ${empresa.correo}`, { width: 300 });

  const bx = M + W - 200;
  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor(INK)
    .text('Cotización', bx, M - 2, { width: 200, align: 'right' });
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(BLUE)
    .text(q.number, bx, M + 25, { width: 200, align: 'right' });
  const meta = [
    ['Emisión', date(q.updatedAt)],
    ['Válida hasta', date(addDays(q.updatedAt, q.validityDays))],
    ['Solicitud web', lead.code]
  ];
  let my = M + 44;
  for (const [k, v] of meta) {
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(k, bx, my, { width: 110, align: 'right' });
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(INK)
      .text(v || '-', bx + 115, my, { width: 85, align: 'right' });
    my += 11;
  }
  let y = M + 92;
  if (empresa.modoPrueba) {
    doc.rect(M, y, W, 16).fill('#FEF3C7');
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(WARN)
      .text('DOCUMENTO DE PRUEBA · Datos del emisor ficticios · Sin valor comercial', M, y + 4.5, {
        width: W,
        align: 'center',
        characterSpacing: 0.3
      });
    y += 22;
  }
  doc.rect(M, y, W, 3).fill(BLUE);
  y += 12;

  // Tarjetas: cliente y unidad / servicio
  const gap = 12,
    cw = (W - gap) / 2;
  const card = (title, rows, x, y0) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(BLUE)
      .text(title.toUpperCase(), x + 10, y0 + 8, { characterSpacing: 0.6 });
    let yy = y0 + 22;
    for (const [k, v] of rows) {
      doc
        .font('Helvetica')
        .fontSize(7.3)
        .fillColor(MUTED)
        .text(k, x + 10, yy, { width: 74 });
      doc.font('Helvetica').fontSize(8).fillColor(INK);
      const h = doc.heightOfString(v, { width: cw - 94 });
      doc.text(v, x + 86, yy - 0.5, { width: cw - 94 });
      yy += Math.max(11.5, h + 2.5);
    }
  };
  const filled = rows => rows.filter(([, v]) => v);
  const client = filled([
    ['Cliente', q.customerName],
    ['RUC / DNI', q.customerDocument],
    ['Contacto', q.contact],
    ['Correo', lead.customer.email],
    ['Teléfono', lead.customer.phone],
    ['Dirección', q.address],
    ['Orden de compra', q.purchaseOrder]
  ]);
  const unit = filled([
    ['Vehículo', [q.model, q.year].filter(Boolean).join(' · ')],
    ['Color', q.color],
    ['Placa', q.plate],
    ['Chasis', q.chassis],
    ['Servicio', q.serviceType],
    ['Motivo', q.motive],
    ['Operación', q.operation],
    ['Forma de pago', q.paymentTerms]
  ]);
  // Se mide antes de dibujar para que ambas tarjetas tengan el mismo alto.
  const measure = rows =>
    rows.reduce(
      (a, [, v]) =>
        a +
        Math.max(
          11.5,
          doc
            .font('Helvetica')
            .fontSize(8)
            .heightOfString(v, { width: cw - 94 }) + 2.5
        ),
      30
    );
  const ch = Math.max(measure(client), measure(unit));
  doc.roundedRect(M, y, cw, ch, 4).fill(SOFT);
  doc.roundedRect(M + cw + gap, y, cw, ch, 4).fill(SOFT);
  card('Cliente', client, M, y);
  card('Unidad y servicio', unit, M + cw + gap, y);
  y += ch + 12;
  doc.font('Helvetica').fontSize(8.2).fillColor(INK).text(empresa.introduccion, M, y, { width: W });
  y = doc.y + 10;

  // Detalle por secciones
  const header = () => {
    doc.rect(M, y, W, 18).fill(INK);
    let x = M;
    doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#fff');
    for (const c of COLS) {
      doc.text(c.title, x + 4, y + 5.5, { width: c.w - 8, align: c.align });
      x += c.w;
    }
    y += 18;
  };
  const ensure = h => {
    if (y + h > bottom()) {
      doc.addPage();
      y = M;
      header();
    }
  };
  header();
  let n = 0;
  for (const s of t.sections) {
    const items = q.items.filter(i => i.section === s.id);
    if (!items.length) continue;
    ensure(34);
    doc.rect(M, y, W, 16).fill(TINT);
    doc.rect(M, y, 3, 16).fill(BLUE);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(INK)
      .text(s.name, M + 10, y + 4.5);
    doc
      .font('Helvetica')
      .fontSize(7.2)
      .fillColor(MUTED)
      .text(`${items.length} ${items.length === 1 ? 'ítem' : 'ítems'}`, M, y + 5, {
        width: W - 6,
        align: 'right'
      });
    y += 16;
    for (const i of items) {
      const cells = {
        n: String(++n),
        code: i.code || '-',
        vehicles: qty(i.vehicles),
        quantity: qty(i.quantity),
        description: i.description,
        unitPrice: money(i.unitPrice),
        discount: i.discount ? `${qty(i.discount)} %` : '-',
        total: money(lineTotal(i))
      };
      doc.font('Helvetica').fontSize(7.8);
      const h = Math.max(15, doc.heightOfString(cells.description, { width: COLS[1].w - 8 }) + 7);
      ensure(h);
      let x = M;
      for (const c of COLS) {
        doc
          .font(c.key === 'total' ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(7.8)
          .fillColor(c.key === 'code' || c.key === 'n' ? MUTED : INK)
          .text(cells[c.key], x + 4, y + 4, { width: c.w - 8, align: c.align });
        x += c.w;
      }
      y += h;
      doc
        .moveTo(M, y)
        .lineTo(M + W, y)
        .lineWidth(0.5)
        .strokeColor(LINE)
        .stroke();
    }
    ensure(16);
    doc
      .font('Helvetica')
      .fontSize(7.6)
      .fillColor(MUTED)
      .text(`Subtotal ${s.name.toLowerCase()}`, M, y + 4.5, { width: W - COLS[7].w - 4, align: 'right' });
    doc
      .font('Helvetica-Bold')
      .fillColor(INK)
      .text(money(s.subtotal), M + W - COLS[7].w, y + 4.5, { width: COLS[7].w - 4, align: 'right' });
    y += 20;
  }
  if (!q.items.length) {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text('Sin ítems cotizados.', M + 4, y + 4);
    y += 18;
  }

  // Resumen: monto en letras a la izquierda, totales en recuadro a la derecha
  ensure(80);
  y += 6;
  const tw = 210,
    tx = M + W - tw;
  doc.roundedRect(tx, y, tw, 66, 4).fill(SOFT);
  const row = (label, value, yy) => {
    doc
      .font('Helvetica')
      .fontSize(8.3)
      .fillColor(MUTED)
      .text(label, tx + 12, yy, { width: 110 });
    doc
      .font('Helvetica-Bold')
      .fillColor(INK)
      .text(value, tx + 110, yy, { width: tw - 122, align: 'right' });
  };
  row(`Subtotal ${cur.symbol}`, money(t.subtotal), y + 9);
  row(`IGV ${(q.igvRate * 100).toFixed(0)} % ${cur.symbol}`, money(t.igv), y + 23);
  doc.roundedRect(tx, y + 40, tw, 26, 4).fill(BLUE);
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#fff')
    .text(`Total ${cur.symbol}`, tx + 12, y + 48.5, { width: 100 })
    .text(money(t.total), tx + 100, y + 48.5, { width: tw - 112, align: 'right' });
  doc
    .font('Helvetica')
    .fontSize(7.3)
    .fillColor(MUTED)
    .text('Son:', M, y + 9);
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(INK)
    .text(montoEnLetras(t.total, q.currency), M, y + 20, { width: W - tw - 20 });
  y += 80;

  // Observaciones (en recuadro), condiciones y garantía
  const obs = (q.observations || '')
    .split('\n')
    .map(l => l.trim().replace(/^[-–•·]\s*/, ''))
    .filter(Boolean);
  if (obs.length) {
    doc.font('Helvetica').fontSize(7.9);
    const h = 26 + obs.reduce((a, l) => a + doc.heightOfString(l, { width: W - 34 }) + 3, 0);
    if (y + h > bottom()) {
      doc.addPage();
      y = M;
    }
    doc.roundedRect(M, y, W, h, 4).lineWidth(0.8).strokeColor(BLUE).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(BLUE)
      .text('OBSERVACIONES', M + 12, y + 9, { characterSpacing: 0.6 });
    let oy = y + 22;
    for (const l of obs) {
      doc.circle(M + 15, oy + 3.6, 1.3).fill(BLUE);
      doc
        .font('Helvetica')
        .fontSize(7.9)
        .fillColor(INK)
        .text(l, M + 22, oy, { width: W - 34 });
      oy = doc.y + 3;
    }
    y += h + 12;
  }
  const hw = (W - 20) / 2;
  const list = (title, lines, x, y0) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text(title, x, y0);
    let yy = doc.y + 3;
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED);
    for (const l of lines.filter(Boolean)) {
      doc.text(`–  ${l}`, x, yy, { width: hw });
      yy = doc.y + 2;
    }
    return yy;
  };
  const terms = empresa.terminos.map(l =>
    l.replace('{validez}', q.validityDays).replace('{entrega}', q.delivery)
  );
  doc.font('Helvetica').fontSize(7.5);
  const need =
    20 +
    Math.max(
      ...[terms, empresa.garantia].map(ls =>
        ls.reduce((a, l) => a + doc.heightOfString(`–  ${l}`, { width: hw }) + 2, 0)
      )
    );
  if (y + need > bottom()) {
    doc.addPage();
    y = M;
  }
  y =
    Math.max(
      list('Condiciones de la propuesta', terms, M, y),
      list('Garantía', empresa.garantia, M + hw + 20, y)
    ) + 12;

  // Cuentas y firma
  if (y + 60 + empresa.cuentas.length * 14 > bottom()) {
    doc.addPage();
    y = M;
  }
  doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text('Cuentas para el pago', M, y);
  y = doc.y + 4;
  const bank = [
    ['Banco', 120],
    ['Tipo', 85],
    ['Moneda', 60],
    ['N° de cuenta', 110],
    ['CCI', 140]
  ];
  let x = M;
  doc.font('Helvetica').fontSize(7).fillColor(MUTED);
  for (const [h, w] of bank) {
    doc.text(h, x, y, { width: w - 6 });
    x += w;
  }
  y += 11;
  doc
    .moveTo(M, y)
    .lineTo(M + W, y)
    .lineWidth(0.5)
    .strokeColor(LINE)
    .stroke();
  for (const c of empresa.cuentas) {
    x = M;
    y += 3;
    doc.font('Helvetica').fontSize(7.6).fillColor(INK);
    [c.banco, c.tipo, c.moneda, c.numero, c.cci].forEach((v, i) => {
      doc.text(v, x, y, { width: bank[i][1] - 6 });
      x += bank[i][1];
    });
    y += 11;
    doc
      .moveTo(M, y)
      .lineTo(M + W, y)
      .lineWidth(0.5)
      .strokeColor(LINE)
      .stroke();
  }
  y += 10;
  doc.font('Helvetica').fontSize(7.6).fillColor(MUTED).text(empresa.cierre, M, y, { width: W });
  y = doc.y + 28;
  if (y + 60 > bottom()) {
    doc.addPage();
    y = M + 20;
  }
  const sx = M + W - 200;
  doc
    .moveTo(sx, y + 30)
    .lineTo(M + W, y + 30)
    .lineWidth(0.8)
    .strokeColor(INK)
    .stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(8.3)
    .fillColor(INK)
    .text('Área Comercial', sx, y + 35, { width: 200, align: 'center' });
  doc
    .font('Helvetica')
    .fontSize(7.3)
    .fillColor(MUTED)
    .text(empresa.razonSocial, sx, y + 46, { width: 200, align: 'center' });

  // Anexo: fotos de cada lado
  if (photos.length) {
    doc.addPage();
    y = M;
    doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text('Anexo · Vistas de la configuración', M, y);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `${q.model}${q.color ? ' · ' + q.color : ''} · ${q.number}. Imágenes referenciales generadas con el configurador 3D.`,
        M,
        y + 20,
        { width: W }
      );
    y += 42;
    const gw = (W - 12) / 2,
      gh = gw * 0.625;
    photos.forEach((p, i) => {
      const col = i % 2,
        rowI = Math.floor(i / 2);
      const px = M + col * (gw + 12),
        py = y + rowI * (gh + 26);
      doc.rect(px, py, gw, gh).fill(SOFT);
      // Una foto dañada no debe impedir generar la cotización: se deja el recuadro con un aviso.
      try {
        doc.image(p.buffer, px, py, { fit: [gw, gh], align: 'center', valign: 'center' });
      } catch {
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(MUTED)
          .text('Imagen no disponible', px, py + gh / 2 - 4, { width: gw, align: 'center' });
      }
      doc.rect(px, py, gw, gh).lineWidth(0.5).strokeColor(LINE).stroke();
      doc.rect(px, py + gh + 4, 3, 10).fill(BLUE);
      doc
        .font('Helvetica-Bold')
        .fontSize(7.8)
        .fillColor(INK)
        .text(p.name, px + 8, py + gh + 5.5, { width: gw - 8 });
    });
  }

  // Pie con numeración en todas las páginas.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0; // escribir en el margen inferior sin que pdfkit cree otra página
    const fy = doc.page.height - 32;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(`${empresa.razonSocial}${empresa.modoPrueba ? ' · documento de prueba' : ''}`, M, fy, {
        width: W / 2,
        lineBreak: false
      })
      .text(`${q.number} · ${i + 1} / ${range.count}`, M + W / 2, fy, {
        width: W / 2,
        align: 'right',
        lineBreak: false
      });
  }
  doc.end();
  return done;
}
