// Aviso por correo al área comercial cada vez que un cliente envía una solicitud.
// Destino: NOTIFY_EMAIL. Proveedor, en este orden:
//   1. Resend (RESEND_API_KEY): envía por HTTPS, funciona en Render gratuito. Sin dominio propio
//      verificado, Resend solo entrega a la dirección con la que se creó la cuenta.
//   2. SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS): por ejemplo Gmail con "contraseña de aplicación".
// Si no hay ninguno configurado, el aviso solo se escribe en el registro del servidor.
// Un fallo del correo nunca impide guardar la solicitud del cliente.
import nodemailer from 'nodemailer';

const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

export function createNotifier(env = process.env) {
  const to = (env.NOTIFY_EMAIL || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const from = env.MAIL_FROM || 'KASAC Configurador <onboarding@resend.dev>';
  let provider = 'ninguno',
    send = async () => {};
  if (to.length && env.RESEND_API_KEY) {
    provider = 'resend';
    const url = env.RESEND_API_URL || 'https://api.resend.com/emails';
    send = async mail => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, ...mail })
      });
      if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
    };
  } else if (to.length && env.SMTP_HOST) {
    provider = 'smtp';
    const port = Number(env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
    });
    send = mail => transport.sendMail({ from: env.MAIL_FROM || env.SMTP_USER, to: to.join(','), ...mail });
  }

  /** Correo de "nueva solicitud" con el resumen y el enlace directo al Área Comercial. */
  async function newLead(lead, origin) {
    const c = lead.customer,
      cfg = lead.configuration;
    const who = c.type === 'corporate' ? c.companyName : c.fullName;
    const vehicle = `${cfg.vehicle.brand} ${cfg.vehicle.model} ${cfg.vehicle.year}`;
    const link = `${origin}/comercial/solicitud/${lead.id}`;
    const accessories = cfg.accessories.map(a => a.name);
    const rows = [
      ['Cliente', who],
      ['RUC / DNI', c.ruc || c.document],
      ['Contacto', c.fullName],
      ['Cargo', c.position],
      ['Correo', c.email],
      ['Teléfono', c.phone],
      ['Ciudad', c.city],
      ['Vehículo', vehicle + (cfg.paint ? ` · ${cfg.paint.name}` : '')]
    ].filter(([, v]) => v);
    const notes = [cfg.notes, c.notes].filter(Boolean);
    const subject = `Nueva solicitud ${lead.code} · ${who} · ${cfg.vehicle.brand} ${cfg.vehicle.model}`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#232834;max-width:600px">
  <div style="border-bottom:3px solid #1C85D1;padding:12px 0"><b style="font-size:20px">KA<span style="color:#1C85D1">SAC</span></b> · Configurador 3D</div>
  <h2 style="font-size:18px;margin:18px 0 6px">Nueva solicitud ${esc(lead.code)}</h2>
  <p style="margin:0 0 14px;color:#5E6675">Recibida el ${esc(new Date(lead.createdAt).toLocaleString('es-PE', { timeZone: 'America/Lima' }))}</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#5E6675;width:140px;border-bottom:1px solid #E1E5EB">${esc(k)}</td><td style="padding:6px 0;border-bottom:1px solid #E1E5EB"><b>${esc(v)}</b></td></tr>`).join('')}</table>
  <h3 style="font-size:14px;margin:18px 0 6px">Equipamiento (${accessories.length})</h3>
  <ul style="margin:0;padding-left:18px;font-size:14px">${accessories.map(a => `<li>${esc(a)}</li>`).join('') || '<li>Sin accesorios</li>'}</ul>
  ${notes.length ? `<h3 style="font-size:14px;margin:18px 0 6px">Comentarios del cliente</h3><p style="font-size:14px;margin:0">${notes.map(esc).join('<br>')}</p>` : ''}
  <p style="margin:22px 0"><a href="${esc(link)}" style="background:#1C85D1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;font-weight:bold">Abrir en el Área Comercial</a></p>
  <p style="font-size:12px;color:#8A919D">Aviso automático del configurador 3D (entorno de pruebas).</p>
</div>`;
    const text = `Nueva solicitud ${lead.code}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nEquipamiento:\n${accessories.map(a => `- ${a}`).join('\n') || '- Sin accesorios'}\n${notes.length ? `\nComentarios: ${notes.join(' / ')}\n` : ''}\nAbrir: ${link}\n`;
    if (provider === 'ninguno') {
      console.log(
        `[aviso] ${subject} (correo no configurado: defina NOTIFY_EMAIL y RESEND_API_KEY o SMTP_HOST)`
      );
      return;
    }
    await send({ subject, html, text });
    console.log(`[aviso] Correo enviado a ${to.join(', ')} por ${provider}: ${subject}`);
  }

  /** Correo cuando el cliente aprueba o rechaza su cotización desde el enlace. */
  async function quoteAnswered(lead, origin) {
    const q = lead.quote;
    const approved = q.state === 'APROBADA';
    const who = lead.customer.type === 'corporate' ? lead.customer.companyName : lead.customer.fullName;
    const link = `${origin}/comercial/solicitud/${lead.id}`;
    const subject = `${q.number} ${approved ? 'aprobada' : 'rechazada'} por ${who}`;
    const reason = !approved && q.rejectionReason ? `Motivo indicado: ${q.rejectionReason}` : '';
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#232834;max-width:600px">
  <div style="border-bottom:3px solid #1C85D1;padding:12px 0"><b style="font-size:20px">KA<span style="color:#1C85D1">SAC</span></b> · Configurador 3D</div>
  <h2 style="font-size:18px;margin:18px 0 6px;color:${approved ? '#1E9E5A' : '#C2410C'}">Cotización ${esc(q.number)} ${approved ? 'aprobada' : 'rechazada'}</h2>
  <p style="margin:0 0 8px">${esc(who)} respondió desde su enlace el ${esc(new Date(approved ? q.approvedAt : q.rejectedAt).toLocaleString('es-PE', { timeZone: 'America/Lima' }))}.</p>
  ${reason ? `<p style="margin:0 0 8px">${esc(reason)}</p>` : ''}
  <p style="margin:22px 0"><a href="${esc(link)}" style="background:#1C85D1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;font-weight:bold">Ver en el Área Comercial</a></p>
</div>`;
    const text = `${subject}\n${reason}\nVer: ${link}\n`;
    if (provider === 'ninguno') {
      console.log(`[aviso] ${subject} (correo no configurado)`);
      return;
    }
    await send({ subject, html, text });
    console.log(`[aviso] Correo enviado a ${to.join(', ')} por ${provider}: ${subject}`);
  }

  return { provider, enabled: provider !== 'ninguno', to, newLead, quoteAnswered };
}
