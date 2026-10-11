// Elige dónde se guardan solicitudes, cotizaciones y fotos:
// - PostgreSQL si existe DATABASE_URL (recomendado en Render gratuito: el disco del servicio se borra
//   cada vez que se duerme o se vuelve a desplegar).
// - Archivo JSON en DATA_FILE (o backend/data) en cualquier otro caso.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createStore } from './store.js';
import { createPhotoStore, VIEWS } from './photos.js';
import { createPgStorage } from './storage-pg.js';

async function writable(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.access(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
// Una carpeta que es punto de montaje (disco de Render, volumen de Docker) tiene otro dispositivo que su padre.
async function isMountPoint(dir) {
  try {
    const [a, b] = await Promise.all([fs.stat(dir), fs.stat(path.dirname(dir))]);
    return a.dev !== b.dev;
  } catch {
    return false;
  }
}

export async function createStorage({ databaseUrl, dataFile, fallbackDir }) {
  if (databaseUrl) return createPgStorage(databaseUrl, VIEWS);
  let file = dataFile;
  if (!(await writable(path.dirname(file)))) {
    const alt = path.join(fallbackDir, path.basename(file));
    console.warn(`No se puede escribir en ${path.dirname(file)}; se usará ${alt}.`);
    file = alt;
    await fs.mkdir(fallbackDir, { recursive: true });
  }
  const dir = path.dirname(file);
  // En Render, sin disco montado, el archivo desaparece al reiniciar el servicio.
  const persistent = !process.env.RENDER || (await isMountPoint(dir));
  return {
    kind: 'archivo',
    file,
    persistent,
    store: createStore(file),
    photos: createPhotoStore(dir),
    close: async () => {}
  };
}
