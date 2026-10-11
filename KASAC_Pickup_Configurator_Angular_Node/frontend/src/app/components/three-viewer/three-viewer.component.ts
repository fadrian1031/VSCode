import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import {
  GraphicPlacement,
  GraphicPreset,
  InteriorConfiguration,
  SelectedAccessory,
  Transform3D,
  Vehicle,
  Vec3
} from '../../models/domain';

export interface GraphicToolState {
  active: boolean;
  preset: GraphicPreset | null;
  widthCm: number;
  heightCm: number;
  rotation: number;
}

export type CameraView = 'front' | 'rear' | 'left' | 'right' | 'iso';
type InteriorCamera = InteriorConfiguration['camera'];

// Raycast acelerado (BVH): los clics y trazos sobre la carrocería de la Hilux (~460 mil triángulos) pasan
// de recorrer todas las caras a una búsqueda en árbol. Sin árbol calculado, Three usa su raycast normal.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// Los catálogos y solicitudes guardadas usan rutas '/assets/...'. Se resuelven relativas al <base href>
// para que los modelos carguen también cuando la app vive en una subcarpeta (web KASAC: /configurador-app/).
const assetUrl = (path: string) => path.replace(/^\/(?=assets\/)/, '');

// Los GLB están comprimidos con meshopt (EXT_meshopt_compression); el decodificador viene incluido en three.
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// Caché por URL compartida por todos los visores: cambiar de vehículo, volver a uno anterior o agregar
// la misma pieza dos veces no vuelve a descargar ni a decodificar el modelo. Cada uso recibe un clon
// que comparte geometría (y materiales, salvo los que el visor clona para pintarlos o resaltarlos).
const modelCache = new Map<string, Promise<THREE.Object3D>>();
function loadModel(path: string, onProgress?: (ratio: number) => void): Promise<THREE.Object3D> {
  const url = assetUrl(path);
  let template = modelCache.get(url);
  if (!template) {
    template = loader
      .loadAsync(url, e => {
        if (e.total) onProgress?.(e.loaded / e.total);
      })
      .then(g => g.scene);
    template.catch(() => modelCache.delete(url));
    modelCache.set(url, template);
  }
  return template.then(t => t.clone(true));
}

// Estudio claro: fondo gris de la paleta KASAC y piso que se funde con él.
const BACKGROUND = '#D8DCE1';
const ACCENT = new THREE.Color('#1C85D1');
const CLICK_TOLERANCE_PX = 6;
const SCALE_LIMITS = { min: 0.5, max: 2 };
// Vista → dirección desde el centro del vehículo hacia la cámara. El frente del vehículo mira hacia -Z.
const VIEW_DIRECTIONS: Record<CameraView, THREE.Vector3> = {
  front: new THREE.Vector3(0, 0.22, -1).normalize(),
  rear: new THREE.Vector3(0, 0.22, 1).normalize(),
  left: new THREE.Vector3(-1, 0.18, 0).normalize(),
  right: new THREE.Vector3(1, 0.18, 0).normalize(),
  iso: new THREE.Vector3(1.1, 0.48, 1.15).normalize()
};
// Fotos para la cotización (mismos ids que el backend, en photos.js).
const PHOTO_VIEWS: [string, THREE.Vector3][] = [
  ['frente-34', new THREE.Vector3(0.95, 0.36, -1.05).normalize()],
  ['frente', new THREE.Vector3(0, 0.18, -1).normalize()],
  ['izquierda', new THREE.Vector3(-1, 0.14, 0).normalize()],
  ['derecha', new THREE.Vector3(1, 0.14, 0).normalize()],
  ['posterior', new THREE.Vector3(0, 0.2, 1).normalize()],
  ['posterior-34', new THREE.Vector3(-0.95, 0.36, 1.05).normalize()]
];
// Cámaras del interior demostrativo: posición [x,y,z] y punto de mira [x,y,z].
const INTERIOR_POSES: Record<InteriorCamera, [number, number, number, number, number, number]> = {
  driver: [-0.42, 1.18, -0.55, 0, 1.12, -1.35],
  passenger: [0.42, 1.18, -0.55, 0, 1.12, -1.35],
  'rear-left': [-0.42, 1.18, 0.82, 0, 1.05, -0.2],
  'rear-center': [0, 1.2, 0.96, 0, 1.08, -0.25],
  'rear-right': [0.42, 1.18, 0.82, 0, 1.05, -0.2],
  free: [0, 1.18, 0.2, 0, 1.08, -0.6]
};
// Mallas que se pintan con el color de carrocería: por nombre de material (Hilux) o de malla (modelos referenciales).
const PAINT_MATERIAL = /body|paint|carrocer/i;
const PAINT_MESH = /^(body|hood|cabin|roof|bed_side|tailgate|door)/i;
// Marcadores de montaje invisibles que trae el GLB de la Hilux: no deben verse, proyectar sombra ni recibir clics.
const ANCHOR_MESH = /^ANCHOR_/i;

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
// Margen en píxeles alrededor del vehículo en el visor (el vertical deja libre la barra de botones superior).
const FRAME_PAD = { x: 20, y: 64 };
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function materialsOf(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

@Component({
  selector: 'app-three-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './three-viewer.component.html',
  styleUrl: './three-viewer.component.css'
})
export class ThreeViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  @Input() vehicle: Vehicle | null = null;
  @Input() accessories: SelectedAccessory[] = [];
  @Input() graphics: GraphicPlacement[] = [];
  @Input() selectedInstanceId: string | null = null;
  @Input() readonly = false;
  @Input() transformMode: 'translate' | 'rotate' | 'scale' = 'translate';
  @Input() graphicTool: GraphicToolState = {
    active: false,
    preset: null,
    widthCm: 35,
    heightCm: 12,
    rotation: 0
  };
  @Input() viewMode: 'exterior' | 'interior' = 'exterior';
  @Input() interiorMaterialColor = '#34373a';
  @Input() interiorCamera: InteriorCamera = 'driver';
  /** Color de carrocería (#rrggbb). null = color original del modelo. */
  @Input() paintColor: string | null = null;
  @Output() selectInstance = new EventEmitter<string | null>();
  @Output() transformChanged = new EventEmitter<{ instanceId: string; transform: Transform3D }>();
  @Output() graphicPlaced = new EventEmitter<GraphicPlacement>();

  loading = true;
  progress = 0;
  loadError = '';
  warning = '';
  autoRotate = false;

  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
  private orbit!: OrbitControls;
  private transform!: TransformControls;
  private keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
  private envTexture?: THREE.Texture;
  private stage = new THREE.Group();
  private clock = new THREE.Clock();

  private vehicleRoot = new THREE.Group();
  private accessoryRoot = new THREE.Group();
  private graphicRoot = new THREE.Group();
  private interiorRoot = new THREE.Group();
  private interiorMaterials: THREE.MeshStandardMaterial[] = [];

  private vehicleMeshes: THREE.Mesh[] = [];
  private paintMaterial?: THREE.MeshPhysicalMaterial;
  private originalPaint = new THREE.Color();
  private vehicleSeq = 0;
  private accessoryObjects = new Map<string, THREE.Object3D>();
  private pendingAccessories = new Set<string>();
  private hoveredId: string | null = null;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private raf = 0;
  private needsRender = true;
  private destroyed = false;
  private resizeObserver?: ResizeObserver;
  private warningTimer?: ReturnType<typeof setTimeout>;
  /** Vista encuadrada automáticamente (null cuando el usuario movió la cámara). */
  private framedView: CameraView | null = null;
  private tween?: {
    fromPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toPos: THREE.Vector3;
    toTarget: THREE.Vector3;
    start: number;
    duration: number;
  };

  private down?: { x: number; y: number; onGizmo: boolean };
  private drawingLine = false;
  private linePoints: Vec3[] = [];
  private linePreview?: THREE.Line;
  private hoverQueued = false;
  private lastPointerEvent?: PointerEvent;

  constructor(private zone: NgZone) {}

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => this.init());
    if (!this.renderer) return;
    // El primer ngOnChanges llega antes de que exista el renderer: aquí se aplica el estado inicial
    // (vista pública y Comercial reciben vehículo, accesorios y gráfica de una sola vez).
    if (this.vehicle) this.loadVehicle();
    this.syncAccessories();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.renderer) return;
    if (changes['vehicle']) this.loadVehicle();
    if (changes['accessories']) this.syncAccessories();
    if (changes['graphics']) this.syncGraphics();
    if (changes['selectedInstanceId'] || changes['transformMode']) this.syncTransformControls();
    if (changes['selectedInstanceId']) this.syncHighlights();
    if (changes['viewMode'] || changes['interiorCamera'] || changes['interiorMaterialColor'])
      this.syncViewMode(!!changes['viewMode']);
    if (changes['paintColor']) this.applyPaint();
    if (changes['graphicTool']) {
      if (this.graphicTool.active) this.prepareSurfaceRaycast();
      this.updateCursor();
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.warningTimer);
    this.resizeObserver?.disconnect();
    if (!this.renderer) return;
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerCancel);
    canvas.removeEventListener('pointerleave', this.onPointerLeave);
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.transform.detach();
    this.transform.dispose();
    this.orbit.dispose();
    for (const obj of this.accessoryObjects.values()) this.disposeInstanceMaterials(obj);
    this.clearGraphics();
    this.disposeTree(this.interiorRoot);
    this.disposeTree(this.stage);
    this.paintMaterial?.dispose();
    this.envTexture?.dispose();
    this.renderer.dispose();
    // Libera el contexto WebGL: el navegador limita cuántos puede haber abiertos a la vez.
    this.renderer.forceContextLoss();
    canvas.remove();
  }

  // Escena
  private init() {
    const el = this.host.nativeElement;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      console.error(e);
      this.zone.run(() => {
        this.loading = false;
        this.loadError =
          'Este navegador o dispositivo no puede mostrar gráficos 3D (WebGL desactivado o no disponible).';
      });
      return;
    }
    const renderer = this.renderer;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral conserva el tono real de pinturas y acabados mejor que ACES (que satura y oscurece).
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Las sombras solo se recalculan cuando cambia la escena (no al girar la cámara).
    renderer.shadowMap.autoUpdate = false;
    el.appendChild(renderer.domElement);

    // Iluminación de estudio por imagen (reflejos en pintura, cromados y vidrios).
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = 0.7;
    this.scene.background = new THREE.Color(BACKGROUND);

    this.camera.position.set(7, 3.2, 7);
    this.orbit = new OrbitControls(this.camera, renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.target.set(0, 0.9, 0);
    this.orbit.minDistance = 2.2;
    this.orbit.maxDistance = 18;
    this.orbit.maxPolarAngle = Math.PI * 0.495; // no pasar por debajo del piso
    this.orbit.autoRotateSpeed = 1.2;
    this.orbit.addEventListener('start', () => {
      this.tween = undefined;
      this.framedView = null;
    });

    this.transform = new TransformControls(this.camera, renderer.domElement);
    this.transform.setSize(0.72);
    this.transform.addEventListener('change', () => this.requestRender());
    this.transform.addEventListener('objectChange', () => this.constrainDraggedObject());
    this.transform.addEventListener('dragging-changed', (e: any) => {
      this.orbit.enabled = !e.value;
      const obj = this.transform.object;
      if (!e.value && obj?.userData['instanceId']) {
        const detail = {
          instanceId: obj.userData['instanceId'] as string,
          transform: this.readTransform(obj)
        };
        this.zone.run(() => this.transformChanged.emit(detail));
      }
    });
    this.scene.add(this.transform.getHelper());

    this.buildLights();
    this.buildStage();
    this.scene.add(this.vehicleRoot, this.accessoryRoot, this.graphicRoot, this.interiorRoot);
    this.buildDemoInterior();
    this.syncViewMode(false);

    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(el);
    this.resize();
    this.animate();
  }

  private buildLights() {
    this.keyLight.position.set(4, 8, 5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.bias = -0.0002;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight, this.keyLight.target);
    const fill = new THREE.DirectionalLight(0xb7d3ff, 0.55);
    fill.position.set(-6, 3, -4);
    this.scene.add(fill);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c0ca, 0.4));
  }

  /** Piso de estudio: degradado radial que se funde con el fondo + plano que solo recibe sombras. */
  private buildStage() {
    const size = 512,
      c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, '#EFF1F3');
    g.addColorStop(0.5, '#E2E5E9');
    g.addColorStop(1, BACKGROUND);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, depthWrite: false })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.002;
    floor.renderOrder = -1;
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ opacity: 0.38 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.receiveShadow = true;
    this.stage.add(floor, shadow);
    this.scene.add(this.stage);
  }

  /** Ajusta la cámara de sombras al tamaño del vehículo para sombras nítidas. */
  private fitShadowToVehicle(box: THREE.Box3) {
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.z) * 0.75 + 0.6;
    const cam = this.keyLight.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 0.5;
    cam.far = 30;
    cam.updateProjectionMatrix();
    this.keyLight.target.position.copy(center);
    this.keyLight.position.copy(center).add(new THREE.Vector3(4, 8, 5).normalize().multiplyScalar(12));
  }

  private resize() {
    if (!this.renderer) return;
    const { width: w, height: h } = this.viewerSize();
    if (!w || !h) return; // visor oculto: se conserva la proporción anterior hasta que vuelva a mostrarse
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Cambió el tamaño (giro del móvil, paneles, iframe): se vuelve a centrar la vista si el usuario no movió la cámara.
    if (this.framedView && !this.autoRotate) this.setView(this.framedView, false);
    this.requestRender();
  }

  // Render bajo demanda
  private requestRender() {
    this.needsRender = true;
  }
  /** La escena cambió (no solo la cámara): también hay que rehacer las sombras. */
  private markSceneChanged() {
    if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
  }

  private animate = () => {
    this.raf = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const tweening = this.stepTween();
    const orbitMoved = this.orbit.update(delta);
    if (!this.renderer || !(this.needsRender || tweening || orbitMoved)) return;
    this.needsRender = false;
    this.renderer.render(this.scene, this.camera);
  };

  // Cámara
  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    this.orbit.autoRotate = this.autoRotate;
    if (this.autoRotate) this.framedView = null; // la cámara gira: ya no corresponde a una vista fija
    this.requestRender();
  }

  resetCamera(animate = true) {
    this.setView('iso', animate);
  }

  setView(view: CameraView, animate = true) {
    if (!this.vehicleRoot.children.length || this.viewMode === 'interior') return;
    // Vista encuadrada automáticamente: se vuelve a centrar si cambia el tamaño del visor, hasta que el usuario mueva la cámara.
    this.framedView = view;
    const { width, height } = this.viewerSize();
    if (!width || !height) return; // visor oculto (paneles en móvil): se encuadra al mostrarse, desde resize()
    const { position, target } = this.frameBox(
      this.vehicleBox(),
      VIEW_DIRECTIONS[view],
      width,
      height,
      FRAME_PAD.x,
      FRAME_PAD.y
    );
    this.flyTo(position, target, animate);
  }

  private vehicleBox() {
    return new THREE.Box3().setFromObject(this.vehicleRoot);
  }
  private viewerSize() {
    const el = this.host.nativeElement;
    return { width: el.clientWidth, height: el.clientHeight };
  }

  /**
   * Encuadre centrado mirando desde `dir`: posición y punto de mira para que el vehículo quede en el centro del visor
   * y lo más grande posible, con un margen en píxeles a cada lado (deja libre la barra de botones) en cualquier
   * proporción de pantalla. Centra la imagen proyectada en perspectiva, no solo el centro geométrico de la caja.
   */
  private frameBox(
    box: THREE.Box3,
    dir: THREE.Vector3,
    width: number,
    height: number,
    padX: number,
    padY: number
  ) {
    const center = box.getCenter(new THREE.Vector3());
    const back = dir.clone().normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(back).normalize();
    const up = back.clone().cross(right);
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2),
      tanH = (tanV * width) / height;
    // Fracción del visor que puede ocupar el vehículo en cada eje (1 = de borde a borde).
    const fillX = clamp(1 - (2 * padX) / width, 0.55, 0.94),
      fillY = clamp(1 - (2 * padY) / height, 0.55, 0.94);
    const corner = new THREE.Vector3(),
      pts: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < 8; i++) {
      corner
        .set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
        .sub(center);
      pts.push({ x: corner.dot(right), y: corner.dot(up), z: corner.dot(back) });
    }
    const nearest = Math.max(...pts.map(p => p.z));
    let ox = 0,
      oy = 0,
      d = Math.max(
        ...pts.map(p => p.z + Math.max(Math.abs(p.x) / (tanH * fillX), Math.abs(p.y) / (tanV * fillY)))
      );
    // Proyección de las esquinas en coordenadas de pantalla (-1..1) y la profundidad de las que marcan cada borde.
    const project = () => {
      const r = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
        dMinX: d,
        dMaxX: d,
        dMinY: d,
        dMaxY: d
      };
      for (const p of pts) {
        const depth = d - p.z,
          x = (p.x - ox) / (depth * tanH),
          y = (p.y - oy) / (depth * tanV);
        if (x < r.minX) {
          r.minX = x;
          r.dMinX = depth;
        }
        if (x > r.maxX) {
          r.maxX = x;
          r.dMaxX = depth;
        }
        if (y < r.minY) {
          r.minY = y;
          r.dMinY = depth;
        }
        if (y > r.maxY) {
          r.maxY = y;
          r.dMaxY = depth;
        }
      }
      return r;
    };
    for (let i = 0; i < 24; i++) {
      // Centrar: desplaza el punto de mira para que los bordes opuestos queden a la misma distancia del centro.
      for (let j = 0; j < 3; j++) {
        const r = project();
        ox += ((r.minX + r.maxX) * tanH) / (1 / r.dMinX + 1 / r.dMaxX);
        oy += ((r.minY + r.maxY) * tanV) / (1 / r.dMinY + 1 / r.dMaxY);
      }
      // Acercar o alejar hasta ocupar la fracción permitida en el eje que más limita.
      const r = project();
      d = Math.max(nearest + 0.1, d * Math.max((r.maxX - r.minX) / 2 / fillX, (r.maxY - r.minY) / 2 / fillY));
    }
    d = clamp(d, this.orbit.minDistance, this.orbit.maxDistance);
    const target = center.addScaledVector(right, ox).addScaledVector(up, oy);
    return { target, position: target.clone().addScaledVector(back, d) };
  }

  private flyTo(position: THREE.Vector3, target: THREE.Vector3, animate = true) {
    if (!animate) {
      this.tween = undefined;
      this.camera.position.copy(position);
      this.orbit.target.copy(target);
      this.orbit.update();
      this.requestRender();
      return;
    }
    this.tween = {
      fromPos: this.camera.position.clone(),
      fromTarget: this.orbit.target.clone(),
      toPos: position.clone(),
      toTarget: target.clone(),
      start: performance.now(),
      duration: 650
    };
  }

  private stepTween() {
    const t = this.tween;
    if (!t) return false;
    const k = clamp((performance.now() - t.start) / t.duration, 0, 1),
      e = easeInOut(k);
    this.camera.position.lerpVectors(t.fromPos, t.toPos, e);
    this.orbit.target.lerpVectors(t.fromTarget, t.toTarget, e);
    if (k >= 1) this.tween = undefined;
    return true;
  }

  // Captura
  /** Imagen PNG de la vista actual, sin gizmos ni resaltados de selección. */
  capture(): string {
    if (!this.renderer) return '';
    const helper = this.transform.getHelper(),
      helperVisible = helper.visible;
    helper.visible = false;
    this.setHighlight(null, null);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    helper.visible = helperVisible;
    this.syncHighlights();
    return url;
  }

  /**
   * Fotos de cada lado del vehículo configurado (JPEG, sin gizmos ni resaltados) para la cotización.
   * Espera a que terminen de cargar el modelo y las piezas; luego deja la vista como estaba.
   */
  async captureViews(width = 1280, height = 800): Promise<Record<string, string>> {
    if (!this.renderer) throw new Error('El visor 3D no está disponible en este navegador.');
    const start = performance.now();
    while ((this.loading || this.pendingAccessories.size) && performance.now() - start < 20000)
      await new Promise(r => setTimeout(r, 150));
    if (!this.vehicleRoot.children.length) throw new Error('El modelo 3D no terminó de cargar.');
    const renderer = this.renderer,
      canvas = renderer.domElement;
    const prev = {
      ratio: renderer.getPixelRatio(),
      position: this.camera.position.clone(),
      target: this.orbit.target.clone(),
      vehicle: this.vehicleRoot.visible,
      accessories: this.accessoryRoot.visible,
      graphics: this.graphicRoot.visible,
      interior: this.interiorRoot.visible
    };
    const helper = this.transform.getHelper(),
      helperVisible = helper.visible;
    helper.visible = false;
    this.setHighlight(null, null);
    this.tween = undefined;
    this.vehicleRoot.visible = this.accessoryRoot.visible = this.graphicRoot.visible = true;
    this.interiorRoot.visible = false;
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
    const out: Record<string, string> = {};
    try {
      const box = this.vehicleBox();
      for (const [id, dir] of PHOTO_VIEWS) {
        const { position, target } = this.frameBox(box, dir, width, height, width * 0.05, height * 0.07);
        this.camera.position.copy(position);
        this.camera.lookAt(target);
        renderer.render(this.scene, this.camera);
        out[id] = canvas.toDataURL('image/jpeg', 0.88);
      }
    } finally {
      this.vehicleRoot.visible = prev.vehicle;
      this.accessoryRoot.visible = prev.accessories;
      this.graphicRoot.visible = prev.graphics;
      this.interiorRoot.visible = prev.interior;
      renderer.setPixelRatio(prev.ratio);
      this.resize();
      this.camera.position.copy(prev.position);
      this.orbit.target.copy(prev.target);
      this.orbit.update();
      helper.visible = helperVisible;
      this.syncHighlights();
      this.markSceneChanged();
    }
    return out;
  }

  downloadImage() {
    const url = this.capture();
    if (!url) return;
    const a = document.createElement('a');
    const name = [this.vehicle?.brand, this.vehicle?.model].filter(Boolean).join('-') || 'configuracion';
    a.href = url;
    a.download = `KASAC-${name}-${new Date().toISOString().slice(0, 10)}.png`.replace(/\s+/g, '-');
    a.click();
  }

  // Vehículo
  private loadVehicle() {
    const vehicle = this.vehicle;
    const seq = ++this.vehicleSeq;
    this.transform.detach();
    this.clearVehicle();
    this.clearGraphics();
    if (!vehicle) return;
    this.loading = true;
    this.progress = 0;
    this.loadError = '';
    loadModel(vehicle.modelPath, ratio => {
      if (seq === this.vehicleSeq) this.zone.run(() => (this.progress = Math.round(ratio * 100)));
    })
      .then(root => {
        // Si mientras cargaba se eligió otro vehículo o se cerró el visor, se descarta este.
        if (seq !== this.vehicleSeq || this.destroyed) return;
        this.prepareVehicle(root);
        this.vehicleRoot.add(root);
        const box = this.vehicleBox();
        this.fitShadowToVehicle(box);
        this.zone.run(() => {
          this.loading = false;
          this.progress = 100;
        });
        this.syncGraphics();
        this.syncViewMode(false);
        if (this.viewMode === 'exterior') this.setView('iso', false);
        this.markSceneChanged();
      })
      .catch(e => {
        if (seq !== this.vehicleSeq) return;
        console.error(e);
        this.zone.run(() => {
          this.loading = false;
          this.loadError =
            'No se pudo cargar el modelo 3D de este vehículo. Revise su conexión e inténtelo de nuevo.';
        });
      });
  }

  retryLoad() {
    this.loadVehicle();
  }

  private prepareVehicle(root: THREE.Object3D) {
    this.vehicleMeshes = [];
    this.paintMaterial = undefined;
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (ANCHOR_MESH.test(mesh.name)) {
        mesh.visible = false;
        return;
      }
      const mats = materialsOf(mesh) as THREE.MeshStandardMaterial[];
      const transparent = mats.some(m => m.transparent);
      mesh.castShadow = !transparent;
      mesh.receiveShadow = true;
      // Vidrios y micas: sin escribir profundidad para que no tapen lo que hay detrás.
      for (const m of mats) if (m.transparent) m.depthWrite = false;
      const isPaint =
        !transparent &&
        mats.length === 1 &&
        (PAINT_MATERIAL.test(mats[0].name) || PAINT_MESH.test(mesh.name));
      if (isPaint) mesh.material = this.paintFrom(mats[0]);
      this.vehicleMeshes.push(mesh);
    });
    this.applyPaint();
  }

  /** Pintura automotriz: el material original con una capa de barniz (clearcoat) para reflejos realistas. */
  private paintFrom(source: THREE.MeshStandardMaterial) {
    if (this.paintMaterial) return this.paintMaterial;
    this.originalPaint.copy(source.color);
    this.paintMaterial = new THREE.MeshPhysicalMaterial({
      name: 'KASAC Paint',
      color: source.color.clone(),
      metalness: clamp(source.metalness, 0.2, 0.45),
      roughness: clamp(source.roughness, 0.25, 0.45),
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      // GLTFLoader activa flatShading cuando el GLB no trae normales (caso de la Hilux); sin esto se vería negro.
      flatShading: source.flatShading,
      side: source.side
    });
    return this.paintMaterial;
  }

  private applyPaint() {
    if (!this.paintMaterial) return;
    if (this.paintColor) this.paintMaterial.color.set(this.paintColor);
    else this.paintMaterial.color.copy(this.originalPaint);
    this.requestRender();
  }

  private clearVehicle() {
    this.vehicleRoot.clear();
    this.vehicleMeshes = [];
    this.paintMaterial?.dispose();
    this.paintMaterial = undefined;
  }

  /** Construye (una sola vez por geometría) el árbol BVH de la carrocería para colocar gráfica con precisión. */
  private prepareSurfaceRaycast() {
    for (const mesh of this.vehicleMeshes) if (!mesh.geometry.boundsTree) mesh.geometry.computeBoundsTree();
  }

  // Accesorios
  private syncAccessories() {
    if (!this.renderer) return;
    const wanted = new Set(this.accessories.map(a => a.instanceId));
    for (const [id, obj] of this.accessoryObjects) {
      if (wanted.has(id)) continue;
      if (this.transform.object === obj) this.transform.detach();
      this.accessoryRoot.remove(obj);
      this.disposeInstanceMaterials(obj);
      this.accessoryObjects.delete(id);
      if (this.hoveredId === id) this.hoveredId = null;
    }
    for (const item of this.accessories) {
      const existing = this.accessoryObjects.get(item.instanceId);
      if (existing) {
        this.applyTransform(existing, item.transform);
        continue;
      }
      if (this.pendingAccessories.has(item.instanceId) || !item.fitment.modelPath) continue;
      this.pendingAccessories.add(item.instanceId);
      loadModel(item.fitment.modelPath)
        .then(obj => {
          this.pendingAccessories.delete(item.instanceId);
          // Puede haberse eliminado (o deshecho) mientras se descargaba.
          const current = this.accessories.find(a => a.instanceId === item.instanceId);
          if (this.destroyed || !current || this.accessoryObjects.has(item.instanceId)) return;
          this.prepareAccessory(obj, current);
          this.applyTransform(obj, current.transform);
          this.accessoryRoot.add(obj);
          this.accessoryObjects.set(item.instanceId, obj);
          this.syncTransformControls();
          this.syncHighlights();
          this.markSceneChanged();
        })
        .catch(e => {
          this.pendingAccessories.delete(item.instanceId);
          console.error(e);
          this.showWarning(`No se pudo cargar el modelo de «${item.name}».`);
        });
    }
    this.markSceneChanged();
  }

  private prepareAccessory(obj: THREE.Object3D, item: SelectedAccessory) {
    obj.userData['instanceId'] = item.instanceId;
    obj.userData['catalogItemId'] = item.catalogItemId;
    obj.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData['instanceId'] = item.instanceId;
      // Materiales propios de esta pieza para poder resaltarla sin afectar a otras copias.
      const own = materialsOf(mesh).map(m => {
        const c = m.clone() as THREE.MeshStandardMaterial;
        if (c.emissive)
          c.userData['baseEmissive'] = { color: c.emissive.clone(), intensity: c.emissiveIntensity };
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? own : own[0];
    });
  }

  private disposeInstanceMaterials(obj: THREE.Object3D) {
    obj.traverse(o => {
      if ((o as THREE.Mesh).isMesh) materialsOf(o as THREE.Mesh).forEach(m => m.dispose());
    });
  }

  private syncTransformControls() {
    if (!this.transform) return;
    this.transform.detach();
    if (this.readonly || this.viewMode === 'interior' || !this.selectedInstanceId)
      return this.requestRender();
    const item = this.accessories.find(a => a.instanceId === this.selectedInstanceId);
    const obj = this.accessoryObjects.get(this.selectedInstanceId);
    if (item && obj && item.fitment.placementMode !== 'fixed') {
      this.transform.setMode(this.transformMode);
      this.transform.attach(obj);
    }
    this.requestRender();
  }

  /** Mientras se arrastra: mantiene la pieza dentro de su zona permitida y con escala uniforme y limitada. */
  private constrainDraggedObject() {
    const obj = this.transform.object;
    const item = obj && this.accessories.find(a => a.instanceId === obj.userData['instanceId']);
    if (!obj || !item) return;
    const b = item.fitment.bounds;
    if (b) {
      obj.position.set(
        clamp(obj.position.x, b.min.x, b.max.x),
        clamp(obj.position.y, b.min.y, b.max.y),
        clamp(obj.position.z, b.min.z, b.max.z)
      );
    }
    if (this.transform.mode === 'scale') {
      // Un faro o una baliza no se deforma: se toma el eje que más cambió y se aplica a los tres.
      const prev = item.transform.scale;
      const ratios = [obj.scale.x / prev.x, obj.scale.y / prev.y, obj.scale.z / prev.z];
      const k = ratios.reduce((a, r) => (Math.abs(Math.log(r)) > Math.abs(Math.log(a)) ? r : a), 1);
      obj.scale.set(
        clamp(prev.x * k, SCALE_LIMITS.min, SCALE_LIMITS.max),
        clamp(prev.y * k, SCALE_LIMITS.min, SCALE_LIMITS.max),
        clamp(prev.z * k, SCALE_LIMITS.min, SCALE_LIMITS.max)
      );
    }
    this.markSceneChanged();
  }

  private applyTransform(o: THREE.Object3D, t: Transform3D) {
    o.position.set(t.position.x, t.position.y, t.position.z);
    o.rotation.set(
      THREE.MathUtils.degToRad(t.rotation.x),
      THREE.MathUtils.degToRad(t.rotation.y),
      THREE.MathUtils.degToRad(t.rotation.z)
    );
    o.scale.set(t.scale.x, t.scale.y, t.scale.z);
  }

  private readTransform(o: THREE.Object3D): Transform3D {
    const r = (v: number, d: number) => +v.toFixed(d),
      deg = THREE.MathUtils.radToDeg;
    return {
      position: { x: r(o.position.x, 4), y: r(o.position.y, 4), z: r(o.position.z, 4) },
      rotation: { x: r(deg(o.rotation.x), 2), y: r(deg(o.rotation.y), 2), z: r(deg(o.rotation.z), 2) },
      scale: { x: r(o.scale.x, 4), y: r(o.scale.y, 4), z: r(o.scale.z, 4) }
    };
  }

  // Selección y resaltado
  private syncHighlights() {
    this.setHighlight(this.readonly ? null : this.selectedInstanceId, this.readonly ? null : this.hoveredId);
  }

  private setHighlight(selectedId: string | null, hoveredId: string | null) {
    for (const [id, obj] of this.accessoryObjects) {
      const level = id === selectedId ? 0.42 : id === hoveredId ? 0.2 : 0;
      obj.traverse(o => {
        if (!(o as THREE.Mesh).isMesh) return;
        for (const m of materialsOf(o as THREE.Mesh) as THREE.MeshStandardMaterial[]) {
          const base = m.userData['baseEmissive'];
          if (!base) continue;
          if (level) {
            m.emissive.copy(ACCENT);
            m.emissiveIntensity = level;
          } else {
            m.emissive.copy(base.color);
            m.emissiveIntensity = base.intensity;
          }
        }
      });
    }
    this.requestRender();
  }

  private pickAccessory(): string | null {
    const hit = this.raycaster.intersectObjects([...this.accessoryObjects.values()], true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !o.userData['instanceId']) o = o.parent;
    return o?.userData['instanceId'] ?? null;
  }

  // Puntero
  private get interactive() {
    return !this.readonly && this.viewMode === 'exterior';
  }
  private get drawingTool() {
    return this.graphicTool.active && this.graphicTool.preset?.type === 'reflective';
  }
  private get stickerTool() {
    return this.graphicTool.active && this.graphicTool.preset?.type === 'sticker';
  }

  private setPointer(ev: PointerEvent) {
    const r = this.renderer!.domElement.getBoundingClientRect();
    this.pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private onPointerDown = (ev: PointerEvent) => {
    if (!this.interactive || ev.button > 0) return;
    // TransformControls procesa el evento antes y deja `axis` marcado si se tocó el gizmo.
    this.down = { x: ev.clientX, y: ev.clientY, onGizmo: this.transform.axis !== null };
    if (this.drawingTool) {
      this.drawingLine = true;
      this.linePoints = [];
      this.orbit.enabled = false; // dibujar no debe girar la cámara
      this.renderer!.domElement.setPointerCapture(ev.pointerId);
      this.captureLinePoint(ev);
    }
  };

  private onPointerMove = (ev: PointerEvent) => {
    if (this.drawingLine) {
      this.captureLinePoint(ev);
      return;
    }
    if (!this.interactive || ev.pointerType === 'touch' || ev.buttons) return;
    // Resaltado al pasar el mouse: como máximo un raycast por cuadro.
    this.lastPointerEvent = ev;
    if (this.hoverQueued) return;
    this.hoverQueued = true;
    requestAnimationFrame(() => {
      this.hoverQueued = false;
      if (!this.lastPointerEvent || this.destroyed) return;
      this.setPointer(this.lastPointerEvent);
      const id = this.graphicTool.active || this.transform.axis !== null ? null : this.pickAccessory();
      if (id !== this.hoveredId) {
        this.hoveredId = id;
        this.syncHighlights();
      }
      this.updateCursor();
    });
  };

  private onPointerUp = (ev: PointerEvent) => {
    if (this.drawingLine) {
      this.finishLine(ev);
      return;
    }
    const down = this.down;
    this.down = undefined;
    if (!this.interactive || !down || down.onGizmo) return;
    // Solo un clic (sin arrastrar) selecciona o coloca: así girar la cámara no deselecciona ni pega viniles.
    if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > CLICK_TOLERANCE_PX) return;
    this.setPointer(ev);
    if (this.stickerTool) {
      this.placeSticker();
      return;
    }
    if (this.graphicTool.active) return;
    const id = this.pickAccessory();
    if (id !== this.selectedInstanceId) this.zone.run(() => this.selectInstance.emit(id));
  };

  private onPointerCancel = () => {
    this.down = undefined;
    if (this.drawingLine) {
      this.drawingLine = false;
      this.linePoints = [];
      this.orbit.enabled = true;
      this.removeLinePreview();
    }
  };

  private onPointerLeave = () => {
    this.lastPointerEvent = undefined;
    if (this.hoveredId) {
      this.hoveredId = null;
      this.syncHighlights();
    }
  };

  private updateCursor() {
    if (!this.renderer) return;
    const canvas = this.renderer.domElement;
    canvas.style.cursor = !this.interactive
      ? 'grab'
      : this.graphicTool.active
        ? 'crosshair'
        : this.transform.axis
          ? 'move'
          : this.hoveredId
            ? 'pointer'
            : 'grab';
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(this.raf);
    this.zone.run(
      () =>
        (this.loadError =
          'Se perdió el contexto gráfico del navegador. Espera un momento o recarga la página.')
    );
  };

  private onContextRestored = () => {
    this.zone.run(() => (this.loadError = ''));
    this.markSceneChanged();
    this.animate();
  };

  private showWarning(text: string) {
    this.zone.run(() => {
      this.warning = text;
      clearTimeout(this.warningTimer);
      this.warningTimer = setTimeout(() => this.zone.run(() => (this.warning = '')), 4500);
    });
  }

  // Gráfica: reflectivos y viniles
  private surfaceHit() {
    return this.raycaster.intersectObjects(this.vehicleMeshes, false)[0];
  }

  private captureLinePoint(ev: PointerEvent) {
    this.setPointer(ev);
    const hit = this.surfaceHit();
    if (!hit) return;
    const last = this.linePoints.at(-1);
    if (last && hit.point.distanceTo(new THREE.Vector3(last.x, last.y, last.z)) <= 0.06) return;
    this.linePoints.push({
      x: +hit.point.x.toFixed(4),
      y: +hit.point.y.toFixed(4),
      z: +hit.point.z.toFixed(4)
    });
    this.updateLinePreview();
  }

  private finishLine(ev: PointerEvent) {
    this.captureLinePoint(ev);
    this.drawingLine = false;
    this.orbit.enabled = true;
    this.removeLinePreview();
    const pts = this.linePoints;
    this.linePoints = [];
    const p = this.graphicTool.preset;
    if (pts.length < 2 || !p) return;
    let length = 0;
    for (let i = 1; i < pts.length; i++)
      length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z);
    const item: GraphicPlacement = {
      instanceId: crypto.randomUUID(),
      presetId: p.id,
      type: 'reflective',
      name: p.name,
      widthCm: this.graphicTool.widthCm,
      heightCm: this.graphicTool.heightCm,
      color: p.color,
      position: pts[0],
      normal: { x: 0, y: 1, z: 0 },
      rotation: this.graphicTool.rotation,
      points: pts,
      lengthM: +length.toFixed(3)
    };
    this.zone.run(() => this.graphicPlaced.emit(item));
  }

  /** Línea provisional que sigue al dedo/mouse mientras se traza el reflectivo. */
  private updateLinePreview() {
    const pts = this.linePoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
    if (!this.linePreview) {
      this.linePreview = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: this.graphicTool.preset?.color || '#f7d21e', depthTest: false })
      );
      this.linePreview.renderOrder = 10;
      this.scene.add(this.linePreview);
    }
    this.linePreview.geometry.dispose();
    this.linePreview.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.requestRender();
  }

  private removeLinePreview() {
    if (!this.linePreview) return;
    this.scene.remove(this.linePreview);
    this.linePreview.geometry.dispose();
    (this.linePreview.material as THREE.Material).dispose();
    this.linePreview = undefined;
    this.requestRender();
  }

  private placeSticker() {
    const hit = this.surfaceHit();
    const p = this.graphicTool.preset;
    if (!hit || !p) return;
    const n = (hit.face?.normal || new THREE.Vector3(0, 0, 1))
      .clone()
      .transformDirection(hit.object.matrixWorld)
      .normalize();
    const item: GraphicPlacement = {
      instanceId: crypto.randomUUID(),
      presetId: p.id,
      type: 'sticker',
      name: p.name,
      widthCm: this.graphicTool.widthCm,
      heightCm: this.graphicTool.heightCm,
      color: p.color,
      position: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
      normal: { x: n.x, y: n.y, z: n.z },
      rotation: this.graphicTool.rotation
    };
    this.zone.run(() => this.graphicPlaced.emit(item));
  }

  private syncGraphics() {
    if (!this.renderer || !this.vehicleMeshes.length) return;
    this.clearGraphics();
    if (!this.graphics.length) return this.markSceneChanged();
    this.prepareSurfaceRaycast();
    for (const g of this.graphics) {
      if (g.type === 'reflective') this.buildReflective(g);
      else this.buildSticker(g);
    }
    this.markSceneChanged();
  }

  private buildReflective(g: GraphicPlacement) {
    const pts = (g.points || []).map(p => new THREE.Vector3(p.x, p.y, p.z));
    if (pts.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const geo = new THREE.TubeGeometry(
      curve,
      Math.max(8, pts.length * 3),
      Math.max(0.008, g.heightCm / 200),
      8,
      false
    );
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(g.color),
      emissive: new THREE.Color(g.color),
      emissiveIntensity: 0.25,
      roughness: 0.4,
      metalness: 0.15
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData['graphicId'] = g.instanceId;
    this.graphicRoot.add(mesh);
  }

  private buildSticker(g: GraphicPlacement) {
    const normal = new THREE.Vector3(g.normal.x, g.normal.y, g.normal.z).normalize();
    const origin = new THREE.Vector3(g.position.x, g.position.y, g.position.z).addScaledVector(normal, 0.12);
    this.raycaster.set(origin, normal.clone().negate());
    const hit = this.surfaceHit();
    if (!hit) return;
    const orientation = this.orientationFromNormal(normal, g.rotation);
    const size = new THREE.Vector3(g.widthCm / 100, g.heightCm / 100, 0.08);
    const geo = new DecalGeometry(hit.object as THREE.Mesh, hit.point, orientation, size);
    const mat = new THREE.MeshStandardMaterial({
      map: this.makeGraphicTexture(g),
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      roughness: 0.5,
      metalness: 0
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData['graphicId'] = g.instanceId;
    this.graphicRoot.add(mesh);
  }

  private orientationFromNormal(normal: THREE.Vector3, rotationDeg: number) {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const e = new THREE.Euler().setFromQuaternion(q);
    e.z += THREE.MathUtils.degToRad(rotationDeg);
    return e;
  }

  /** Textura del vinil con la misma proporción que su medida real, para que el texto no se deforme. */
  private makeGraphicTexture(g: GraphicPlacement) {
    const aspect = clamp(g.widthCm / Math.max(1, g.heightCm), 0.125, 8);
    const c = document.createElement('canvas');
    c.width = aspect >= 1 ? 1024 : Math.round(1024 * aspect);
    c.height = aspect >= 1 ? Math.round(1024 / aspect) : 1024;
    const x = c.getContext('2d')!;
    x.fillStyle = g.color;
    x.fillRect(0, 0, c.width, c.height);
    if (g.type === 'sticker') {
      const text = g.name.includes('Unidad') ? 'UNIDAD' : 'KASAC';
      const fontSize = Math.min(c.height * 0.62, c.width / (text.length * 0.72));
      x.fillStyle = '#ffffff';
      x.font = `900 ${Math.round(fontSize)}px Arial, sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(text, c.width / 2, c.height / 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, this.renderer?.capabilities.getMaxAnisotropy() || 1);
    return t;
  }

  private clearGraphics() {
    this.disposeTree(this.graphicRoot);
    this.graphicRoot.clear();
  }

  // Interior demostrativo
  private buildDemoInterior() {
    this.interiorRoot.clear();
    this.interiorRoot.visible = false;
    this.interiorMaterials = [];
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x171d25, roughness: 0.82, metalness: 0.05 });
    const dashMat = new THREE.MeshStandardMaterial({ color: 0x202733, roughness: 0.68, metalness: 0.08 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x7890a8,
      transparent: true,
      opacity: 0.16,
      roughness: 0.15,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const seatMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.interiorMaterialColor),
      roughness: 0.7,
      metalness: 0.02
    });
    this.interiorMaterials.push(seatMat);
    const box = (
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0
    ) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      m.receiveShadow = true;
      this.interiorRoot.add(m);
      return m;
    };
    box(1.65, 0.08, 3.25, shellMat, 0, 0.08, 0);
    box(1.7, 0.1, 3.2, shellMat, 0, 1.75, 0);
    box(0.08, 1.75, 3.1, shellMat, -0.86, 0.88, 0);
    box(0.08, 1.75, 3.1, shellMat, 0.86, 0.88, 0);
    box(1.55, 0.42, 0.55, dashMat, 0, 1.02, -1.3, -0.08, 0, 0);
    box(0.32, 0.18, 0.75, dashMat, 0, 0.62, -0.62);
    const makeSeat = (x: number, z: number) => {
      box(0.56, 0.18, 0.62, seatMat, x, 0.43, z);
      box(0.56, 0.78, 0.16, seatMat, x, 0.83, z + 0.22, -0.12, 0, 0);
      box(0.24, 0.18, 0.18, seatMat, x, 1.29, z + 0.28);
    };
    makeSeat(-0.42, -0.45);
    makeSeat(0.42, -0.45);
    makeSeat(-0.42, 0.83);
    makeSeat(0.42, 0.83);
    box(1.45, 0.78, 0.03, glassMat, 0, 1.31, -1.58, -0.15, 0, 0);
    box(1.45, 0.62, 0.03, glassMat, 0, 1.32, 1.58, 0.08, 0, 0);
    // jaula interior demostrativa / visual de referencia
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.45, metalness: 0.75 });
    const cyl = (a: THREE.Vector3, b: THREE.Vector3, r = 0.025) => {
      const d = b.clone().sub(a),
        len = d.length();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), tubeMat);
      m.position.copy(a.clone().add(b).multiplyScalar(0.5));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      this.interiorRoot.add(m);
    };
    cyl(new THREE.Vector3(-0.72, 0.2, 0.15), new THREE.Vector3(-0.72, 1.65, 0.15));
    cyl(new THREE.Vector3(0.72, 0.2, 0.15), new THREE.Vector3(0.72, 1.65, 0.15));
    cyl(new THREE.Vector3(-0.72, 1.65, 0.15), new THREE.Vector3(0.72, 1.65, 0.15));
  }

  private syncViewMode(viewModeChanged: boolean) {
    if (!this.renderer) return;
    const interior = this.viewMode === 'interior';
    this.vehicleRoot.visible = !interior;
    this.accessoryRoot.visible = !interior;
    this.graphicRoot.visible = !interior;
    this.interiorRoot.visible = interior;
    this.interiorMaterials.forEach(m => m.color.set(this.interiorMaterialColor));
    if (interior) {
      this.transform.detach();
      this.orbit.autoRotate = false;
      this.orbit.minDistance = 0.25;
      this.orbit.maxDistance = 5;
      this.orbit.maxPolarAngle = Math.PI;
      const q = INTERIOR_POSES[this.interiorCamera];
      this.flyTo(new THREE.Vector3(q[0], q[1], q[2]), new THREE.Vector3(q[3], q[4], q[5]), !viewModeChanged);
    } else {
      this.orbit.minDistance = 2.2;
      this.orbit.maxDistance = 18;
      this.orbit.maxPolarAngle = Math.PI * 0.495;
      this.orbit.autoRotate = this.autoRotate;
      if (viewModeChanged) this.setView('iso', false);
      this.syncTransformControls();
    }
    this.markSceneChanged();
  }

  // Utilidades
  /** Libera geometrías, materiales y texturas creados por el visor (no los modelos en caché). */
  private disposeTree(root: THREE.Object3D) {
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      for (const m of materialsOf(mesh)) {
        (m as THREE.MeshStandardMaterial).map?.dispose();
        m.dispose();
      }
    });
  }
}
