# Cómo completar las fichas reales de KASAC

Archivo: `backend/src/catalog.js`

Cada producto contiene `fitments`, uno por vehículo. Por eso una defensa puede tener datos distintos en Hilux, Ranger y L200.

Ejemplo conceptual:

```js
{
  vehicleId: 'hilux-2024',
  description: 'Defensa ...',
  specs: [
    { label: 'Tubo principal', value: 'Dato real KASAC' },
    { label: 'Espesor', value: 'Dato real KASAC' },
    { label: 'Grado', value: 'Dato real KASAC' },
    { label: 'Acabado', value: 'Dato real KASAC' }
  ]
}
```

No uses medidas estimadas como definitivas. Valida con Producción/Ingeniería y cambia `specStatus` a `verified` cuando la ficha esté aprobada.
