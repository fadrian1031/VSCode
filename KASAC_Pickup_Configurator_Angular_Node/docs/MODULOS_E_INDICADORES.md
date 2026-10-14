# Módulos e indicadores

Variable independiente: **sistema web con visualización 3D**.
Variable dependiente: **proceso de aprobación de cotizaciones de equipamiento vehicular**, medida con cuatro
indicadores (matriz de operacionalización). Los cuatro se calculan en el servidor con los datos guardados en la
base de datos; nada se escribe a mano.

## Ciclo de una cotización

| Paso | Quién | Estado de la cotización | Dato que se guarda |
|---|---|---|---|
| Arma su camioneta en el configurador 3D y envía la solicitud | Cliente | — | fecha de la solicitud |
| Prepara la cotización y la guarda | Comercial | Borrador | número, versión |
| Emite y envía el enlace o el PDF | Comercial | Pendiente por aprobar | **FE** (fecha de emisión) |
| Aprueba desde su enlace (o Comercial registra la aprobación recibida por correo) | Cliente | Aprobada | **FA** (fecha de aprobación) |
| No aprueba e indica el motivo | Cliente | Rechazada | fecha y motivo |

- Una cotización pendiente vence a los 30 días de emitida (`backend/src/tesis.js`). Sigue contando como pendiente,
  pero aparece un aviso 5 días antes y otro cuando ya venció, y en la bandeja queda resaltada.
- Una cotización aprobada o rechazada ya no se edita. Si se registró una respuesta por error, solo el administrador
  puede anularla, indicando el motivo (queda en el historial).

## Indicadores

| Indicador | Fórmula | Cómo lo calcula el sistema (`backend/src/indicadores.js`) |
|---|---|---|
| PCA | (NCA / TC) × 100 | aprobadas ÷ todas las cotizaciones registradas |
| PCR | (NCR / TC) × 100 | rechazadas ÷ todas las cotizaciones registradas |
| PCP | (NCP / TC) × 100 | ni aprobadas ni rechazadas (borradores y emitidas sin respuesta) ÷ todas |
| TPA | Σ(FA − FE) / n | promedio de días entre emisión y aprobación; solo aprobadas con FE y FA válidas |

TC = total de cotizaciones registradas (incluye borradores), así que PCA + PCR + PCP = 100 %.

- **Pre-prueba**: cotizaciones anteriores al sistema, importadas en el módulo *Histórico* (plantilla Excel con
  número, cliente, fecha de emisión, estado, fecha de aprobación y observación).
- **Post-prueba**: cotizaciones gestionadas con el sistema; se puede filtrar por período (desde / hasta).
- **Metas** (79 %, 8 %, 13 % y 18 días): en `backend/src/tesis.js`.
- **Fichas de observación**: el botón de cada prueba descarga un Excel con el formato de los Anexos 3 a 6
  (una fila por cotización con valor 1/0 y el resultado calculado con fórmulas de Excel).

## Módulos

| Módulo | Pantalla | Código principal |
|---|---|---|
| Configurador 3D y solicitud | web `/configurador` | `frontend/src/app/pages/configurator`, `components/three-viewer` |
| Solicitudes (bandeja e historial) | `/comercial` | `pages/commercial-dashboard`, `pages/commercial-detail`, `backend/src/server.js` |
| Cotizaciones (emisión, PDF, Excel) | detalle › Cotización | `backend/src/quotes.js`, `pdf.js`, `excel.js` |
| Aprobación del cliente | enlace del cliente | `pages/public-request`, `server.js` (`/api/public/...`) |
| Clientes | `/comercial/clientes` | `pages/commercial-customers`, `backend/src/clientes.js` |
| Indicadores | `/comercial/indicadores` | `pages/commercial-indicators`, `backend/src/indicadores.js` |
| Histórico (pre-prueba) | `/comercial/historico` | `pages/commercial-history`, `backend/src/historico.js` |
| Avisos | campana del Área Comercial | `components/commercial-nav`, `backend/src/avisos.js` |
| Usuarios y roles | `/comercial/usuarios` (admin) | `pages/commercial-users`, `backend/src/usuarios.js` |

El primer usuario administrador se crea al arrancar con `COMMERCIAL_EMAIL` y `COMMERCIAL_PASSWORD` del `.env`.
Después, los usuarios se administran desde el módulo de usuarios (las contraseñas se guardan cifradas con scrypt).
