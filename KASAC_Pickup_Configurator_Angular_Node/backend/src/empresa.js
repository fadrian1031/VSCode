// Datos del emisor que aparecen en la cotización (PDF y Excel).
//
// ENTORNO DE PRUEBAS: todos los datos son ficticios a propósito (RUC, dirección, teléfonos,
// correo y cuentas bancarias), para poder enseñar el sistema sin usar información real de la empresa.
// Cuando el sistema pase a producción, reemplace estos valores por los oficiales y ponga
// COTIZACION_PRUEBA=false en el entorno para quitar la marca "Documento de prueba".
export const empresa = {
  modoPrueba: process.env.COTIZACION_PRUEBA !== 'false',
  razonSocial: 'KASAC · ENTORNO DE PRUEBAS',
  ruc: '20000000001',
  direccion: 'Av. Demostración 123, Lima (dirección de prueba)',
  telefonos: '(01) 000 0000 · 900 000 000',
  correo: 'cotizaciones.test@example.com',
  web: 'configurador-kasac.test',
  introduccion:
    'Gracias por elegirnos. Según la configuración que nos envió desde el configurador 3D, le presentamos la siguiente propuesta:',
  terminos: [
    'Precios expresados sin IGV; el impuesto se detalla en el resumen.',
    'Propuesta válida por {validez} días calendario desde su emisión.',
    '{entrega}',
    'Las medidas y la ubicación final de cada accesorio se validan en taller antes de la instalación.'
  ],
  garantia: [
    'Estructuras metálicas: 12 meses por defectos de fabricación.',
    'Accesorios y sistema eléctrico: 6 meses por defectos de fabricación.',
    'No cubre desgaste normal, golpes ni modificaciones hechas por terceros.'
  ],
  cuentas: [
    {
      banco: 'Banco de Prueba',
      tipo: 'Cta. corriente',
      moneda: 'Soles',
      numero: '000-0000000-0-00',
      cci: '000-000-000000000000-00'
    },
    {
      banco: 'Banco de Prueba',
      tipo: 'Cta. corriente',
      moneda: 'Dólares',
      numero: '000-0000000-1-00',
      cci: '000-000-000000000001-00'
    }
  ],
  cierre:
    'Ante cualquier duda sobre esta propuesta, responda al correo de contacto o escríbanos por WhatsApp.'
};
