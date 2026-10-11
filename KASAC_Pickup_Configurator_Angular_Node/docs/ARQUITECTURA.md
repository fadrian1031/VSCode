# Arquitectura

```text
Cliente / Comercial
       |
       v
Angular + Three.js
       |
       | HTTP JSON
       v
Node.js / Express
       |
       +-- Catálogo
       +-- Solicitudes
       +-- Enlaces públicos
       +-- Autenticación comercial
       |
       v
JSON (demo) / MySQL o PostgreSQL (producción)
```

## Principio principal

El configurador guarda un **snapshot de lo que armó el cliente**. Si luego se cambia el catálogo, la solicitud ya recibida mantiene las descripciones, transformaciones y medidas originales.

## Tipos de colocación 3D

- `fixed`: posición técnica fija; el cliente no puede moverla.
- `bounded`: puede moverse/girarse/escalarse dentro de límites definidos para ese vehículo.
- `free`: preparado para futuros elementos de colocación más abierta.

## Gráfica

- Sticker/vinil: decal proyectado sobre la malla con medida en cm.
- Reflectivo: trazo continuo muestreado sobre la superficie; almacena longitud en metros.

## Responsive

El configurador usa `100dvh` y evita scroll global en escritorio. El catálogo y el resumen tienen scroll interno. Debajo de 1180 px los paneles pasan a drawers y aparece navegación inferior. En pantallas pequeñas se prioriza el visor y los paneles se abren de forma superpuesta para evitar deformar el canvas.

## Visor 3D

- Render bajo demanda: solo se dibuja cuando cambia la cámara o la escena; las sombras se recalculan solo al cambiar la escena.
- Caché de modelos por URL: cada uso recibe un clon que comparte geometría.
- Iluminación por imagen (`RoomEnvironment`) y pintura `MeshPhysicalMaterial` con clearcoat.
- Raycast acelerado con BVH (`three-mesh-bvh`) para colocar gráfica sobre la carrocería.
- El backend reconstruye la configuración desde el catálogo (`backend/src/sanitize.js`): del navegador solo se aceptan ids, números acotados y textos cortos.
