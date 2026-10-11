/* =========================================================
   KASAC - Script general (todas las páginas)
   ========================================================= */
const KASAC = {
  WHATSAPP: '51966367094',
  EMAIL: 'ventas@kasac.pe',
  CONFIGURADOR_URL: 'configurador' // Página del configurador 3D dentro de esta web (la app vive en configurador-app/)
};
const waLink = text => `https://wa.me/${KASAC.WHATSAPP}?text=${encodeURIComponent(text)}`;

/* Enlaces al configurador 3D */
document.querySelectorAll('[data-config-link]').forEach(a => (a.href = KASAC.CONFIGURADOR_URL));

/* Configurador embebido: el enlace que recibe el cliente (configurador#/solicitud/<token>)
   se pasa al iframe para que abra su configuración en modo lectura. */
const configFrame = document.getElementById('configFrame');
if (configFrame && location.hash.startsWith('#/')) configFrame.src = 'configurador-app/' + location.hash;

/* Año del pie de página */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* Imagen que no carga: llama a onFail (también si falló antes de que corriera este script) */
function whenBroken(img, onFail) {
  if (img.complete && img.naturalWidth === 0) onFail();
  else img.addEventListener('error', onFail, { once: true });
}

/* Logo: si no carga la imagen, muestra el texto */
const logo = document.querySelector('.brand img');
if (logo)
  whenBroken(logo, () => {
    const t = document.createElement('span');
    t.className = 'brand-text';
    t.textContent = 'KASAC';
    logo.replaceWith(t);
  });

/* Menú móvil */
const menuBtn = document.querySelector('.menu-btn');
const nav = document.getElementById('nav');
if (menuBtn && nav) {
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
  });
}

/* Fotos de kasac.pe: si la imagen no está en esta copia del sitio, se toma de la web oficial */
const KASAC_REMOTE = 'https://kasac.pe/';
function remoteOf(path) {
  return /^(https?:|data:|\/\/)/.test(path) || /(^|\.)kasac\.pe$/.test(location.hostname)
    ? ''
    : KASAC_REMOTE + path.replace(/^\.?\//, '');
}

/* Imágenes con respaldo: prueba data-remote (la misma foto en kasac.pe), luego data-alt (otra foto)
   y, si tampoco carga, deja el recuadro neutro */
function withFallback(img) {
  whenBroken(img, () => {
    const alt = img.dataset.alt;
    const remote = img.dataset.remote ? remoteOf(img.dataset.remote) : '';
    if (remote) {
      delete img.dataset.remote;
      img.src = remote;
      withFallback(img);
    } else if (alt) {
      delete img.dataset.alt;
      img.src = alt;
      withFallback(img);
    } else img.parentElement.classList.add('noimg');
  });
}
document.querySelectorAll('[data-fallback] img').forEach(withFallback);

/* Formulario de cotización (sin backend: arma el mensaje para WhatsApp o correo) */
const form = document.getElementById('quoteForm');
if (form) {
  // Si llega desde un producto (contacto?producto=...&vehiculo=...), rellena el formulario
  const q = new URLSearchParams(location.search);
  if (q.get('producto')) form.mensaje.value = `${q.get('producto')}`;
  if (q.get('vehiculo'))
    [...form.vehiculo.options].forEach(o => {
      if (o.text === q.get('vehiculo')) o.selected = true;
    });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const via = e.submitter?.dataset.via || 'wa';
    const d = Object.fromEntries(new FormData(form));
    const msg = document.getElementById('formMsg');
    if (!d.nombre.trim() || !d.telefono.trim()) {
      msg.textContent = 'Complete su nombre y teléfono para poder responderle.';
      (d.nombre.trim() ? form.telefono : form.nombre).focus();
      return;
    }
    msg.textContent = '';
    const text = `Consulta desde la web
Nombre: ${d.nombre}
Empresa: ${d.empresa || '-'}
Teléfono: ${d.telefono}
Correo: ${d.correo || '-'}
Vehículo: ${d.vehiculo} (${d.cantidad} unidad/es)
Equipamiento: ${d.mensaje || '-'}`;
    if (via === 'wa') window.open(waLink(text), '_blank', 'noopener');
    else
      location.href = `mailto:${KASAC.EMAIL}?subject=${encodeURIComponent('Consulta web - ' + (d.empresa || d.nombre))}&body=${encodeURIComponent(text)}`;
  });
}
