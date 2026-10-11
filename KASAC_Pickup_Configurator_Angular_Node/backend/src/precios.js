// Lista de precios de referencia (sin IGV) para prellenar la cotización. Solo la usa el servidor en el
// Área Comercial: nunca se envía al cliente ni aparece en /api/catalog.
// Complete con los precios vigentes de KASAC. Con 0, Comercial ingresa el precio al cotizar.
// Formato: { <id de catálogo>: precio general, o { default: precio, '<id de vehículo>': precio } }
export const precios = {
  'rollbar-floor-4p': 0,
  'front-bullbar': 0,
  'side-steps': 0,
  'roof-rack': 0,
  beacon: 0,
  'led-worklight': 0,
  toolbox: 0,
  snorkel: 0,
  'kasac-vinyl': 0, // por unidad
  'unit-number': 0, // por unidad
  'reflective-yellow': 0, // por metro
  'reflective-red': 0 // por metro
};

export function precioDe(id, vehicleId) {
  const p = precios[id];
  if (typeof p === 'number') return p;
  if (p && typeof p === 'object') return p[vehicleId] ?? p.default ?? 0;
  return 0;
}
