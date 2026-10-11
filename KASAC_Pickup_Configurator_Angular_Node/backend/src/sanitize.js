// Reconstruye en el servidor la configuración enviada por el cliente a partir del catálogo.
// Del navegador solo se aceptan identificadores, números acotados y textos cortos; todo lo demás
// (nombres, fichas, rutas de modelos 3D, límites) sale del catálogo. Así nadie puede guardar una
// solicitud que cargue modelos desde otra dirección o muestre fichas técnicas alteradas a Comercial.
// El resultado sigue siendo un snapshot: conserva el catálogo tal como estaba al momento del envío.

const MAX_ACCESSORIES = 40;
const MAX_GRAPHICS = 60;
const MAX_LINE_POINTS = 400;
const HEX = /^#[0-9a-f]{6}$/i;
const INTERIOR_CAMERAS = ['driver', 'passenger', 'rear-left', 'rear-center', 'rear-right', 'free'];

const text = (v, max = 1000) =>
  String(v ?? '')
    .trim()
    .slice(0, max);
const num = (v, min, max, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const vec = (v, min, max, fallback = 0) => ({
  x: num(v?.x, min, max, fallback),
  y: num(v?.y, min, max, fallback),
  z: num(v?.z, min, max, fallback)
});
const clone = v => structuredClone(v);

function transformFor(fitment, t) {
  // Las piezas de montaje fijo conservan la posición técnica del catálogo.
  if (fitment.placementMode === 'fixed') return clone(fitment.transform);
  const b = fitment.bounds;
  const position = vec(t?.position, -10, 10);
  if (b) {
    position.x = num(position.x, b.min.x, b.max.x);
    position.y = num(position.y, b.min.y, b.max.y);
    position.z = num(position.z, b.min.z, b.max.z);
  }
  return { position, rotation: vec(t?.rotation, -360, 360), scale: vec(t?.scale, 0.5, 2, 1) };
}

function accessories(list, catalog, vehicleId) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const a of list.slice(0, MAX_ACCESSORIES)) {
    const item = catalog.items.find(i => i.id === a?.catalogItemId);
    const fitment = item?.fitments.find(f => f.vehicleId === vehicleId && f.compatible);
    if (!item || !fitment) continue;
    out.push({
      instanceId: text(a.instanceId, 64) || crypto.randomUUID(),
      catalogItemId: item.id,
      name: item.name,
      fitment: clone(fitment),
      transform: transformFor(fitment, a.transform),
      addedAt: num(a.addedAt, 0, Number.MAX_SAFE_INTEGER, Date.now())
    });
  }
  return out;
}

function graphics(list, catalog) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const g of list.slice(0, MAX_GRAPHICS)) {
    const preset = catalog.graphics.find(p => p.id === g?.presetId);
    if (!preset) continue;
    const base = {
      instanceId: text(g.instanceId, 64) || crypto.randomUUID(),
      presetId: preset.id,
      type: preset.type,
      name: preset.name,
      widthCm: num(g.widthCm, 1, 300, preset.defaultWidthCm),
      heightCm: num(g.heightCm, 1, 300, preset.defaultHeightCm),
      color: preset.color,
      position: vec(g.position, -10, 10),
      normal: vec(g.normal, -1, 1),
      rotation: num(g.rotation, -360, 360)
    };
    if (preset.type === 'reflective') {
      const points = (Array.isArray(g.points) ? g.points : [])
        .slice(0, MAX_LINE_POINTS)
        .map(p => vec(p, -10, 10));
      if (points.length < 2) continue;
      let length = 0;
      for (let i = 1; i < points.length; i++)
        length += Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
          points[i].z - points[i - 1].z
        );
      out.push({ ...base, points, lengthM: +length.toFixed(3) });
    } else out.push(base);
  }
  return out;
}

function interior(v, catalog) {
  const material = catalog.interiorMaterials.find(m => m.id === v?.materialId);
  if (!material) return undefined;
  return {
    materialId: material.id,
    color: HEX.test(v.color) ? v.color : material.color,
    camera: INTERIOR_CAMERAS.includes(v.camera) ? v.camera : 'driver'
  };
}

/** Devuelve la configuración saneada o un texto de error. */
export function sanitizeConfiguration(config, catalog) {
  const vehicle = catalog.vehicles.find(v => v.id === config?.vehicle?.id);
  if (!vehicle) return { error: 'Vehículo no válido.' };
  const paint = catalog.paints?.find(p => p.id === config.paint?.id);
  const inside = interior(config.interior, catalog);
  return {
    configuration: {
      vehicle: clone(vehicle),
      ...(paint ? { paint: clone(paint) } : {}),
      accessories: accessories(config.accessories, catalog, vehicle.id),
      graphics: graphics(config.graphics, catalog),
      ...(inside ? { interior: inside } : {}),
      notes: text(config.notes, 2000)
    }
  };
}
