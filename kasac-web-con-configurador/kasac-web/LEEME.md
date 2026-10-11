# Nueva web KASAC

## Estructura
```
kasac-web/
├── index.html        Inicio (portada, vehículos, bloque configurador 3D, líneas)
├── productos.html    Todos los tipos de vehículo
├── pickup.html  suv.html  camiones.html  panel.html  autos.html  motos.html
├── servicios.html    Líneas de producto + servicio PDI
├── nosotros.html
├── contacto.html     Formulario (WhatsApp / correo) + mapa
├── configurador.html Configurador 3D integrado (cabecera de la web + app 3D)
├── configurador-app/ App 3D compilada (no editar a mano, ver abajo)
├── css/styles.css    Estilos de todo el sitio
├── js/main.js        Menú, formulario, configurador, datos de contacto
├── js/productos.js   Catálogo de productos por vehículo
├── .htaccess         Hosting Linux (Apache): URLs limpias y redirecciones
└── web.config        Hosting Windows (IIS): lo mismo que .htaccess
```

## Para publicar
1. Copia estas carpetas a la raíz del hosting junto a las carpetas actuales `img/` y `file/`
   (las imágenes y el catálogo se reutilizan con las mismas rutas).
2. Configurador 3D: la app necesita su API Node (proyecto KASAC_Pickup_Configurator, `npm run start:public`).
   Cambia `apiBaseUrl` en `configurador-app/config.js` por la dirección real de esa API.
3. Usa `.htaccess` si el hosting es Linux o `web.config` si es Windows (borra el que no uses).
4. Los modelos 3D (`.glb`) están comprimidos con meshopt y se decodifican con WebAssembly. Si el hosting
   agrega una cabecera Content-Security-Policy, debe permitir `script-src 'self' 'wasm-unsafe-eval'`.

## Imágenes que puede cambiar
| Archivo | Dónde se ve | Recomendación |
|---|---|---|
| `img/web/portada.jpg` | Portada del inicio (derecha) | Foto horizontal de una unidad equipada, mínimo 1600 px de ancho |
| `img/web/configurador.jpg` | Bloque "Configurador 3D" del inicio y de Pick up | Captura del configurador, proporción 16:10 |
| `img/home-about.jpg` | Página Nosotros | Foto del taller (ya existe en el hosting actual) |
| `img/productos/<carpeta>/<archivo>.png` | Tarjetas de vehículos y productos | Las del hosting actual |

Reemplace el archivo manteniendo el mismo nombre. Si una imagen falta, la página muestra un recuadro gris neutro en su lugar.
Las imágenes incluidas por defecto se generaron con el propio configurador 3D.

## Tipografía
Barlow y Barlow Condensed están en `fonts/` (licencia SIL Open Font License, `fonts/OFL.txt`).
No dependen de Google Fonts, así que la web se ve igual sin Internet.

## Mantenimiento
- Menú, pie y textos de las páginas: `../herramientas/generar_paginas.py` (ver instrucciones dentro del archivo).
- Agregar un producto: edita `js/productos.js` y sube la imagen a `img/productos/<carpeta>/`.
- Cambiar teléfono, WhatsApp o correo: `js/main.js` (objeto `KASAC`) y la barra superior de cada página.
- Las URLs antiguas (/Nosotros, /PickUp, /MotosCorporativas...) redirigen a las nuevas.

## Configurador 3D
- `configurador.html` muestra la cabecera de la web y, debajo, la app 3D (`configurador-app/`) en un iframe.
- La app se genera desde el proyecto KASAC_Pickup_Configurator con `npm run build:web` y se copia
  el contenido de `frontend/dist/kasac-configurator-web/browser/` en `configurador-app/`
  (conserva tu `config.js` si ya le cambiaste la URL de la API).
- Es la versión pública: los clientes arman y envían su configuración; la gestión de solicitudes
  queda solo en la versión interna del área comercial.
- En la API, define `PUBLIC_REQUEST_URL=https://www.kasac.pe/configurador#/solicitud/{token}` para que
  el enlace que recibe el cliente abra su configuración dentro de esta web.
