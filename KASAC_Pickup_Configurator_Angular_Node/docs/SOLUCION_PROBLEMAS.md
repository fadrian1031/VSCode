# Solución de problemas al instalar y ejecutar (Windows)

## La forma más fácil

1. Extrae **todo** el `.zip`: clic derecho > **Extraer todo…** en una carpeta corta, por ejemplo `C:\Proyectos`.
   No lo abras con doble clic desde el `.zip` sin extraer.
2. Abre la carpeta extraída y haz doble clic en **`INICIAR_KASAC.bat`**.
3. Espere. La primera vez instala dependencias (3 a 10 minutos) y compila (cerca de un minuto). Luego se abre el navegador en `http://localhost:3000` (web KASAC). El Área Comercial está en `http://localhost:3000/comercial`.

La ventana negra revisa tu PC antes de empezar (`[OK]`, `[AVISO]`, `[ERROR]`) y te dice qué hacer si algo falta.
No la cierres mientras usas el configurador.

## Errores frecuentes

| Mensaje | Causa | Solución |
|---|---|---|
| `"node" no se reconoce como un comando` | Node no está en el PATH, o la ventana se abrió antes de instalarlo | Cierra todas las terminales y abre una nueva. Si sigue, reinstala Node 22 LTS (.msi) dejando marcado **Add to PATH**, y reinicia la PC |
| `no se puede cargar el archivo ...\npm.ps1 porque la ejecución de scripts está deshabilitada` | PowerShell bloquea scripts | Usa `INICIAR_KASAC.bat` o **CMD** en lugar de PowerShell. O en PowerShell: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `ENOENT: no such file or directory, open '...\package.json'` | Comando ejecutado en la carpeta equivocada | Entra a `KASAC_Pickup_Configurator_Angular_Node` antes de `npm install` |
| `EPERM`, `EBUSY`, `operation not permitted` | Antivirus, OneDrive o VS Code bloquean archivos | Mueve el proyecto fuera de OneDrive a `C:\Proyectos`, cierra VS Code, borra `node_modules` y repite |
| `ENAMETOOLONG` o rutas muy largas | Carpeta demasiado profunda | Mueve el proyecto a `C:\Proyectos` |
| `ENOTFOUND`, `ETIMEDOUT`, `ECONNRESET` | Sin Internet o la red bloquea `registry.npmjs.org` | Prueba otra red. Detrás de un proxy corporativo: `npm config set proxy http://usuario:clave@proxy:puerto` |
| `EADDRINUSE: address already in use :::3000` | Quedó abierta otra ejecución | Cierre las otras ventanas negras (o reinicie la PC) |
| La página dice *"No se pudo cargar el catálogo"* | La API (puerto 3000) no inició | Mira en la ventana negra las líneas `[API]`; el primer error rojo indica la causa |

## Hacerlo a mano (CMD)

```bat
cd C:\Proyectos\Proyecto_KA_SAC_mejorado\KASAC_Pickup_Configurator_Angular_Node
node -v
npm run diagnostico
npm install
npm run build
npm start
```

`node -v` debe mostrar `v22.x` o superior.

Si aun así falla, copia **todo** el texto de la ventana (clic derecho > Seleccionar todo > Enter) o toma una captura, y compártelo.

## Depurar

- **Navegador**: F12 > pestaña *Console* para errores del visor 3D, pestaña *Network* para llamadas a `/api`.
- **Cambios en el código**: vuelva a ejecutar `npm run build` antes de `npm start` (o use `npm run dev` para recarga automática en `http://localhost:4200`).
- **VS Code**: abre la carpeta `KASAC_Pickup_Configurator_Angular_Node`, menú *Ejecutar y depurar* > **Depurar API + Angular** (configuración incluida en `.vscode/launch.json`).
- **Pruebas del backend**: `npm test --workspace backend`.
