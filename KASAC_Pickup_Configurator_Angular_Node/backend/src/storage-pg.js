// Almacenamiento en PostgreSQL: se usa cuando existe DATABASE_URL.
// Necesario en hostings sin disco permanente (por ejemplo Render gratuito), donde el archivo JSON
// se borra cada vez que el servicio se duerme o se vuelve a desplegar.
// Misma interfaz que el almacenamiento en archivo: store.all(), store.update(fn) y fotos save/load/remove.
import pg from 'pg';

const SCHEMA = `
create table if not exists kasac_solicitudes (
  id uuid primary key,
  datos jsonb not null,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create table if not exists kasac_fotos (
  solicitud uuid not null,
  vista text not null,
  imagen bytea not null,
  actualizado timestamptz not null default now(),
  primary key (solicitud, vista)
);`;
const LOCK_KEY = 872341; // bloqueo de aplicación: una modificación a la vez, aunque haya varias instancias

export async function createPgStorage(connectionString, views) {
  const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 30000 });
  await pool.query(SCHEMA);

  const order = "order by (datos->>'createdAt') desc";
  async function all() {
    const { rows } = await pool.query(`select datos from kasac_solicitudes ${order}`);
    return rows.map(r => r.datos);
  }

  /** Igual que el almacenamiento en archivo: fn recibe todas las filas, las modifica y se guardan los cambios. */
  async function update(fn) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock($1)', [LOCK_KEY]);
      const { rows } = await client.query(`select datos from kasac_solicitudes ${order}`);
      const list = rows.map(r => r.datos);
      const before = new Map(list.map(r => [r.id, JSON.stringify(r)]));
      const result = await fn(list);
      const after = new Set();
      for (const row of list) {
        after.add(row.id);
        const json = JSON.stringify(row);
        if (before.get(row.id) === json) continue;
        await client.query(
          'insert into kasac_solicitudes (id, datos, creado) values ($1, $2, coalesce($3::timestamptz, now())) on conflict (id) do update set datos = excluded.datos, actualizado = now()',
          [row.id, json, row.createdAt || null]
        );
      }
      const removed = [...before.keys()].filter(id => !after.has(id));
      if (removed.length) {
        await client.query('delete from kasac_solicitudes where id = any($1::uuid[])', [removed]);
        await client.query('delete from kasac_fotos where solicitud = any($1::uuid[])', [removed]);
      }
      await client.query('commit');
      return result;
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  const photos = {
    async save(id, dataUrls) {
      const saved = [];
      for (const v of views) {
        const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrls?.[v.id] || '');
        if (!m) continue;
        const buf = Buffer.from(m[1], 'base64');
        if (!buf.length || buf.length > 3 * 1024 * 1024) continue;
        await pool.query(
          'insert into kasac_fotos (solicitud, vista, imagen) values ($1, $2, $3) on conflict (solicitud, vista) do update set imagen = excluded.imagen, actualizado = now()',
          [id, v.id, buf]
        );
        saved.push(v.id);
      }
      return saved;
    },
    async load(id) {
      const { rows } = await pool.query('select vista, imagen from kasac_fotos where solicitud = $1', [id]);
      const byView = new Map(rows.map(r => [r.vista, r.imagen]));
      return views.filter(v => byView.has(v.id)).map(v => ({ ...v, buffer: byView.get(v.id) }));
    },
    async remove(id) {
      await pool.query('delete from kasac_fotos where solicitud = $1', [id]);
    }
  };

  return { kind: 'postgres', persistent: true, store: { all, update }, photos, close: () => pool.end() };
}
