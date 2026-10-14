// Módulo de avisos (notificaciones) del Área Comercial.
// Los avisos se calculan con los datos actuales; cada usuario puede descartar los suyos.
// Descartar un aviso no cambia la cotización: en la bandeja sigue marcada "por vencer" o "vencida".
import { tesis } from './tesis.js';
import { quoteState, expiresAt } from './quotes.js';

const DAY = 864e5;
const customerName = l => (l.customer.type === 'corporate' ? l.customer.companyName : l.customer.fullName);

/** Situación de vencimiento de una cotización emitida que sigue sin respuesta. */
export function expiryInfo(quote, now = Date.now()) {
  if (quoteState(quote) !== 'EMITIDA') return null;
  const vence = expiresAt(quote);
  const left = Math.ceil((Date.parse(vence) - now) / DAY);
  if (left < 0) return { estado: 'vencida', vence, dias: -left };
  if (left <= tesis.diasAvisoVencimiento) return { estado: 'por-vencer', vence, dias: left };
  return { estado: 'vigente', vence, dias: left };
}

export function computeNotices(leads, now = Date.now()) {
  const list = [];
  for (const l of leads) {
    const who = customerName(l);
    if (l.status === 'NEW')
      list.push({
        key: `nueva:${l.id}`,
        tipo: 'nueva',
        nivel: 'info',
        titulo: `Nueva solicitud ${l.code}`,
        detalle: `${who} · ${l.configuration.vehicle.brand} ${l.configuration.vehicle.model}`,
        fecha: l.createdAt,
        solicitudId: l.id
      });
    const q = l.quote;
    if (!q) continue;
    const state = quoteState(q);
    const answeredAt = state === 'APROBADA' ? q.approvedAt : state === 'RECHAZADA' ? q.rejectedAt : null;
    if (answeredAt && now - Date.parse(answeredAt) < 7 * DAY)
      list.push({
        key: `respuesta:${l.id}:${state}`,
        tipo: state === 'APROBADA' ? 'aprobada' : 'rechazada',
        nivel: state === 'APROBADA' ? 'ok' : 'error',
        titulo: `${q.number} ${state === 'APROBADA' ? 'aprobada' : 'rechazada'} por el cliente`,
        detalle: state === 'RECHAZADA' && q.rejectionReason ? `${who} · ${q.rejectionReason}` : who,
        fecha: answeredAt,
        solicitudId: l.id
      });
    const exp = expiryInfo(q, now);
    if (exp?.estado === 'por-vencer')
      list.push({
        key: `por-vencer:${l.id}`,
        tipo: 'por-vencer',
        nivel: 'warn',
        titulo: `${q.number} vence ${exp.dias === 0 ? 'hoy' : `en ${exp.dias} día${exp.dias === 1 ? '' : 's'}`}`,
        detalle: `${who} aún no responde`,
        fecha: exp.vence,
        solicitudId: l.id
      });
    if (exp?.estado === 'vencida')
      list.push({
        key: `vencida:${l.id}`,
        tipo: 'vencida',
        nivel: 'error',
        titulo: `${q.number} venció hace ${exp.dias} día${exp.dias === 1 ? '' : 's'}`,
        detalle: `${who} · sigue pendiente por aprobar`,
        fecha: exp.vence,
        solicitudId: l.id
      });
  }
  return list.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}
