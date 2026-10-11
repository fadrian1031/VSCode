// Revisa que la PC tenga lo necesario para correr el proyecto y explica cómo resolver cada problema.
// Uso: node scripts/diagnostico.js   (o npm run diagnostico)
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
let errores = 0;
const ok = m => console.log('  [OK]    ' + m);
const aviso = m => console.log('  [AVISO] ' + m);
const error = (m, solucion) => {
  errores++;
  console.log('  [ERROR] ' + m + (solucion ? '\n          -> ' + solucion : ''));
};

function puertoLibre(port) {
  return new Promise(resolve => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '0.0.0.0');
  });
}

(async () => {
  console.log('\nDiagnóstico KASAC\n');

  const [major] = process.versions.node.split('.').map(Number);
  if (major >= 20) ok(`Node.js ${process.version}`);
  else
    error(
      `Node.js ${process.version} es muy antiguo.`,
      'Instala Node.js 22 LTS desde https://nodejs.org, cierra esta ventana y ábrela de nuevo.'
    );

  if (
    fs.existsSync(path.join(root, 'package.json')) &&
    fs.existsSync(path.join(root, 'frontend', 'angular.json'))
  )
    ok(`Carpeta del proyecto: ${root}`);
  else
    error(
      'No se encuentra el proyecto completo en esta carpeta.',
      'Extrae TODO el .zip (clic derecho > Extraer todo) y ejecuta desde la carpeta KASAC_Pickup_Configurator_Angular_Node.'
    );

  // Al abrir un .zip con doble clic, Windows lo descomprime en %TEMP%\Temp1_nombre.zip\...
  if (/\.zip([\\/]|$)/i.test(root))
    error(
      'Parece que se está ejecutando desde dentro del .zip.',
      'Extrae el .zip a una carpeta normal (por ejemplo C:\\Proyectos) y ejecuta desde allí.'
    );
  if (/onedrive/i.test(root))
    aviso(
      'El proyecto está dentro de OneDrive: la sincronización puede bloquear archivos durante npm install. Si falla, muévelo a C:\\Proyectos.'
    );
  if (process.platform === 'win32' && root.length > 120)
    aviso(
      'La ruta de la carpeta es muy larga; si npm install falla con ENAMETOOLONG o EPERM, mueve el proyecto a C:\\Proyectos.'
    );

  try {
    fs.accessSync(root, fs.constants.W_OK);
    ok('Permiso de escritura en la carpeta');
  } catch {
    error(
      'No hay permiso de escritura en la carpeta.',
      'Mueve el proyecto a una carpeta propia (por ejemplo C:\\Proyectos), no a Archivos de programa.'
    );
  }

  const bin = path.join(root, 'node_modules', '.bin');
  if (fs.existsSync(path.join(bin, process.platform === 'win32' ? 'ng.cmd' : 'ng')))
    ok('Dependencias instaladas (node_modules)');
  else aviso('Aún no están instaladas las dependencias: se instalarán con npm install.');

  for (const [port, uso] of [[3000, 'web KASAC, configurador y Área Comercial']]) {
    if (await puertoLibre(port)) ok(`Puerto ${port} libre (${uso})`);
    else
      error(
        `El puerto ${port} (${uso}) está ocupado.`,
        'Cierra otras ventanas del proyecto que sigan abiertas (o reinicia la PC) y vuelve a intentarlo.'
      );
  }

  console.log(
    errores
      ? `\nSe encontraron ${errores} problema(s). Resuélvelos y vuelve a ejecutar.\n`
      : '\nTodo listo.\n'
  );
  process.exit(errores ? 1 : 0);
})();
