// Módulo de usuarios y roles del Área Comercial.
// Roles: "admin" (gestiona usuarios y puede corregir una respuesta registrada por error) y "comercial".
// Las contraseñas se guardan con scrypt + sal propia; nunca en texto plano.
import crypto from 'node:crypto';

export const ROLES = ['admin', 'comercial'];
const text = (v, max = 120) =>
  String(v ?? '')
    .trim()
    .slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function checkPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return test.length === real.length && crypto.timingSafeEqual(test, real);
}
/** Lo que se envía al navegador: nunca el hash de la contraseña. */
export const publicUser = u => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
  createdAt: u.createdAt
});

function validatePassword(p) {
  return String(p || '').length >= 8 ? '' : 'La contraseña debe tener al menos 8 caracteres.';
}

export function createUsers(collection) {
  /** Si no hay usuarios, crea el administrador inicial con las credenciales del .env (COMMERCIAL_EMAIL/PASSWORD). */
  async function ensureAdmin({ email, password, name }) {
    await collection.update(rows => {
      if (rows.length) return;
      rows.push({
        id: crypto.randomUUID(),
        name: name || 'Administrador',
        email: email.toLowerCase(),
        role: 'admin',
        active: true,
        password: hashPassword(password),
        createdAt: new Date().toISOString()
      });
    });
  }

  async function login(email, password) {
    const user = (await collection.all()).find(u => u.email === text(email).toLowerCase());
    // Se calcula el hash aunque el usuario no exista, para no revelar qué correos están registrados.
    const ok = checkPassword(String(password || ''), user?.password || hashPassword('x'));
    return user && user.active && ok ? user : null;
  }

  const find = async id => (await collection.all()).find(u => u.id === id) || null;

  async function create(body) {
    const email = text(body?.email).toLowerCase();
    const name = text(body?.name);
    const role = ROLES.includes(body?.role) ? body.role : 'comercial';
    if (!name) return { error: 'Ingrese el nombre.' };
    if (!EMAIL.test(email)) return { error: 'El correo no es válido.' };
    const bad = validatePassword(body?.password);
    if (bad) return { error: bad };
    return collection.update(rows => {
      if (rows.some(u => u.email === email)) return { error: 'Ya existe un usuario con ese correo.' };
      const user = {
        id: crypto.randomUUID(),
        name,
        email,
        role,
        active: true,
        password: hashPassword(body.password),
        createdAt: new Date().toISOString()
      };
      rows.push(user);
      return { user };
    });
  }

  /** Cambia nombre, rol, estado o contraseña. Siempre debe quedar al menos un administrador activo. */
  async function update(id, body) {
    if (body?.password !== undefined && body.password !== '') {
      const bad = validatePassword(body.password);
      if (bad) return { error: bad };
    }
    return collection.update(rows => {
      const user = rows.find(u => u.id === id);
      if (!user) return { error: 'Usuario no encontrado.', status: 404 };
      const next = {
        ...user,
        name: body?.name !== undefined ? text(body.name) || user.name : user.name,
        role: ROLES.includes(body?.role) ? body.role : user.role,
        active: typeof body?.active === 'boolean' ? body.active : user.active
      };
      const admins = rows.map(u => (u.id === id ? next : u)).filter(u => u.role === 'admin' && u.active);
      if (!admins.length) return { error: 'Debe quedar al menos un administrador activo.' };
      if (body?.password) next.password = hashPassword(body.password);
      Object.assign(user, next);
      return { user };
    });
  }

  return { ensureAdmin, login, find, create, update, all: () => collection.all() };
}
