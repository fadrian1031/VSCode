// Fotos de cada lado del vehículo configurado, capturadas desde el visor 3D del Área Comercial.
// Se guardan como JPG en <carpeta de datos>/fotos/<id de solicitud>/<vista>.jpg.
import fs from 'node:fs/promises';
import path from 'node:path';

export const VIEWS = [
  { id: 'frente-34', name: 'Vista 3/4 frontal' },
  { id: 'frente', name: 'Vista frontal' },
  { id: 'izquierda', name: 'Lateral izquierdo' },
  { id: 'derecha', name: 'Lateral derecho' },
  { id: 'posterior', name: 'Vista posterior' },
  { id: 'posterior-34', name: 'Vista 3/4 posterior' }
];
const MAX_BYTES = 3 * 1024 * 1024;
const DATA_URL = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;

export function createPhotoStore(dataDir) {
  const root = path.join(dataDir, 'fotos');
  // El id viene de la URL: solo se aceptan UUID para no salir de la carpeta.
  const dirOf = id => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('id inválido');
    return path.join(root, id);
  };

  async function save(id, dataUrls) {
    const dir = dirOf(id);
    await fs.mkdir(dir, { recursive: true });
    const saved = [];
    for (const v of VIEWS) {
      const m = DATA_URL.exec(dataUrls?.[v.id] || '');
      if (!m) continue;
      const buf = Buffer.from(m[1], 'base64');
      if (!buf.length || buf.length > MAX_BYTES) continue;
      await fs.writeFile(path.join(dir, `${v.id}.jpg`), buf);
      saved.push(v.id);
    }
    return saved;
  }

  /** Fotos existentes: [{ id, name, buffer }] en el orden de VIEWS. */
  async function load(id) {
    const dir = dirOf(id);
    const out = [];
    for (const v of VIEWS) {
      try {
        out.push({ ...v, buffer: await fs.readFile(path.join(dir, `${v.id}.jpg`)) });
      } catch {}
    }
    return out;
  }

  async function remove(id) {
    await fs.rm(dirOf(id), { recursive: true, force: true });
  }

  return { save, load, remove };
}
