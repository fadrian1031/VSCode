const V = {
  hilux: {
    id: 'hilux-2024',
    code: 'HLX',
    brand: 'Toyota',
    model: 'Hilux',
    year: '2024',
    subtitle: '4x4 Doble Cabina',
    modelPath: '/assets/models/vehicles/toyota_hilux_2024.glb',
    quality: 'detailed',
    accent: '#e8edf2'
  },
  ranger: {
    id: 'ranger-2024',
    code: 'RGR',
    brand: 'Ford',
    model: 'Ranger',
    year: '2024',
    subtitle: 'Doble Cabina',
    modelPath: '/assets/models/vehicles/ford_ranger_2024.glb',
    quality: 'reference',
    accent: '#90a4b8'
  },
  l200: {
    id: 'l200-2024',
    code: 'L200',
    brand: 'Mitsubishi',
    model: 'L200',
    year: '2024',
    subtitle: 'Doble Cabina',
    modelPath: '/assets/models/vehicles/mitsubishi_l200_2024.glb',
    quality: 'reference',
    accent: '#d4d6da'
  }
};
const t = (x, y, z) => ({ x, y, z });
const tr = (p, r = [0, 0, 0], s = [1, 1, 1]) => ({ position: t(...p), rotation: t(...r), scale: t(...s) });
const refSpecs = (vehicle, extra = []) => [
  { label: 'Aplicación', value: `${vehicle.brand} ${vehicle.model} ${vehicle.year}` },
  ...extra,
  { label: 'Espesor', value: 'Por validar con Producción' },
  { label: 'Grado / material', value: 'Por validar con Producción' },
  { label: 'Acabado', value: 'Por validar con Producción' }
];
const f = (vehicle, description, specs, modelPath, placementMode, transform, bounds) => ({
  vehicleId: vehicle.id,
  compatible: true,
  specStatus: 'reference',
  description,
  specs,
  modelPath,
  placementMode,
  transform,
  ...(bounds ? { bounds } : {})
});
const equipmentPath = n => `/assets/models/equipment/${n}`;

export const catalog = {
  vehicles: [V.hilux, V.ranger, V.l200],
  notice:
    'La Hilux usa el modelo detallado trabajado para el prototipo. Ranger y L200 usan modelos 3D referenciales para validar el flujo; deben reemplazarse por GLB autorizados antes de producción. Las fichas técnicas marcadas como referenciales deben ser validadas por Producción/Ingeniería.',
  items: [
    {
      id: 'rollbar-floor-4p',
      code: 'EM-JAU4',
      quoteSection: 'metalica',
      category: 'proteccion',
      name: 'Jaula antivuelco al piso · 4 apoyos',
      shortDescription: 'Montaje fijo en tolva.',
      fitments: [
        {
          ...f(
            V.hilux,
            'Jaula de cuatro apoyos montada al piso de tolva. La posición se mantiene fija por criterio técnico.',
            refSpecs(V.hilux, [
              { label: 'Volumen del modelo 3D', value: '≈ 1517 × 1151 × 864 mm' },
              { label: 'Montaje', value: '4 apoyos al piso de tolva' }
            ]),
            equipmentPath('rollbar_floor_4leg.glb'),
            'fixed',
            tr([0, 0.84, 1.52], [0, 180, 0], [1.07, 1.2, 1.35])
          ),
          specStatus: 'reference'
        },
        {
          vehicleId: V.ranger.id,
          compatible: false,
          specStatus: 'pending',
          description: 'Pendiente desarrollar versión Ranger.',
          specs: [],
          placementMode: 'fixed',
          transform: tr([0, 0, 0])
        },
        {
          vehicleId: V.l200.id,
          compatible: false,
          specStatus: 'pending',
          description: 'Pendiente desarrollar versión L200.',
          specs: [],
          placementMode: 'fixed',
          transform: tr([0, 0, 0])
        }
      ]
    },
    {
      id: 'front-bullbar',
      code: 'EM-DEF',
      quoteSection: 'metalica',
      category: 'proteccion',
      name: 'Defensa delantera minera',
      shortDescription: 'Protección tubular frontal.',
      fitments: [
        f(
          V.hilux,
          'Defensa frontal de referencia para visualizar ubicación y volumen.',
          refSpecs(V.hilux, [{ label: 'Montaje', value: 'Frontal / puntos específicos por vehículo' }]),
          equipmentPath('front_bullbar.glb'),
          'fixed',
          tr([0, 0.74, -2.7])
        ),
        f(
          V.ranger,
          'Configuración referencial adaptada a Ranger para prueba de compatibilidad.',
          refSpecs(V.ranger, [{ label: 'Montaje', value: 'Frontal' }]),
          equipmentPath('front_bullbar.glb'),
          'fixed',
          tr([0, 0.95, -2.9], [0, 0, 0], [1.032, 1.03, 1])
        ),
        f(
          V.l200,
          'Configuración referencial adaptada a L200 para prueba de compatibilidad.',
          refSpecs(V.l200, [{ label: 'Montaje', value: 'Frontal' }]),
          equipmentPath('front_bullbar.glb'),
          'fixed',
          tr([0, 0.9, -2.87], [0, 0, 0], [1, 0.98, 1])
        )
      ]
    },
    {
      id: 'side-steps',
      code: 'EM-EST',
      quoteSection: 'metalica',
      category: 'proteccion',
      name: 'Estribos laterales reforzados',
      shortDescription: 'Acceso y protección lateral.',
      fitments: [
        f(
          V.hilux,
          'Par de estribos laterales. Medidas finales dependen de cabina y puntos de montaje.',
          refSpecs(V.hilux),
          equipmentPath('side_steps.glb'),
          'fixed',
          tr([0, 0.47, -0.28], [0, 0, 0], [0.98, 1, 1])
        ),
        f(
          V.ranger,
          'Par de estribos laterales para Ranger. Ficha pendiente de validación.',
          refSpecs(V.ranger),
          equipmentPath('side_steps.glb'),
          'fixed',
          tr([0, 0.54, 0.11], [0, 0, 0], [1.01, 1, 1.05])
        ),
        f(
          V.l200,
          'Par de estribos laterales para L200. Ficha pendiente de validación.',
          refSpecs(V.l200),
          equipmentPath('side_steps.glb'),
          'fixed',
          tr([0, 0.5, 0.1], [0, 0, 0], [0.98, 1, 1])
        )
      ]
    },
    {
      id: 'roof-rack',
      code: 'EM-PAR',
      quoteSection: 'metalica',
      category: 'utilidad',
      name: 'Parrilla portaequipaje',
      shortDescription: 'Carga superior sobre cabina.',
      fitments: [
        f(
          V.hilux,
          'Parrilla de techo con ajuste limitado para representar diferentes montajes.',
          refSpecs(V.hilux),
          equipmentPath('roof_rack.glb'),
          'bounded',
          tr([0, 1.94, -0.42]),
          { min: t(-0.12, 1.86, -0.62), max: t(0.12, 2.1, -0.18) }
        ),
        f(
          V.ranger,
          'Parrilla referencial para Ranger.',
          refSpecs(V.ranger),
          equipmentPath('roof_rack.glb'),
          'bounded',
          tr([0, 2.06, -0.39], [0, 0, 0], [1.04, 1, 1.03]),
          { min: t(-0.12, 1.96, -0.62), max: t(0.12, 2.18, -0.16) }
        ),
        f(
          V.l200,
          'Parrilla referencial para L200.',
          refSpecs(V.l200),
          equipmentPath('roof_rack.glb'),
          'bounded',
          tr([0, 1.98, -0.37], [0, 0, 0], [1, 1, 0.98]),
          { min: t(-0.12, 1.88, -0.6), max: t(0.12, 2.1, -0.14) }
        )
      ]
    },
    {
      id: 'beacon',
      code: 'SE-CIR',
      quoteSection: 'electrico',
      category: 'iluminacion',
      name: 'Circulina / baliza LED',
      shortDescription: 'Iluminación de seguridad configurable.',
      fitments: [
        f(
          V.hilux,
          'Baliza de referencia. La posición puede ajustarse dentro de la zona superior.',
          refSpecs(V.hilux, [{ label: 'Ubicación', value: 'Techo / parrilla / soporte aprobado' }]),
          equipmentPath('beacon.glb'),
          'bounded',
          tr([0, 1.98, -0.18], [0, 0, 0], [0.58, 0.58, 0.58]),
          { min: t(-0.7, 1.85, -0.7), max: t(0.7, 2.25, 0.65) }
        ),
        f(
          V.ranger,
          'Baliza de referencia para Ranger.',
          refSpecs(V.ranger),
          equipmentPath('beacon.glb'),
          'bounded',
          tr([0, 1.97, -0.25], [0, 0, 0], [0.58, 0.58, 0.58]),
          { min: t(-0.75, 1.85, -0.75), max: t(0.75, 2.25, 0.65) }
        ),
        f(
          V.l200,
          'Baliza de referencia para L200.',
          refSpecs(V.l200),
          equipmentPath('beacon.glb'),
          'bounded',
          tr([0, 1.89, -0.24], [0, 0, 0], [0.58, 0.58, 0.58]),
          { min: t(-0.7, 1.78, -0.72), max: t(0.7, 2.18, 0.62) }
        )
      ]
    },
    {
      id: 'led-worklight',
      code: 'SE-FAR',
      quoteSection: 'electrico',
      category: 'iluminacion',
      name: 'Faro LED auxiliar',
      shortDescription: 'Faro desplazable para explorar ubicaciones solicitadas.',
      fitments: [
        f(
          V.hilux,
          'Faro LED demostrativo. El usuario puede moverlo dentro de una zona amplia de instalación para comunicar la ubicación deseada.',
          refSpecs(V.hilux, [
            { label: 'Medidas del modelo 3D demo', value: '280 × 90 × 120 mm' },
            { label: 'Potencia', value: 'Por validar según producto real' }
          ]),
          equipmentPath('faro_led.glb'),
          'bounded',
          tr([-0.55, 1.87, -0.45]),
          { min: t(-1.05, 0.55, -2.7), max: t(1.05, 2.3, 0.8) }
        ),
        f(
          V.ranger,
          'Faro LED demostrativo con posición ajustable.',
          refSpecs(V.ranger, [
            { label: 'Medidas del modelo 3D demo', value: '280 × 90 × 120 mm' },
            { label: 'Potencia', value: 'Por validar según producto real' }
          ]),
          equipmentPath('faro_led.glb'),
          'bounded',
          tr([-0.58, 1.94, -0.45]),
          { min: t(-1.1, 0.58, -2.75), max: t(1.1, 2.38, 0.85) }
        ),
        f(
          V.l200,
          'Faro LED demostrativo con posición ajustable.',
          refSpecs(V.l200, [
            { label: 'Medidas del modelo 3D demo', value: '280 × 90 × 120 mm' },
            { label: 'Potencia', value: 'Por validar según producto real' }
          ]),
          equipmentPath('faro_led.glb'),
          'bounded',
          tr([-0.55, 1.85, -0.42]),
          { min: t(-1.05, 0.55, -2.7), max: t(1.05, 2.25, 0.78) }
        )
      ]
    },
    {
      id: 'toolbox',
      code: 'EQ-CAJ',
      quoteSection: 'equipamiento',
      category: 'utilidad',
      name: 'Caja de herramientas en tolva',
      shortDescription: 'Almacenamiento transversal.',
      fitments: [
        f(
          V.hilux,
          'Caja demostrativa con movimiento limitado dentro de la tolva.',
          refSpecs(V.hilux),
          equipmentPath('toolbox.glb'),
          'bounded',
          tr([0, 1.03, 1.18]),
          { min: t(-0.22, 0.92, 0.7), max: t(0.22, 1.2, 2.08) }
        ),
        f(
          V.ranger,
          'Caja demostrativa con movimiento limitado dentro de la tolva Ranger.',
          refSpecs(V.ranger),
          equipmentPath('toolbox.glb'),
          'bounded',
          tr([0, 1.09, 0.82], [0, 0, 0], [1.04, 1, 1]),
          { min: t(-0.22, 0.98, 0.6), max: t(0.22, 1.26, 2.05) }
        ),
        f(
          V.l200,
          'Caja demostrativa con movimiento limitado dentro de la tolva L200.',
          refSpecs(V.l200),
          equipmentPath('toolbox.glb'),
          'bounded',
          tr([0, 1.04, 0.77]),
          { min: t(-0.22, 0.92, 0.58), max: t(0.22, 1.22, 2.0) }
        )
      ]
    },
    {
      id: 'snorkel',
      code: 'EQ-SNK',
      quoteSection: 'equipamiento',
      category: 'utilidad',
      name: 'Snorkel lateral',
      shortDescription: 'Admisión elevada.',
      fitments: [
        f(
          V.hilux,
          'Ubicación de referencia fija por geometría del vehículo.',
          refSpecs(V.hilux),
          equipmentPath('snorkel.glb'),
          'fixed',
          tr([0.98, 0.82, -1.18])
        ),
        f(
          V.ranger,
          'Ubicación referencial del snorkel Ranger.',
          refSpecs(V.ranger),
          equipmentPath('snorkel.glb'),
          'fixed',
          tr([1.02, 1.1, -0.94], [0, 0, 0], [1, 1.04, 1])
        ),
        f(
          V.l200,
          'Ubicación referencial del snorkel L200.',
          refSpecs(V.l200),
          equipmentPath('snorkel.glb'),
          'fixed',
          tr([0.98, 1.03, -0.9], [0, 0, 0], [1, 0.98, 1])
        )
      ]
    }
  ],
  // Colores para visualizar la unidad del cliente. Nombres genéricos: el tono exacto se confirma con Comercial.
  paints: [
    { id: 'blanco', name: 'Blanco', color: '#e9ecef' },
    { id: 'plata', name: 'Plata metálico', color: '#b4bac2' },
    { id: 'gris', name: 'Gris oscuro', color: '#4b5058' },
    { id: 'negro', name: 'Negro', color: '#16181b' },
    { id: 'rojo', name: 'Rojo', color: '#8f1d22' },
    { id: 'azul', name: 'Azul', color: '#1f3f73' },
    { id: 'naranja', name: 'Naranja seguridad', color: '#e2611b' }
  ],
  interiorMaterials: [
    {
      id: 'ecocuero',
      name: 'Ecocuero',
      description: 'Acabado demostrativo de ecocuero. Textura real pendiente de muestra KASAC.',
      color: '#34373a',
      roughness: 0.52
    },
    {
      id: 'tela',
      name: 'Tela',
      description: 'Acabado demostrativo de tela. Textura real pendiente de muestra KASAC.',
      color: '#555a5e',
      roughness: 0.92
    },
    {
      id: 'pranna',
      name: 'Pranna',
      description: 'Acabado demostrativo de pranna. Textura real pendiente de muestra KASAC.',
      color: '#675f58',
      roughness: 0.82
    },
    {
      id: 'premium',
      name: 'Nuevo / premium',
      description: 'Espacio para un acabado nuevo definido por la empresa.',
      color: '#20252b',
      roughness: 0.48
    }
  ],
  graphics: [
    {
      id: 'kasac-vinyl',
      code: 'ST-VIN',
      type: 'sticker',
      name: 'Vinil corporativo KASAC',
      description: 'Sticker demostrativo con ancho y alto configurables en centímetros.',
      defaultWidthCm: 60,
      defaultHeightCm: 22,
      color: '#0b5cab'
    },
    {
      id: 'unit-number',
      code: 'ST-NUM',
      type: 'sticker',
      name: 'Numeración de unidad',
      description: 'Marcación demostrativa de unidad. Tamaño configurable.',
      defaultWidthCm: 32,
      defaultHeightCm: 18,
      color: '#111827'
    },
    {
      id: 'reflective-yellow',
      code: 'ST-REF-AM',
      type: 'reflective',
      name: 'Cinta reflectiva amarilla',
      description: 'Trazo continuo sobre carrocería. La longitud registrada se calcula en metros.',
      defaultWidthCm: 80,
      defaultHeightCm: 5,
      color: '#f7d21e'
    },
    {
      id: 'reflective-red',
      code: 'ST-REF-RO',
      type: 'reflective',
      name: 'Cinta reflectiva roja',
      description: 'Trazo continuo sobre carrocería. La longitud registrada se calcula en metros.',
      defaultWidthCm: 80,
      defaultHeightCm: 5,
      color: '#e53935'
    }
  ]
};
