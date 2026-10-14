// Módulo de clientes: agrupa las solicitudes por cliente (RUC, DNI o correo) para ver su historial.
import { quoteState } from './quotes.js';

const plain = s =>
  String(s || '')
    .trim()
    .toLowerCase();

/** Identificador estable del cliente: RUC para empresas, DNI o correo para personas. */
export function customerKey(c) {
  if (c.type === 'corporate' && c.ruc) return `ruc-${plain(c.ruc)}`;
  if (c.document) return `doc-${plain(c.document)}`;
  return `mail-${plain(c.email)}`;
}

export function listCustomers(leads) {
  const map = new Map();
  for (const l of leads) {
    const c = l.customer;
    const key = customerKey(c);
    if (!map.has(key))
      map.set(key, {
        key,
        tipo: c.type,
        nombre: c.type === 'corporate' ? c.companyName : c.fullName,
        documento: c.type === 'corporate' ? c.ruc : c.document,
        contacto: c.fullName,
        correo: c.email,
        telefono: c.phone,
        ciudad: c.city,
        solicitudes: 0,
        cotizaciones: 0,
        aprobadas: 0,
        rechazadas: 0,
        pendientes: 0,
        ultima: l.createdAt
      });
    const row = map.get(key);
    row.solicitudes++;
    if (l.createdAt > row.ultima) {
      // Los datos de contacto más recientes reemplazan a los anteriores.
      Object.assign(row, {
        contacto: c.fullName,
        correo: c.email,
        telefono: c.phone,
        ciudad: c.city,
        ultima: l.createdAt
      });
    }
    const state = quoteState(l.quote);
    if (state) {
      row.cotizaciones++;
      if (state === 'APROBADA') row.aprobadas++;
      else if (state === 'RECHAZADA') row.rechazadas++;
      else row.pendientes++;
    }
  }
  return [...map.values()].sort((a, b) => (a.ultima < b.ultima ? 1 : -1));
}
