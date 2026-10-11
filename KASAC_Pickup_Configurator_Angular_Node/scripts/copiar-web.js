// Copia la build "web" del configurador dentro de la web KASAC (kasac-web/configurador-app),
// conservando el config.js de la web (dirección de la API cuando se publica en otro hosting).
const fs = require('node:fs');
const path = require('node:path');
const src = path.resolve(__dirname, '../frontend/dist/kasac-configurator-web/browser');
const dest = path.resolve(__dirname, '../../kasac-web-con-configurador/kasac-web/configurador-app');
if (!fs.existsSync(src)) {
  console.error('No existe la build web. Ejecute antes: npm run build:web --workspace frontend');
  process.exit(1);
}
if (!fs.existsSync(path.dirname(dest))) {
  console.log('No se encontró la carpeta kasac-web: se omite la copia.');
  process.exit(0);
}
const keep = path.join(dest, 'config.js');
const config = fs.existsSync(keep) ? fs.readFileSync(keep) : null;
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
if (config) fs.writeFileSync(keep, config);
console.log('Configurador copiado en', path.relative(process.cwd(), dest));
