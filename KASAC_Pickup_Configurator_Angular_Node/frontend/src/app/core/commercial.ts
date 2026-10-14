import { LeadStatus, QuoteItem, QuoteSection, QuoteState } from '../models/domain';

export const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'Nueva',
  CONTACTED: 'Contactado',
  NEGOTIATING: 'Negociando',
  QUOTED: 'Cotizada',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  LOST: 'Perdida'
};
export const STATUS_ORDER: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'NEGOTIATING',
  'QUOTED',
  'APPROVED',
  'REJECTED',
  'LOST'
];
export const QUOTE_STATE_LABEL: Record<QuoteState, string> = {
  BORRADOR: 'Borrador',
  EMITIDA: 'Pendiente por aprobar',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada'
};
export const SECTIONS: { id: QuoteSection; name: string }[] = [
  { id: 'equipamiento', name: 'Equipamiento' },
  { id: 'electrico', name: 'Sistema eléctrico' },
  { id: 'metalica', name: 'Estructura metálica' },
  { id: 'stickers', name: 'Stickers y ploteo' }
];
export const CURRENCY_SYMBOL = { USD: 'US$', PEN: 'S/' } as const;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Mismo cálculo que el servidor (backend/src/quotes.js). */
export const lineTotal = (i: QuoteItem) =>
  round2((+i.vehicles || 0) * (+i.quantity || 0) * (+i.unitPrice || 0) * (1 - (+i.discount || 0) / 100));
/** Duración legible entre dos fechas: "3 d 4 h", "5 h 12 min", "12 min". */
export const duration = (from: string, to: string | number) => {
  const min = Math.max(
    0,
    Math.floor(((typeof to === 'number' ? to : Date.parse(to)) - Date.parse(from)) / 60000)
  );
  const d = Math.floor(min / 1440),
    h = Math.floor((min % 1440) / 60),
    m = min % 60;
  return d ? `${d} d${h ? ` ${h} h` : ''}` : h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};
export const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
