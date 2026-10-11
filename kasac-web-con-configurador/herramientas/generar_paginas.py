# Genera las páginas estáticas de la web KASAC con cabecera, menú y pie comunes.
# Uso (desde la carpeta kasac-web-con-configurador):
#     python3 herramientas/generar_paginas.py kasac-web
# Cambie aquí los textos y vuelva a ejecutarlo: así el menú y el pie quedan iguales en todas las páginas.
# Ojo: sobrescribe los .html de kasac-web; si edita un .html a mano, haga el mismo cambio aquí.
# Los enlaces usan URLs limpias (/contacto en vez de contacto.html); el servidor y .htaccess las resuelven.
import html, pathlib, sys
OUT = pathlib.Path(sys.argv[1])
WA = "https://wa.me/51966367094"
CATALOGO = "https://kasac.pe/file/catalogo2025.pdf"
def wa(text): 
    import urllib.parse; return f"{WA}?text={urllib.parse.quote(text)}"

SPRITE = """<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-wa" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z"/></symbol>
  <symbol id="i-phone" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></symbol>
  <symbol id="i-mail" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/></g></symbol>
  <symbol id="i-pin" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></g></symbol>
  <symbol id="i-doc" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M12 11v6m-3-3 3 3 3-3"/></g></symbol>
</svg>"""

NAV = [("index","Inicio"),("productos","Productos"),("servicios","Servicios"),("nosotros","Nosotros"),("configurador","Configurador 3D"),("contacto","Contacto")]
VEH = [("pickup","Pick up"),("suv","SUV"),("camiones","Camiones"),("panel","Panel"),("autos","Autos"),("motos","Motos")]

def head(title, desc, body_class=""):
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="img/web/portada.jpg">
<meta property="og:locale" content="es_PE">
<meta name="theme-color" content="#232834">
<link rel="icon" href="img/web/favicon.png">
<link rel="preload" href="fonts/barlow-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/barlow-condensed-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/styles.css">
</head>
<body{f' class="{body_class}"' if body_class else ''}>
{SPRITE}
"""

def header(active, vehicle_active=False):
    items=[]
    for key,label in NAV:
        cur=' aria-current="page"' if key==active or (key=="productos" and vehicle_active) else ''
        extra=' data-config-link' if key=="configurador" else ''
        if key=="productos":
            sub="".join(f'<li><a href="{k}">{l}</a></li>' for k,l in VEH)
            items.append(f'<li class="has-sub"><a href="productos"{cur}>Productos</a>\n          <ul class="sub">{sub}</ul>\n        </li>')
        else:
            href="/" if key=="index" else key
            items.append(f'<li><a href="{href}"{cur}{extra}>{label}</a></li>')
    lis="\n        ".join(items)
    return f"""<div class="topbar">
  <div class="wrap">
    <span class="place">Chorrillos, Lima</span>
    <div class="contacts">
      <a href="tel:+5112493642">(01) 249 3642</a>
      <a href="{WA}" target="_blank" rel="noopener">WhatsApp 966 367 094</a>
      <a class="hide-sm" href="mailto:ventas@kasac.pe">ventas@kasac.pe</a>
    </div>
  </div>
</div>

<header class="site">
  <div class="wrap">
    <a class="brand" href="/" aria-label="KASAC, ir al inicio"><img src="img/web/logo-kasac.png" alt="KASAC" width="99" height="48"></a>
    <nav class="main" id="nav" aria-label="Principal">
      <ul>
        {lis}
      </ul>
    </nav>
    <a class="btn btn-primary header-cta" href="contacto">Contáctenos</a>
    <button class="menu-btn" aria-label="Abrir menú" aria-expanded="false" aria-controls="nav">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
  </div>
</header>
"""

CATALOG_BAND = f"""<section class="catalog-band">
  <div class="wrap">
    <div class="catalog-cover" aria-hidden="true"><span>Catálogo</span><b>2025</b><img src="img/web/logo-kasac-blanco.png" alt=""></div>
    <div>
      <span class="kicker">Catálogo 2025</span>
      <h2>Todas nuestras líneas en un solo documento</h2>
      <p>Metalmecánica, sistema eléctrico, accesorios de seguridad, tapicería y ploteo, con las marcas que trabajamos.</p>
    </div>
    <a class="btn btn-primary" href="{CATALOGO}" target="_blank" rel="noopener"><svg><use href="#i-doc"/></svg>Ver catálogo (PDF)</a>
  </div>
</section>
"""

CTA_BAND = f"""<section class="cta-band">
  <div class="wrap">
    <div>
      <h2>¿Necesita equipar su flota?</h2>
      <p>Cuéntenos qué unidades tiene y qué equipamiento requiere su operación.</p>
    </div>
    <div class="actions">
      <a class="btn btn-primary" href="contacto">Contáctenos</a>
      <a class="btn btn-wa" href="{wa('Hola KASAC, quiero información sobre equipamiento para mi flota.')}" target="_blank" rel="noopener"><svg><use href="#i-wa"/></svg>WhatsApp</a>
    </div>
  </div>
</section>
"""

FOOTER = f"""<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <img class="foot-logo" src="img/web/logo-kasac-blanco.png" alt="KASAC" width="132" height="64" loading="lazy">
        <h4>Grupo KA S.A.C.</h4>
        <p class="about">Equipamiento para camionetas mineras y vehículos corporativos. Fabricación, importación e instalación en Lima.</p>
        <div class="socials">
          <a href="https://www.facebook.com/empresakasac/" target="_blank" rel="noopener" aria-label="Facebook de KASAC"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8Z"/></svg></a>
          <a href="https://www.youtube.com/channel/UCe2uNyjQ91niKEVITnDV80A" target="_blank" rel="noopener" aria-label="YouTube de KASAC"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12a31 31 0 0 0 .4 3.8 3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-3.8 31 31 0 0 0-.4-3.8ZM10 15V9l5.2 3Z"/></svg></a>
        </div>
      </div>
      <div>
        <h4>Equipamiento</h4>
        <ul>{''.join(f'<li><a href="{k}">{l}</a></li>' for k,l in VEH)}</ul>
      </div>
      <div>
        <h4>Empresa</h4>
        <ul>
          <li><a href="servicios">Servicios y PDI</a></li>
          <li><a href="nosotros">Nosotros</a></li>
          <li><a href="configurador" data-config-link>Configurador 3D</a></li>
          <li><a href="https://kasac.pe/file/catalogo2025.pdf" target="_blank" rel="noopener">Catálogo 2025</a></li>
        </ul>
      </div>
      <div>
        <h4>Contacto</h4>
        <ul>
          <li><a href="tel:+5112493642">(01) 249 3642</a></li>
          <li><a href="{WA}" target="_blank" rel="noopener">WhatsApp 966 367 094</a></li>
          <li><a href="mailto:ventas@kasac.pe">ventas@kasac.pe</a></li>
          <li>Calle Volcán Misti Mz. H13 Lt. 1C, Chorrillos, Lima</li>
        </ul>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© <span id="year">2026</span> Grupo KA S.A.C. Todos los derechos reservados.</span>
      <span>RUC y datos legales a disposición en nuestras oficinas.</span>
    </div>
  </div>
</footer>

<a class="wa-float" href="{wa('Hola KASAC, quiero información sobre equipamiento.')}" target="_blank" rel="noopener" aria-label="Escríbanos por WhatsApp"><svg><use href="#i-wa"/></svg></a>
"""

def page(name, title, desc, active, main, body_class="", vehicle=False, scripts=("main",)):
    s = head(title, desc, body_class) + header(active, vehicle) + "\n<main>\n" + main + "\n</main>\n\n" + FOOTER
    s += "\n".join(f'<script src="js/{x}.js"></script>' for x in scripts) + "\n</body>\n</html>\n"
    (OUT/f"{name}.html").write_text(s, encoding="utf-8")

LINES = [
  ("Metalmecánica","Estructuras fabricadas en taller propio para cada modelo de camioneta y camión, según los estándares de las mineras.",
   ["Barra antivuelco tipo Volcán","Modelo Antamina","Jaula antivuelco","Porta escalera","Montatropas","Estribos laterales","Protector de cárter","Separador de cabina"]),
  ("Sistema eléctrico","Iluminación, señalización y alarmas para operar de día, de noche y en zonas de riesgo.",
   ["Circulinas Ecco y Star Warning","Faros Hella LED","Pértigas SafetyWips 8/10/12 pies","Alarma de retroceso 107 dB","Corta corriente","Cámara heavy duty"]),
  ("Seguridad","El kit obligatorio para ingresar a mina y circular según normativa.",
   ["Botiquín MTC","Kit antiderrame","Extintores de 2 a 12 kg","Conos y triángulos","Tacos de madera y poliuretano","Cable de remolque","Compresor de aire"]),
  ("Tapicería y ploteo","Protección interior y la imagen de su empresa en toda la flota.",
   ["Fundas de asientos","Protector de piso","Láminas de seguridad","Polarizados","Ploteo según diseño"]),
]
def lines_html(limit=None):
    cols=[]
    for t,d,items in LINES:
        lis="".join(f"<li>{i}</li>" for i in (items[:limit] if limit else items))
        cols.append(f'<div class="line-col"><h3>{t}</h3><p class="desc">{d}</p><ul>{lis}</ul></div>')
    return '<div class="lines">\n      '+"\n      ".join(cols)+"\n    </div>"

FLOW = [("Recepción","Coordinamos con el concesionario la entrega de sus vehículos nuevos directamente en nuestro local."),
        ("Custodia","Sus unidades quedan cubiertas por póliza contra robo y responsabilidad civil mientras están con nosotros."),
        ("Equipamiento","Instalamos el equipamiento minero o corporativo que requiere su operación."),
        ("Entrega","Lavado y acondicionamiento final para que salgan directo a trabajar.")]
def flow_html():
    return '<ol class="flow">'+"".join(f'<li><small>{i+1:02d}</small><h3>{t}</h3><p>{d}</p></li>' for i,(t,d) in enumerate(FLOW))+'</ol>'

# ---------- Inicio ----------
index_main = f"""<section class="hero">
  <div class="hero-grid">
    <div class="hero-copy">
      <span class="kicker">Equipamiento vehicular · Lima, Perú</span>
      <h1>Equipamiento para camionetas mineras y flotas corporativas</h1>
      <p class="lead">Fabricamos e instalamos barras antivuelco, jaulas, circulinas, parrillas y el equipamiento de seguridad que exige la operación minera. Entregamos sus unidades listas para trabajar.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="contacto">Contáctenos</a>
        <a class="btn btn-outline-inv" href="configurador" data-config-link>Configurador 3D</a>
      </div>
    </div>
    <!-- Imagen de portada: reemplace img/web/portada.jpg por su propia foto (horizontal, mínimo 1600 px de ancho). -->
    <figure class="hero-media" data-fallback>
      <img src="img/web/portada.jpg" alt="Camionetas equipadas por KASAC en el patio de entrega" fetchpriority="high">
    </figure>
  </div>
</section>

<section class="sectors-bar" aria-label="Sectores que atendemos">
  <div class="wrap">
    <ul>
      <li><b>Minería</b><span>Equipamiento para ingreso a mina</span></li>
      <li><b>Flotas corporativas</b><span>Autos, SUV, paneles y camiones</span></li>
      <li><b>Seguridad ciudadana</b><span>Unidades de serenazgo</span></li>
      <li><b>Rescate y salud</b><span>Porta camilla y equipos especiales</span></li>
    </ul>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <div class="head">
      <div>
        <span class="kicker">Productos</span>
        <h2>Equipamiento por tipo de vehículo</h2>
        <p class="lead">Cada unidad tiene su propio equipamiento. Elija el tipo de vehículo para ver lo que fabricamos e instalamos.</p>
      </div>
      <a class="link-arrow" href="productos">Ver todos los productos</a>
    </div>
    <div class="vgrid" id="vgrid"></div>
  </div>
</section>

<section class="block alt">
  <div class="wrap config-feature">
    <!-- Captura del configurador: puede reemplazarla por img/web/configurador.jpg (16:10). -->
    <figure class="config-shot" data-fallback>
      <img src="img/web/configurador.jpg" alt="Configurador 3D de KASAC con una Toyota Hilux equipada" loading="lazy">
    </figure>
    <div>
      <span class="kicker">Configurador 3D</span>
      <h2>Revise el equipamiento sobre su unidad</h2>
      <p class="lead">Una herramienta para ubicar los accesorios en el modelo de su vehículo antes de solicitarlos. Nuestro equipo comercial recibe la configuración y la valida con usted.</p>
      <ol class="steps">
        <li><span>01</span>Elija el modelo de camioneta.</li>
        <li><span>02</span>Agregue el equipamiento y vea cómo queda.</li>
        <li><span>03</span>Envíe la configuración al área comercial.</li>
      </ol>
      <a class="btn btn-outline" href="configurador" data-config-link>Abrir el configurador 3D</a>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <div class="head">
      <div>
        <span class="kicker">Líneas de producto</span>
        <h2>Lo que fabricamos e instalamos</h2>
      </div>
      <a class="link-arrow" href="https://kasac.pe/file/catalogo2025.pdf" target="_blank" rel="noopener">Catálogo 2025 (PDF)</a>
    </div>
    {lines_html(limit=5)}
  </div>
</section>
{CATALOG_BAND}
<section class="block dark">
  <div class="wrap pdi-grid">
    <div>
      <span class="kicker">Servicio PDI</span>
      <h2>Recibimos, custodiamos y equipamos sus unidades nuevas</h2>
      <p class="figure-note"><b>15 000 m²</b>de local propio en Chorrillos.</p>
      <p style="margin-top:26px"><a class="btn btn-outline-inv" href="servicios#pdi">Conocer el servicio</a></p>
    </div>
    {flow_html()}
  </div>
</section>

{CTA_BAND}"""
page("index","Equipamiento para camionetas mineras y flotas corporativas | KASAC",
     "Equipamiento para camionetas mineras, flotas corporativas, motos, SUV, paneles y camiones en Lima. Barras antivuelco, circulinas, jaulas, PDI y gestión de flotas.",
     "index", index_main, scripts=("main","productos"))

# ---------- Productos ----------
def page_head(crumbs, h1, lead):
    c=" / ".join([f'<a href="{h}">{t}</a>' for h,t in crumbs[:-1]]+[f'<span aria-current="page">{crumbs[-1][1]}</span>'])
    return f"""<section class="page-head">
  <div class="wrap">
    <nav class="crumbs" aria-label="Ruta">{c}</nav>
    <h1>{h1}</h1>
    <p class="lead">{lead}</p>
  </div>
</section>
"""
page("productos","Productos | KASAC","Equipamiento para pick up, SUV, camiones, paneles, autos y motos corporativas.","productos",
  page_head([("/","Inicio"),("","Productos")],"Equipamiento por tipo de vehículo","Elija el tipo de vehículo para ver el equipamiento que fabricamos e instalamos.")+
  """<section class="block">
  <div class="wrap">
    <div class="vgrid" id="vgrid"></div>
  </div>
</section>
"""+CATALOG_BAND+CTA_BAND, scripts=("main","productos"))

# ---------- Vehículos ----------
VPAGES = {
 "pickup":("pickup","Equipamiento para pick up","Barras antivuelco, jaulas certificadas, parrillas, montatropas, porta escaleras y equipamiento minero completo para camionetas pick up."),
 "suv":("suv","Equipamiento para SUV","Jaulas internas certificadas, parrillas contra piedras, neblineros, faros pirata y equipamiento minero para SUV."),
 "camiones":("camion","Equipamiento para camiones corporativos y mineros","Defensas, parachoques, bases de circulinas, porta extintores y equipamiento minero para camiones."),
 "panel":("panel","Equipamiento para paneles","Separadores de cabina, porta escaleras, rejas, cajas de herramientas y equipamiento corporativo para paneles."),
 "autos":("auto","Equipamiento para autos corporativos","Equipamiento corporativo y protectores de maletera para autos de flota."),
 "motos":("moto","Equipamiento para motos corporativas","Cajas de documentos, defensas, parrillas metálicas, luces especiales y pintado en uretano para motos corporativas."),
}
for name,(vid,h1,lead) in VPAGES.items():
    CUR=' aria-current="page"'
    tabs="".join(f'<a href="{k}"{CUR if k==name else ""}>{l}</a>' for k,l in VEH)
    label=dict(VEH)[name]
    extra = """
<section class="block alt">
  <div class="wrap config-feature">
    <figure class="config-shot" data-fallback><img src="img/web/configurador.jpg" alt="Configurador 3D de KASAC" loading="lazy"></figure>
    <div>
      <span class="kicker">Configurador 3D</span>
      <h2>Vea el equipamiento sobre su camioneta</h2>
      <p class="lead">Disponible para Toyota Hilux, Ford Ranger y Mitsubishi L200.</p>
      <p style="margin-top:24px"><a class="btn btn-outline" href="configurador" data-config-link>Abrir el configurador 3D</a></p>
    </div>
  </div>
</section>
""" if name=="pickup" else ""
    page(name,f"{h1} | KASAC",lead,"",page_head([("/","Inicio"),("productos","Productos"),("",label)],h1,lead)+f"""<section class="block">
  <div class="wrap">
    <nav class="vnav" aria-label="Tipo de vehículo">{tabs}</nav>
    <div class="tab-meta">
      <p id="tabCount" aria-live="polite"></p>
      <a class="btn btn-wa" id="tabWa" href="contacto" target="_blank" rel="noopener"><svg><use href="#i-wa"/></svg>Consultar por WhatsApp</a>
    </div>
    <div class="grid" id="grid" data-vehicle="{vid}"></div>
  </div>
</section>
{extra}{CTA_BAND}""", vehicle=True, scripts=("main","productos"))

# ---------- Servicios ----------
page("servicios","Servicios, líneas de producto y PDI | KASAC","Metalmecánica, sistema eléctrico, accesorios de seguridad, tapicería y servicio PDI con local de 15 000 m² para custodia y gestión de flotas.","servicios",
  page_head([("/","Inicio"),("","Servicios")],"Servicios para su flota","Fabricamos, importamos e instalamos. Si lo necesita, recibimos y custodiamos sus unidades nuevas hasta entregarlas equipadas.")+f"""<section class="block" id="lineas">
  <div class="wrap">
    <div class="head">
      <div>
        <span class="kicker">Líneas de producto</span>
        <h2>Lo que fabricamos e instalamos</h2>
        <p class="lead">Trabajamos con marcas reconocidas en iluminación y seguridad, y fabricamos en taller propio toda la metalmecánica.</p>
      </div>
      <a class="btn btn-outline" href="https://kasac.pe/file/catalogo2025.pdf" target="_blank" rel="noopener"><svg><use href="#i-doc"/></svg>Catálogo 2025</a>
    </div>
    {lines_html()}
  </div>
</section>
{CATALOG_BAND}
<section class="block alt" id="pdi">
  <div class="wrap pdi-grid">
    <div>
      <span class="kicker">Servicio PDI y gestión de flotas</span>
      <h2>Sus unidades nuevas, listas para trabajar</h2>
      <p class="lead" style="margin-top:16px">Contamos con un local propio de 15 000 m² para recibir, custodiar y equipar sus vehículos.</p>
    </div>
    {flow_html()}
  </div>
</section>
{CTA_BAND}""")

# ---------- Nosotros ----------
page("nosotros","Nosotros | KASAC","Empresa peruana con más de 20 años en equipamiento de camionetas mineras y vehículos corporativos.","nosotros",
  page_head([("/","Inicio"),("","Nosotros")],"Quiénes somos","Una empresa peruana que lleva más de 20 años equipando las flotas de la minería y las empresas del país.")+f"""<section class="block">
  <div class="wrap about-grid">
    <div>
      <h2>Un solo proveedor para el equipamiento de su flota</h2>
      <p class="lead" style="margin-top:20px">Somos una empresa peruana dedicada al equipamiento y la comercialización de productos para camionetas mineras y vehículos corporativos.</p>
      <p class="lead">La variedad de nuestras líneas nos permite atender todo lo que su flota necesita: metalmecánica propia, sistema eléctrico, accesorios de seguridad y acabados interiores.</p>
      <div class="sectors">
        <div><b>Minería</b><span>Equipamiento para ingreso a mina</span></div>
        <div><b>Flotas corporativas</b><span>Autos, SUV y paneles de empresa</span></div>
        <div><b>Seguridad ciudadana</b><span>Unidades de serenazgo</span></div>
        <div><b>Rescate y salud</b><span>Porta camilla y equipos especiales</span></div>
      </div>
      <a class="link-arrow" href="https://www.youtube.com/watch?v=Z6m0bPU0SNw" target="_blank" rel="noopener">Ver video de nuestro taller</a>
    </div>
    <figure class="about-photo" data-fallback>
      <img src="img/home-about.jpg" data-remote="img/home-about.jpg" data-alt="img/web/portada.jpg" alt="Camionetas equipadas en el taller de KASAC">
      <div class="ph" aria-hidden="true">Foto del taller</div>
    </figure>
  </div>
</section>
<section class="block alt" id="mision-vision">
  <div class="wrap">
    <div class="mv-grid">
      <article>
        <span class="kicker">Misión</span>
        <h2>Nuestra misión</h2>
        <p>Ser una empresa proveedora de equipamiento para camionetas mineras y off-road, dedicada a la satisfacción oportuna de nuestros clientes y a la generación de valor mediante la innovación y productos de excelente calidad al menor precio.</p>
      </article>
      <article>
        <span class="kicker">Visión</span>
        <h2>Nuestra visión</h2>
        <p>Ser reconocidos y valorados en el mercado por ofrecer el mejor equipamiento para camionetas mineras, con la mejor relación costo-beneficio para nuestros clientes.</p>
      </article>
    </div>
    <div class="values">
      <h3>Nuestra política</h3>
      <ul>
        <li><b>Innovación constante</b><span>Desarrollamos soluciones para cada modelo y cada operación.</span></li>
        <li><b>Calidad</b><span>Productos y fabricación que cumplen los estándares de la minería.</span></li>
        <li><b>Compromiso con el cliente</b><span>Atención oportuna, de la cotización a la entrega de la unidad.</span></li>
      </ul>
    </div>
  </div>
</section>
{CATALOG_BAND}{CTA_BAND}""")

# ---------- Contacto ----------
page("contacto","Contacto | KASAC","Contáctenos: WhatsApp 966 367 094, teléfono (01) 249 3642, ventas@kasac.pe. Chorrillos, Lima.","contacto",
  page_head([("/","Inicio"),("","Contacto")],"Contáctenos","Cuéntenos qué vehículos tiene y qué necesita. Le respondemos en el mismo día hábil.")+f"""<section class="block">
  <div class="wrap contact-grid">
    <div>
      <ul class="contact-list">
        <li><svg><use href="#i-wa"/></svg><div><a href="{WA}" target="_blank" rel="noopener">966 367 094</a><small>WhatsApp</small></div></li>
        <li><svg><use href="#i-phone"/></svg><div><a href="tel:+5112493642">(01) 249 3642</a><small>Central</small></div></li>
        <li><svg><use href="#i-mail"/></svg><div><a href="mailto:ventas@kasac.pe">ventas@kasac.pe</a><small>Área comercial</small></div></li>
        <li><svg><use href="#i-pin"/></svg><div><a href="https://maps.google.com/?q=Calle+Volcan+Misti+Chorrillos+Lima" target="_blank" rel="noopener">Calle Volcán Misti Mz. H13 Lt. 1C, Chorrillos, Lima</a><small>Taller y oficinas</small></div></li>
      </ul>
      <iframe class="map" title="Ubicación de KASAC en Chorrillos" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=Calle%20Volc%C3%A1n%20Misti%2C%20Chorrillos%2C%20Lima&output=embed"></iframe>
    </div>
    <form class="quote" id="quoteForm" novalidate>
      <h2>Envíenos su consulta</h2>
      <p class="hint">Los campos con * son obligatorios.</p>
      <div class="field"><label for="f-nombre">Nombre *</label><input id="f-nombre" name="nombre" autocomplete="name" required></div>
      <div class="field"><label for="f-empresa">Empresa</label><input id="f-empresa" name="empresa" autocomplete="organization"></div>
      <div class="field"><label for="f-tel">Teléfono *</label><input id="f-tel" name="telefono" type="tel" autocomplete="tel" required></div>
      <div class="field"><label for="f-correo">Correo</label><input id="f-correo" name="correo" type="email" autocomplete="email"></div>
      <div class="field"><label for="f-vehiculo">Tipo de vehículo</label>
        <select id="f-vehiculo" name="vehiculo">
          <option>Pick up</option><option>SUV</option><option>Panel</option><option>Camión</option><option>Auto</option><option>Moto</option><option>Varios tipos</option>
        </select></div>
      <div class="field"><label for="f-cant">Cantidad de unidades</label><input id="f-cant" name="cantidad" type="number" min="1" value="1" inputmode="numeric"></div>
      <div class="field full"><label for="f-msg">¿Qué equipamiento necesita?</label><textarea id="f-msg" name="mensaje" placeholder="Por ejemplo: barra antivuelco modelo Antamina, circulina y pértiga para 5 Hilux."></textarea></div>
      <p class="form-msg" id="formMsg" role="alert"></p>
      <div class="form-actions">
        <button class="btn btn-wa" type="submit" data-via="wa"><svg><use href="#i-wa"/></svg>Enviar por WhatsApp</button>
        <button class="btn btn-outline" type="submit" data-via="mail"><svg><use href="#i-mail"/></svg>Enviar por correo</button>
      </div>
    </form>
  </div>
</section>
""")

# ---------- Configurador ----------
s = head("Configurador 3D | KASAC","Vea el equipamiento KASAC sobre su camioneta en 3D y envíe la configuración a nuestro equipo comercial.","config-page") + header("configurador") + f"""
<main class="config-embed">
  <h1 class="sr-only">Configurador 3D KASAC</h1>
  <!-- La app 3D (build "web" del proyecto KASAC_Pickup_Configurator) vive en configurador-app/.
       Va en un iframe para que sus estilos y los de la web no se mezclen. -->
  <iframe id="configFrame" title="Configurador 3D de equipamiento KASAC" src="configurador-app/"></iframe>
  <noscript><p class="config-noscript">El configurador 3D necesita JavaScript. También puede <a href="contacto">escribirnos desde el formulario</a>.</p></noscript>
</main>

{CTA_BAND}
{FOOTER}<script src="js/main.js"></script>
</body>
</html>
"""
(OUT/"configurador.html").write_text(s, encoding="utf-8")
print("ok")
