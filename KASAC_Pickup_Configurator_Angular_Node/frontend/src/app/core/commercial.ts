import { LeadStatus, QuoteItem, QuoteSection } from '../models/domain';

export const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'Nueva',
  CONTACTED: 'Contactado',
  NEGOTIATING: 'Negociando',
  QUOTED: 'Cotizada',
  APPROVED: 'Aprobada',
  LOST: 'Perdida'
};
export const STATUS_ORDER: LeadStatus[] = ['NEW', 'CONTACTED', 'NEGOTIATING', 'QUOTED', 'APPROVED', 'LOST'];
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
export const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
