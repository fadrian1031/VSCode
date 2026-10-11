import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// Guardado en un archivo JSON (uso local o servidor con disco permanente).
// - Las lecturas y escrituras pasan por una cola, una a la vez, para que dos envíos no se pisen.
// - Cada escritura va a un archivo temporal que luego reemplaza al original (rename atómico).
// - Si el archivo existe pero está dañado, se detiene con error en vez de tratarlo como vacío,
//   así no se borra el historial por accidente.
// En Render se usa PostgreSQL (storage-pg.js), que tiene la misma interfaz.
export function createStore(file) {
  let queue = Promise.resolve();

  async function read() {
    let text;
    try {
      text = await fs.readFile(file, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
    if (!text.trim()) return [];
    try {
      const rows = JSON.parse(text);
      if (!Array.isArray(rows)) throw new Error('el contenido no es una lista');
      return rows;
    } catch (e) {
      throw new Error(
        `No se pudo leer ${file}: ${e.message}. Revisa o restaura el archivo; no se escribirá nada para no perder datos.`
      );
    }
  }

  async function write(rows) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(rows, null, 2), 'utf8');
    await fs.rename(tmp, file);
  }

  /** Ejecuta `fn(rows)` en exclusiva, guarda `rows` (modificado por `fn`) y devuelve lo que `fn` devuelva. */
  function update(fn) {
    const run = queue.then(async () => {
      const rows = await read();
      const result = await fn(rows);
      await write(rows);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }

  return {
    // Las lecturas también esperan a la cola para no ver una escritura a medias.
    all: () => queue.then(read),
    update
  };
}
