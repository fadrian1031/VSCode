/* =========================================================
   KASAC - Catálogo de productos por vehículo
   cover: foto de la tarjeta del vehículo (inicio y productos.html), de la misma carpeta.
   Para agregar un producto: añade [nombre, archivo_imagen] a la lista.
   La imagen debe estar en img/productos/<carpeta>/<archivo>.png
   ========================================================= */
const VEHICLES = [
  {
    id: 'pickup',
    name: 'Pick up',
    dir: 'pickups',
    page: 'pickup',
    cover: 'EQUIPAMIENTOMINERO',
    items: [
      ['Parrilla contra piedras', 'PARRILLACONTRAPIEDRASPICKUP'],
      ['Jaula interna de seguridad certificada', 'JAULAINTERNADESEGURIDADCERTIFICADAS'],
      ['Equipamiento minero', 'EQUIPAMIENTOMINERO'],
      ['Barra antivuelco sobre baranda', 'BARRAANTIVUELCOSOBREBARANDA'],
      ['Barra antivuelco al piso', 'BARRAANTIVUELCOALPISO'],
      ['Parachoque de tubo con tiro de remolque', 'PARACHOQUEDETUBOTIRODEREMOLQUE'],
      ['Defensa delantera tipo mataperro', 'DEFENSADELANTERATIPOMATAPERRO'],
      ['Montatropa', 'MONTATROPA'],
      ['Porta escalera', 'PORTAESCALERAPARAPICKUP'],
      ['Porta equipo y porta escalera', 'PORTAEQUIPOYPORTAESCALERA'],
      ['Porta camilla', 'PORTACAMILLAPICKUP'],
      ['Caja de herramientas de metal', 'CAJADEHERRAMIENTASDEPLASTICOYDEMETAL'],
      ['Caja de herramientas de plástico importada', 'CAJADEHERRAMIENTASDEPLASTICOIMPORTADA'],
      ['Caja de herramientas personalizada', 'CAJADEHERRAMIENTASPERSONALIZADA'],
      ['Base de letrero y banderín', 'BASEDELETEROYBANDERIN'],
      ['Bases de neblineros', 'BASESDENEBLINEROS'],
      ['Base de tacos', 'BASEDETACOS'],
      ['Base de pico y pala', 'BASEDEPICOYPALA'],
      ['Bases especiales', 'BASESESPECIALES'],
      ['Porta 6.ª llanta', 'PORTA6TALLANTA'],
      ['Trabatuercas para llantas', 'TRABATUERCASPARALLANTAS'],
      ['Protector de solenoide', 'PROTECTORDESOLENOIDE'],
      ['Aplicación de undercoating', 'APLICACIONDEUNDERCOUTING'],
      ['Funda de asientos', 'FUNDADEASIENTOS'],
      ['Protector de piso', 'PROTECTORDEPISO'],
      ['Enmallado para luna de serenazgo', 'ENMALLADOPARALUNADESERENAZGO']
    ]
  },
  {
    id: 'suv',
    name: 'SUV',
    dir: 'suvs',
    page: 'suv',
    cover: 'SEGUROSTRABATUERCASSUV',
    items: [
      ['Parrilla contra piedras', 'PARRILLACONTRAPIEDRASSUV'],
      ['Jaula interna certificada', 'JAULAINTERNACERTIFICADASUV'],
      ['Equipamiento minero', 'EQUIPAMIENTOMINEROPARASUV'],
      ['Base travesaño porta accesorios', 'BASETRABESANOPORTAACCESORIOS'],
      ['Faros neblineros', 'BASEDENEBLIENROSTIPOU'],
      ['Base de faros pirata', 'BASEDEFAROSPIRATA'],
      ['Tiro de remolque', 'TIRODEREMOLQUESUV'],
      ['Seguros trabatuercas', 'SEGUROSTRABATUERCASSUV'],
      ['Aplicación de undercoating', 'APLICACIONDEUNDERCOUTING'],
      ['Funda de asientos', 'FUNDADEASIENTOS']
    ]
  },
  {
    id: 'camion',
    name: 'Camión',
    dir: 'camiones',
    page: 'camiones',
    cover: 'EQUIPAMIENTOMINEROPARACAMIONES',
    items: [
      ['Equipamiento minero para camiones', 'EQUIPAMIENTOMINEROPARACAMIONES'],
      ['Equipamiento minero', 'EQUIPAMIENTOMINERO'],
      ['Defensas y parachoques', 'DEFENSASYPARACHOQUESPARACAMIONES'],
      ['Parachoque posterior', 'PARACHOQUEPOSTERIOR'],
      ['Porta extintor y base de circulinas', 'PORTAEXTINTORBASEDECIRCULINAS'],
      ['Indicadores de ajuste de tuercas', 'INDICADORESDEAJUSTEDETUERCAS'],
      ['Seguro trabatuercas', 'SEGUROTRABATUERCAS'],
      ['Equipamiento corporativo', 'EQUIPAMIENTOCORPORATIVO']
    ]
  },
  {
    id: 'panel',
    name: 'Panel',
    dir: 'paneles',
    page: 'panel',
    cover: 'PORTAESCALERACONPORTAPERTICA',
    items: [
      ['Separador de cabina con divisiones', 'SEPARADORDECABINACONDIVISIONES'],
      ['Porta escalera con portapértiga', 'PORTAESCALERACONPORTAPERTICA'],
      ['Porta escalera', 'PORTAESCALERA'],
      ['Equipamiento corporativo', 'EQUIPAMIENTOCORPORATIVO'],
      ['Bases para accesorios', 'BASESPARAACCESORIOS'],
      ['Porta extintor', 'PORTAEXTINTOR'],
      ['Reja posterior de ventana', 'REJAPOSTERIORDEVENTANA'],
      ['Caja de herramientas', 'CAJADEHERRAMIENTAS'],
      ['Seguro de faros', 'SEGURODEFAROS'],
      ['Capuchón de candado', 'CAPUCHONDECANDADO']
    ]
  },
  {
    id: 'auto',
    name: 'Auto',
    dir: 'autos',
    page: 'autos',
    cover: 'EQUIPAMIENTOCORPORATIVO2',
    items: [
      ['Equipamiento corporativo', 'EQUIPAMIENTOCORPORATIVO'],
      ['Equipamiento corporativo (variante)', 'EQUIPAMIENTOCORPORATIVO2'],
      ['Protectores de maletera', 'PROTECTORESDEMALETERA']
    ]
  },
  {
    id: 'moto',
    name: 'Moto',
    dir: 'motos',
    page: 'motos',
    cover: 'MOTOCORPORATIVA',
    items: [
      ['Moto corporativa equipada', 'MOTOCORPORATIVA'],
      ['Caja de documentos de metal', 'CAJADEDOCUMENTOSDEMETAL'],
      ['Caja de documentos de plástico', 'CAJADEDOCUMENTOSDEPLASTICO'],
      ['Defensa delantera para manos', 'DEFENSADELANTERAPARAMANOS'],
      ['Defensa delantera para piernas', 'DEFENSADELANTERAPARAPIERNAS'],
      ['Parrillas metálicas', 'PARRILLASMETALICASPARAMOTOS'],
      ['Luces especiales', 'LUCESESPECIALES'],
      ['Pintado en uretano', 'PINTADODEMOTOSENURETANO']
    ]
  }
];

/* Foto de producto: primero la copia local (img/productos/...); si no existe, la de kasac.pe;
   si tampoco carga, queda el recuadro neutro */
function productImage(img) {
  const local = img.getAttribute('src');
  whenBroken(img, () => {
    const remote = remoteOf(local);
    if (remote && img.src !== remote) {
      img.src = remote;
      whenBroken(img, () => img.parentElement.classList.add('noimg'));
    } else img.parentElement.classList.add('noimg');
  });
}

/* Tarjetas de vehículos (inicio y productos.html) */
const vgrid = document.getElementById('vgrid');
if (vgrid)
  VEHICLES.forEach(v => {
    const a = document.createElement('a');
    a.className = 'vcard';
    a.href = v.page;
    // Foto real de un trabajo (cover); si no carga, queda un recuadro neutro con el nombre
    a.innerHTML = `<div class="vcard-img"><img loading="lazy" src="img/productos/${v.dir}/${v.cover}.png" alt="Equipamiento para ${v.name.toLowerCase()}"><div class="ph" aria-hidden="true">${v.name}</div></div>
    <div class="vcard-body"><b>${v.name}</b><span>${v.items.length} productos</span></div>`;
    productImage(a.querySelector('img'));
    vgrid.appendChild(a);
  });

/* Grilla de productos de una página de vehículo: <div id="grid" data-vehicle="pickup"> */
const grid = document.getElementById('grid');
if (grid && grid.dataset.vehicle) {
  const v = VEHICLES.find(x => x.id === grid.dataset.vehicle);
  document.getElementById('tabCount').textContent =
    `${v.items.length} productos para ${v.name.toLowerCase()}`;
  document.getElementById('tabWa').href = waLink(
    `Hola KASAC, quiero información sobre equipamiento para ${v.name.toLowerCase()}.`
  );
  v.items.forEach(([name, file]) => {
    const el = document.createElement('article');
    el.className = 'item';
    el.innerHTML = `
      <div class="thumb">
        <img loading="lazy" src="img/productos/${v.dir}/${file}.png" alt="${name} para ${v.name.toLowerCase()}">
        <div class="ph" aria-hidden="true">Sin imagen</div>
      </div>
      <div class="item-body">
        <h3>${name}</h3>
        <a href="${waLink(`Hola KASAC, quiero información sobre: ${name} para ${v.name.toLowerCase()}.`)}" target="_blank" rel="noopener">
          <svg width="16" height="16" aria-hidden="true"><use href="#i-wa"/></svg>Consultar</a>
      </div>`;
    productImage(el.querySelector('img'));
    grid.appendChild(el);
  });
}
