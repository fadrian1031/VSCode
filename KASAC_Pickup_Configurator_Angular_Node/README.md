# KASAC · Web, configurador 3D y Área Comercial

Sistema completo del nuevo flujo comercial de KASAC, en un solo servidor:

1. **Cliente** entra a la web de KASAC (`/`), abre el **Configurador 3D**, personaliza su camioneta (color, accesorios) y envía la solicitud. **No ve precios.**
2. **Área Comercial** (`/comercial`, pestaña interna con login que el cliente no ve) recibe la solicitud, negocia y **cotiza** por secciones: *Equipamiento · Sistema eléctrico · Estructura metálica · Stickers*.
3. Comercial descarga la cotización en **PDF formal** (para el cliente) o en **Excel** con el formato de Grupo KA (para pasarla a otro sistema).
4. Si todo sale bien, **aprueba** la cotización: queda bloqueada y muestra el detalle con el modelo 3D y las **fotos de cada lado** del vehículo.

## Stack

- Frontend: Angular + TypeScript + Three.js (modelos GLB comprimidos con meshopt, raycast con three-mesh-bvh)
- Backend: Node.js + Express
- Persistencia demo: JSON (`backend/data/requests.json`)
- Modelos: GLB/glTF
- PDF: pdfkit · Excel: exceljs
- Producción: un solo servidor Node publica la web KASAC, el configurador, el Área Comercial y la API.

## Funciones incluidas

### Sitio del cliente
- Web KASAC (inicio, productos por vehículo, servicios, nosotros, contacto) con el configurador 3D integrado.
- Vehículos iniciales: Toyota Hilux, Ford Ranger y Mitsubishi L200.
- Hilux con el modelo detallado trabajado previamente.
- Ranger/L200 con modelos 3D de referencia para probar el flujo.
- Catálogo separado por Protección, Iluminación y Utilidad.
- Ficha específica por vehículo y campo de estado de validación técnica.
- Agregar componentes individualmente.
- Eliminar un componente sin borrar el resto.
- **Deshacer** la última acción.
- Accesorios fijos cuando la posición debe ser técnica.
- Accesorios ajustables con mover / girar / escala cuando corresponde.
- Faro LED demostrativo ajustable.
- Viniles con ancho y alto reales en centímetros.
- Reflectivos trazados sobre carrocería con longitud calculada en metros.
- Vista exterior e interior demostrativa.
- Acabados interiores: ecocuero, tela, pranna y premium.
- Color de la unidad (pintura con barniz y reflejos de estudio); se guarda en la solicitud.
- Vistas frontal, laterales, posterior y 3/4 encuadradas al vehículo; rotación automática.
- Descarga de imagen PNG de la configuración.
- Atajos: W/E/R mover/girar/escalar, Supr eliminar, Esc soltar selección, Ctrl+Z deshacer.
- Datos finales: empresa o persona.
- El cliente **no ve precios**: genera una solicitud para Comercial.
- Enlace público 3D en modo lectura después del envío (se abre dentro de la web).

### Área Comercial (`/comercial`)
- Login interno; app separada que no se enlaza desde la web pública.
- Bandeja con buscador, contadores y monto cotizado por solicitud.
- Estados: Nueva, Contactado, Negociando, Cotizada, Aprobada, Perdida.
- Cotización por secciones con totales e IGV, PDF formal, Excel con el formato de Grupo KA y aprobación.
- Fotos de cada lado del vehículo, tomadas desde el visor 3D.
- Datos completos del cliente.
- Vehículo y accesorios seleccionados.
- Fichas técnicas incluidas en el snapshot.
- Viniles/reflectivos y sus medidas.
- Visor 3D de solo lectura.
- Vista exterior / interior.
- Notas internas comerciales.

## Credenciales demo de Comercial

- Dirección: `http://localhost:3000/comercial`
- Correo: `comercial@kasac.pe`
- Contraseña: `Kasac2026!`

Para producción, cree `backend/.env` a partir de `backend/.env.example` y cambie estas credenciales.
Con `NODE_ENV=production` el servidor **no arranca** si `SESSION_SECRET` o `COMMERCIAL_PASSWORD` siguen con los valores demo.

---

## Iniciar

Requisito: Node.js 22+ y acceso a Internet la primera vez (descarga de paquetes npm).

**Windows:** doble clic en `INICIAR_KASAC.bat` (carpeta raíz). Revisa la PC, instala dependencias, compila la primera vez y abre el navegador. Si hay errores: `docs/SOLUCION_PROBLEMAS.md`.

**A mano (cualquier sistema):**

```bash
npm install
npm run build     # compila el configurador de la web y el Área Comercial
npm start
```

| Dirección | Qué es |
|---|---|
| `http://localhost:3000/` | Web KASAC (la que ve el cliente) |
| `http://localhost:3000/configurador` | Configurador 3D dentro de la web |
| `http://localhost:3000/comercial` | Área Comercial (solo personal, con login) |

Después de cambiar código, vuelva a ejecutar `npm run build` antes de `npm start`.

### Desarrollo con recarga automática

```bash
npm run dev
```

Angular en `http://localhost:4200` (configurador + `/comercial`) y la API en `3000`. Para revisar la web completa use `npm run build && npm start`.

---

## Flujo comercial y cotizaciones

| Estado | Cómo se llega |
|---|---|
| Nueva | El cliente envía su configuración |
| Contactado / Negociando / Perdida | Comercial lo elige en la pestaña *Solicitud* |
| Cotizada | Al guardar la cotización |
| Aprobada | Botón *Aprobar cotización* (queda bloqueada; *Reabrir* la devuelve a Cotizada) |

- La cotización se prellena con lo que eligió el cliente: una línea por accesorio (las luces repetidas se agrupan), en su sección, con código (`EM-JAU4-HLX`, `SE-CIR-HLX`…) y descripción.
- Columnas iguales al formato de Grupo KA: Código, Cant. vehíc., Cantidad, Descripción, Precio, Dscto %, Total (= cant. vehíc. × cantidad × precio × (1 − dscto)). Subtotal, IGV 18 % y total con monto en letras.
- **Fotos:** al guardar por primera vez se toman 6 vistas del modelo 3D (3/4 frontal, frontal, laterales, posterior, 3/4 posterior). Se pueden volver a tomar.
- **PDF:** cabecera de Grupo KA, datos del cliente y del vehículo, detalle por sección, totales, términos, garantía, cuentas bancarias y anexo con las fotos.
- **Excel:** hoja *Cotización* con el formato de la empresa y fórmulas reales; hoja *Detalle* (tabla plana para importar a otro sistema); hoja *Fotos*.
- Datos de la empresa (RUC, dirección, cuentas, términos): `backend/src/empresa.js`.
- Precios de referencia para prellenar: `backend/src/precios.js` (solo servidor; en 0, Comercial los ingresa). Nunca se envían al cliente.

---

## Hosting

El backend es Node.js, así que necesita un hosting que ejecute Node (Render, un VPS o un contenedor Docker); un hosting solo PHP como InfinityFree no sirve. Los pasos para Render están en `docs/DESPLIEGUE.md`.

---

## Datos técnicos reales

El sistema ya soporta una ficha distinta para cada accesorio + vehículo. Sin embargo, no se inventaron espesores, grados o medidas de fabricación que la empresa todavía no proporcionó.

Los campos marcados como **Datos referenciales** o **Por validar con Producción** deben reemplazarse por las fichas reales en:

`backend/src/catalog.js`

La jaula Hilux incluye la envolvente aproximada del modelo 3D utilizado, pero eso no sustituye una ficha de ingeniería.

---

## Pruebas

```bash
npm test --workspace backend
```

Cubre envíos simultáneos, saneamiento de la configuración contra el catálogo, enlace público sin datos personales, login con límite de intentos, archivo de datos dañado y arranque en producción sin credenciales demo. La lista de prueba manual del visor está en `docs/QA.md`.

---

## Persistencia

- Con `DATABASE_URL` definida, solicitudes, cotizaciones y fotos se guardan en PostgreSQL (`backend/src/storage-pg.js`).
- Sin ella se usa el archivo `backend/data/requests.json` (`backend/src/store.js`), útil para probar en local.

Las solicitudes sin cotizar se borran a los `RETENTION_DAYS` días (30 por defecto).

---

## Formato del código

El código se formatea con [Prettier](https://prettier.io) (configuración en `.prettierrc.json`, en la raíz del repositorio):

```bash
npx prettier --write "KASAC_Pickup_Configurator_Angular_Node/frontend/src/**/*.{ts,html,css}" "KASAC_Pickup_Configurator_Angular_Node/backend/**/*.js"
```

---

## Imágenes de la interfaz

- `frontend/public/assets/img/portada.jpg`: portada de la página de inicio de la app.
- `frontend/public/assets/img/vehiculos/<id>.jpg` (`hilux-2024`, `ranger-2024`, `l200-2024`): fotos de las tarjetas para elegir vehículo.

Puede reemplazarlas por fotos propias con el mismo nombre (horizontales, proporción 16:10). Si falta una, la tarjeta se muestra sin foto.
Las incluidas se generaron con el visor 3D del propio configurador.

## Diseño

La interfaz usa la paleta de KASAC (grafito `#232834`, azul `#1C85D1`, blanco) y las fuentes Barlow / Barlow Condensed incluidas en `frontend/src/fonts` (sin dependencia de Internet). Las variables están en `frontend/src/styles.css`.

---

## Modelos 3D

`frontend/public/assets/models/vehicles/`

- `toyota_hilux_2024.glb` — modelo detallado del prototipo.
- `ford_ranger_2024.glb` — referencia de prueba.
- `mitsubishi_l200_2024.glb` — referencia de prueba.

`frontend/public/assets/models/equipment/`

Contiene jaula, defensa, estribos, parrilla, caja, snorkel, baliza y faro LED demo.

Antes de uso comercial definitivo revisa las licencias de los modelos obtenidos de terceros.

### Agregar o reemplazar un modelo

Los GLB están comprimidos con **meshopt** (Hilux: 8,8 MB → 1,6 MB, sin simplificar la geometría). Comprime cada modelo nuevo antes de copiarlo:

```bash
npx @gltf-transform/cli meshopt modelo.glb modelo-optimizado.glb --level medium
```

Notas para que el visor lo reconozca bien:

- Orientación: frente del vehículo hacia **-Z**, ruedas apoyadas en **y = 0**, unidades en metros.
- Carrocería pintable: material con `body` o `paint` en el nombre, o mallas `body*`, `hood*`, `cabin*`, `roof*`, `bed_side*`, `tailgate*`, `door*`.
- Las mallas `ANCHOR_*` se tratan como marcadores de montaje: se ocultan y no reciben clics.
- El decodificador meshopt usa WebAssembly: si el hosting define una política CSP propia, debe incluir `script-src 'self' 'wasm-unsafe-eval'` (el servidor Node ya la envía).
