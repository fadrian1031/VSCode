// Cotizaciones del Área Comercial: estructura, armado inicial desde la configuración del cliente,
// validación de lo que envía Comercial y cálculo de totales.
import crypto from 'node:crypto';
import { precioDe } from './precios.js';

// Secciones de la cotización (mismo orden en pantalla, PDF y Excel).
export const SECTIONS = [
  { id: 'equipamiento', name: 'Equipamiento' },
  { id: 'electrico', name: 'Sistema eléctrico' },
  { id: 'metalica', name: 'Estructura metálica' },
  { id: 'stickers', name: 'Stickers y ploteo' }
];
const SECTION_IDS = SECTIONS.map(s => s.id);
export const CURRENCIES = {
  USD: { symbol: 'US$', words: ['DÓLAR AMERICANO', 'DÓLARES AMERICANOS'] },
  PEN: { symbol: 'S/', words: ['SOL', 'SOLES'] }
};
const MAX_ITEMS = 200;

const text = (v, max = 300) =>
  String(v ?? '')
    .trim()
    .slice(0, max);
const num = (v, min, max, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineTotal(i) {
  return round2(i.vehicles * i.quantity * i.unitPrice * (1 - i.discount / 100));
}

export function totals(quote) {
  const sections = SECTIONS.map(s => ({
    ...s,
    subtotal: round2(quote.items.filter(i => i.section === s.id).reduce((a, i) => a + lineTotal(i), 0))
  }));
  const subtotal = round2(sections.reduce((a, s) => a + s.subtotal, 0));
  const igv = round2(subtotal * quote.igvRate);
  return { sections, subtotal, igv, total: round2(subtotal + igv) };
}

/** Cotización inicial: una línea por accesorio y gráfica que eligió el cliente, con precio de lista. */
export function draftQuote(lead, catalog) {
  const v = lead.configuration.vehicle;
  const vehicle = catalog.vehicles.find(x => x.id === v.id) || v;
  const suffix = vehicle.code ? `-${vehicle.code}` : '';
  const model = `${vehicle.brand} ${vehicle.model}`.toUpperCase();
  const items = [];
  // Las piezas repetibles (luces) se agrupan en una sola línea con su cantidad.
  const grouped = new Map();
  for (const a of lead.configuration.accessories) {
    const g = grouped.get(a.catalogItemId);
    if (g) g.quantity++;
    else grouped.set(a.catalogItemId, { a, quantity: 1 });
  }
  for (const { a, quantity } of grouped.values()) {
    const item = catalog.items.find(i => i.id === a.catalogItemId);
    items.push({
      id: crypto.randomUUID(),
      section: item?.quoteSection || 'equipamiento',
      code: `${item?.code || 'EQ'}${suffix}`,
      description: `${(item?.name || a.name).toUpperCase()} - ${model}`,
      vehicles: 1,
      quantity,
      unitPrice: precioDe(a.catalogItemId, v.id),
      discount: 0
    });
  }
  for (const g of lead.configuration.graphics || []) {
    const preset = catalog.graphics.find(p => p.id === g.presetId);
    const reflective = g.type === 'reflective';
    items.push({
      id: crypto.randomUUID(),
      section: 'stickers',
      code: preset?.code || 'ST',
      description: reflective
        ? `${g.name.toUpperCase()} (${g.heightCm} CM DE ANCHO) - METROS`
        : `${g.name.toUpperCase()} ${g.widthCm} x ${g.heightCm} CM`,
      vehicles: 1,
      quantity: reflective ? round2(g.lengthM || 0) : 1,
      unitPrice: precioDe(g.presetId, v.id),
      discount: 0
    });
  }
  const c = lead.customer;
  return {
    number: '',
    version: 0,
    currency: 'USD',
    igvRate: 0.18,
    serviceType: 'EQUIPAMIENTO',
    motive: 'VENTA NACIONAL',
    paymentTerms: 'CONTADO',
    validityDays: 10,
    delivery: 'Entrega según confirmación de la orden de compra.',
    customerName: c.type === 'corporate' ? c.companyName : c.fullName,
    customerDocument: c.type === 'corporate' ? c.ruc : c.document || '',
    address: '',
    contact: c.fullName,
    operation: '',
    purchaseOrder: '',
    plate: '',
    chassis: '',
    model: `${vehicle.brand} ${vehicle.model}`.toUpperCase(),
    color: (lead.configuration.paint?.name || '').toUpperCase(),
    year: vehicle.year || '',
    observations: draftObservations(lead),
    items,
    createdAt: null,
    updatedAt: null,
    approvedAt: null
  };
}

/** Observaciones iniciales: lo que pidió el cliente, ordenado y listo para que Comercial lo ajuste. */
export function draftObservations(lead) {
  const cfg = lead.configuration,
    c = lead.customer;
  const clean = t =>
    String(t || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.;,]?$/, '.');
  return [
    `Configuración ${lead.code || ''} enviada desde el configurador 3D; las imágenes del anexo son referenciales.`.replace(
      '  ',
      ' '
    ),
    cfg.paint?.name && `Color de la unidad indicado por el cliente: ${cfg.paint.name}.`,
    cfg.notes && `Indicaciones del cliente: ${clean(cfg.notes)}`,
    c.notes && `Comentario adicional: ${clean(c.notes)}`
  ]
    .filter(Boolean)
    .join('\n');
}

/** Valida y normaliza la cotización que envía Comercial (sobre la cotización existente o el borrador). */
export function sanitizeQuote(body, base) {
  const items = (Array.isArray(body?.items) ? body.items : [])
    .slice(0, MAX_ITEMS)
    .map(i => ({
      id: text(i?.id, 64) || crypto.randomUUID(),
      section: SECTION_IDS.includes(i?.section) ? i.section : 'equipamiento',
      code: text(i?.code, 40),
      description: text(i?.description, 300),
      vehicles: num(i?.vehicles, 0, 10000, 1),
      quantity: num(i?.quantity, 0, 100000, 1),
      unitPrice: round2(num(i?.unitPrice, 0, 1e9, 0)),
      discount: num(i?.discount, 0, 100, 0)
    }))
    .filter(i => i.description);
  const field = (k, max = 200) => (body && k in body ? text(body[k], max) : base[k]);
  return {
    ...base,
    currency: CURRENCIES[body?.currency] ? body.currency : base.currency,
    igvRate: body && 'igvRate' in body ? num(body.igvRate, 0, 0.5, 0.18) : base.igvRate,
    validityDays:
      body && 'validityDays' in body ? Math.round(num(body.validityDays, 1, 365, 10)) : base.validityDays,
    serviceType: field('serviceType', 60),
    motive: field('motive', 60),
    paymentTerms: field('paymentTerms', 80),
    delivery: field('delivery', 300),
    customerName: field('customerName'),
    customerDocument: field('customerDocument', 20),
    address: field('address', 300),
    contact: field('contact'),
    operation: field('operation', 100),
    purchaseOrder: field('purchaseOrder', 60),
    plate: field('plate', 40),
    chassis: field('chassis', 300),
    model: field('model', 100),
    color: field('color', 60),
    year: field('year', 10),
    observations: field('observations', 2000),
    items
  };
}

export function nextQuoteNumber(rows) {
  const prefix = `COT-${new Date().getFullYear()}-`;
  const last = rows
    .map(r => r.quote?.number)
    .filter(n => n?.startsWith(prefix))
    .reduce((m, n) => Math.max(m, Number(n.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(last + 1).padStart(5, '0')}`;
}

// Monto en letras ("SON: CIEN Y 00/100 DÓLARES AMERICANOS")
const UNIDADES = [
  '',
  'UNO',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISÉIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
  'VEINTE',
  'VEINTIUNO',
  'VEINTIDÓS',
  'VEINTITRÉS',
  'VEINTICUATRO',
  'VEINTICINCO',
  'VEINTISÉIS',
  'VEINTISIETE',
  'VEINTIOCHO',
  'VEINTINUEVE'
];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS'
];
function menorMil(n) {
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100),
    r = n % 100;
  const resto = r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ' Y ' + UNIDADES[r % 10] : '');
  return [CENTENAS[c], resto].filter(Boolean).join(' ');
}
export function enteroALetras(n) {
  if (n === 0) return 'CERO';
  const parts = [];
  const millones = Math.floor(n / 1e6),
    miles = Math.floor((n % 1e6) / 1000),
    resto = n % 1000;
  if (millones) parts.push(millones === 1 ? 'UN MILLÓN' : `${enteroALetras(millones)} MILLONES`);
  if (miles) parts.push(miles === 1 ? 'MIL' : `${menorMil(miles)} MIL`);
  if (resto) parts.push(menorMil(resto));
  // "VEINTIUNO MIL" / "UNO MIL" → "VEINTIÚN MIL" / "UN MIL"
  return parts
    .join(' ')
    .replace(/VEINTIUNO MIL/g, 'VEINTIÚN MIL')
    .replace(/(^|\s)UNO (MIL|MILLONES)/g, '$1UN $2')
    .replace(/ Y UNO (MIL|MILLONES)/g, ' Y UN $1');
}
export function montoEnLetras(amount, currency) {
  const entero = Math.floor(amount + 1e-9),
    cents = Math.round((amount - entero) * 100);
  const w = CURRENCIES[currency]?.words || CURRENCIES.USD.words;
  const letras = enteroALetras(entero);
  return `${letras} Y ${String(cents).padStart(2, '0')}/100 ${entero === 1 ? w[0] : w[1]}`;
}
