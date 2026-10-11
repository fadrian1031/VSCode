# Despliegue

## Opción recomendada: Render + base de datos Neon (gratis para pruebas)

El servidor Node publica la web KASAC en `/`, el configurador 3D, el Área Comercial en `/comercial` y la API.
El repositorio incluye `render.yaml` (en la raíz).

**Importante:** el plan gratuito de Render no tiene disco permanente: lo que se guarda en archivos se borra cada vez
que el servicio se duerme (15 min sin visitas) o se vuelve a desplegar. Por eso las solicitudes se guardan en
PostgreSQL cuando existe `DATABASE_URL`. Sin esa variable, la bandeja del Área Comercial muestra un aviso.

### 1. Base de datos (Neon, gratis)
1. Cree una cuenta en https://neon.tech y un proyecto (región *AWS São Paulo* o *US East*).
2. Copie la *connection string* (`postgresql://usuario:clave@...neon.tech/neondb?sslmode=require`).
   Las tablas se crean solas al arrancar.

### 2. Correo de aviso al Área Comercial (Resend, gratis)
1. Cree una cuenta en https://resend.com **con el correo que recibirá los avisos** (para las pruebas: `fabiocoyutupa@gmail.com`).
   Sin dominio verificado, Resend solo entrega a ese correo: así nadie más recibe los avisos de prueba.
2. **API Keys > Create API Key** y copie la clave (`re_...`).
   (Alternativa: Gmail por SMTP con una "contraseña de aplicación": `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS`.)

### 3. Render
1. Cree una cuenta en https://render.com con su usuario de GitHub.
2. **New > Blueprint**, elija el repositorio y la rama. Render lee `render.yaml` y pide:
   - `DATABASE_URL`: la cadena de Neon.
   - `COMMERCIAL_PASSWORD`: la clave del Área Comercial (mínimo 10 caracteres).
   - `RESEND_API_KEY`: la clave de Resend (puede dejarla vacía y agregarla después).
3. **Apply**. El primer build tarda unos 3–5 minutos. Pruebe `https://<servicio>.onrender.com/` (web) y `/comercial`.
4. Si ya tenía el servicio creado: en **Environment** agregue `DATABASE_URL`, `RESEND_API_KEY`, `NOTIFY_EMAIL`
   y **borre `PUBLIC_FRONTEND_URL`** (ya no se usa; el enlace del cliente se arma con el dominio desde el que entra).
5. Compruebe en `https://<servicio>.onrender.com/api/health` que diga `"storage":"postgres","persistent":true`.
6. Dominio propio: **Settings > Custom Domains > Add**. Render indica el registro DNS; el HTTPS es automático.

Retención: las solicitudes **sin cotizar** se borran a los `RETENTION_DAYS` días (30 por defecto); las cotizadas
o aprobadas se conservan. Cotización de prueba: con `COTIZACION_PRUEBA` distinto de `false`, el PDF y el Excel
usan los datos ficticios de `backend/src/empresa.js` y llevan la marca "Documento de prueba".

> Para producción conviene el plan Starter (7 USD/mes), que no se duerme y responde al instante.

## Web en el hosting actual (Apache) y sistema aparte

Si prefiere mantener la web en el hosting de kasac.pe: suba `kasac-web/` a ese hosting y publique el sistema Node en otro dominio
(por ejemplo `configurador.kasac.pe`). Cambie `apiBaseUrl` en `kasac-web/configurador-app/config.js` por esa dirección y defina
`PUBLIC_REQUEST_URL=https://www.kasac.pe/configurador#/solicitud/{token}`. El Área Comercial queda en `https://configurador.kasac.pe/comercial`.

## Alternativa más económica y rápida desde Perú: VPS en São Paulo

Un VPS (por ejemplo Hostinger KVM 1, centro de datos en São Paulo) da menor latencia y más recursos por precio similar,
pero tú administras el servidor: Node 22, Nginx como proxy, certificado HTTPS (Certbot), PM2 para mantener el proceso
activo, actualizaciones y respaldos de `backend/data/requests.json`. Recomendable solo si alguien del equipo maneja Linux.

## Requisitos generales (cualquier hosting)

Cualquier servicio que soporte Node.js 22+ y un disco persistente.

Comandos de build:

```bash
npm install
npm run build
npm start
```

Puerto esperado: variable `PORT`.

Variables de entorno de producción (plantilla completa en `backend/.env.example`):

```env
NODE_ENV=production
SESSION_SECRET=una-clave-larga-y-unica
COMMERCIAL_EMAIL=comercial@kasac.pe
COMMERCIAL_PASSWORD=cambiar-clave
COMMERCIAL_NAME=Equipo Comercial KASAC
PUBLIC_FRONTEND_URL=https://tu-dominio.com
```

Con `NODE_ENV=production` y el Área Comercial activa, el servidor se detiene al iniciar si `SESSION_SECRET` tiene menos de 32 caracteres o el valor demo, o si `COMMERCIAL_PASSWORD` es la clave demo. Genera la clave con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Detrás de un proxy inverso (Nginx, Render, Railway…) define `TRUST_PROXY=1` para que el límite de intentos de login (5 fallos cada 15 minutos) use la IP real del visitante.

Con Docker, construya desde la raíz del repositorio (`docker build -t kasac .`) y pase las variables al contenedor (`docker run -p 3000:3000 --env-file KASAC_Pickup_Configurator_Angular_Node/backend/.env -v kasac-datos:/data kasac`). `.dockerignore` excluye el `.env` y los datos locales.

Si Angular y Node están en el mismo dominio, `PUBLIC_FRONTEND_URL` puede apuntar a ese dominio. El frontend usa `/api` automáticamente fuera de localhost.

## Persistencia

Con `DATABASE_URL` todo (solicitudes, cotizaciones y fotos) se guarda en PostgreSQL (`backend/src/storage-pg.js`).
Sin ella se usa un archivo JSON (`backend/src/store.js`), suficiente en local o con disco permanente: las escrituras van en cola y se reemplaza el archivo de forma atómica, así que los envíos simultáneos no lo dañan. Si el archivo estuviera corrupto, el servidor responde con error en vez de sobrescribirlo. `DATA_FILE` permite ubicarlo en un volumen persistente. En una plataforma con filesystem efímero los datos pueden perderse al redesplegar.

## Versión pública (sin Área Comercial)

Para exponer el configurador a clientes sin login ni gestión de solicitudes:

```bash
npm install
npm run build:public   # Angular sin rutas /comercial (los componentes no se incluyen en el bundle)
npm run start:public   # API sin /api/auth/login ni /api/commercial/* (equivale a COMMERCIAL_ENABLED=false)
```

El equipo comercial usa la versión interna (`npm run build` + `npm start`) en una red o dominio no público, leyendo el mismo almacenamiento de solicitudes.

El enlace público de cada solicitud (`/solicitud/:token`) solo devuelve `code`, `createdAt` y `configuration`; nunca datos del cliente, estado ni notas comerciales.
