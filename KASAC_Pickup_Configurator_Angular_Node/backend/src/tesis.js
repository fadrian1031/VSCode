// Datos de la investigación que usa el módulo de indicadores.
// Salen de la matriz de operacionalización de la tesis: si cambia algo en la matriz, se cambia aquí.
export const tesis = {
  titulo:
    'Sistema web con visualización 3D para la optimización del proceso de aprobación de cotizaciones de equipamiento vehicular en la empresa KASAC, Lima, 2026',
  autores: ['Coyutupa Quispe, Fabio A.', 'Tapara Berrocal, Bryan A.'],
  variable: 'Proceso de aprobación de cotizaciones de equipamiento vehicular',
  // Días de vigencia de una cotización emitida antes de considerarse vencida (sigue contando como pendiente).
  diasVigencia: 30,
  // Con cuántos días de anticipación se avisa que una cotización está por vencer.
  diasAvisoVencimiento: 5,
  indicadores: [
    {
      id: 'pca',
      nombre: 'Porcentaje de cotizaciones aprobadas',
      sigla: 'PCA',
      dimension: 'Resultado del proceso de aprobación',
      formula: 'PCA = (NCA / TC) × 100',
      definiciones: 'NCA = N.º de cotizaciones aprobadas; TC = Total de cotizaciones registradas.',
      unidad: '%',
      meta: 79,
      mejora: 'subir'
    },
    {
      id: 'pcr',
      nombre: 'Porcentaje de cotizaciones rechazadas',
      sigla: 'PCR',
      dimension: 'Resultado del proceso de aprobación',
      formula: 'PCR = (NCR / TC) × 100',
      definiciones: 'NCR = N.º de cotizaciones rechazadas; TC = Total de cotizaciones registradas.',
      unidad: '%',
      meta: 8,
      mejora: 'bajar'
    },
    {
      id: 'pcp',
      nombre: 'Porcentaje de cotizaciones pendientes por aprobar',
      sigla: 'PCP',
      dimension: 'Resultado del proceso de aprobación',
      formula: 'PCP = (NCP / TC) × 100',
      definiciones:
        'NCP = N.º de cotizaciones pendientes por aprobar; TC = Total de cotizaciones registradas.',
      unidad: '%',
      meta: 13,
      mejora: 'bajar'
    },
    {
      id: 'tpa',
      nombre: 'Tiempo promedio de aprobación de cotizaciones',
      sigla: 'TPA',
      dimension: 'Eficiencia temporal del proceso',
      formula: 'TPA = Σ(FA − FE) / n',
      definiciones:
        'FA = Fecha de aprobación; FE = Fecha de emisión; n = N.º de cotizaciones aprobadas con fecha válida.',
      unidad: 'días',
      meta: 18,
      mejora: 'bajar'
    }
  ]
};
