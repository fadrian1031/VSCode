// Configurador 3D embebido en la web KASAC (configurador-app/).
// En www.kasac.pe usa la API publicada (CAMBIAR por su dirección real).
// En cualquier otra dirección (localhost, 127.0.0.1, IP de la red) usa la API local del mismo equipo, puerto 3000.
window.__KASAC_CONFIG__ = {
  apiBaseUrl: /(^|\.)kasac\.pe$/.test(location.hostname)
    ? "https://configurador.kasac.pe/api"
    : location.protocol + "//" + location.hostname + ":3000/api"
};
