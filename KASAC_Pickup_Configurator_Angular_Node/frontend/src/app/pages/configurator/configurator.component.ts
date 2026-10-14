import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { COMMERCIAL_ENABLED, EMBEDDED } from '../../app.variant';
import { FEATURES } from '../../features';
import { ApiService } from '../../core/api.service';
import {
  CatalogItem,
  CatalogResponse,
  CustomerPayload,
  Fitment,
  GraphicPlacement,
  GraphicPreset,
  PaintOption,
  SelectedAccessory,
  Transform3D,
  Vehicle,
  InteriorConfiguration
} from '../../models/domain';
import { GraphicToolState, ThreeViewerComponent } from '../../components/three-viewer/three-viewer.component';

interface Snapshot {
  accessories: SelectedAccessory[];
  graphics: GraphicPlacement[];
}
@Component({
  selector: 'app-configurator',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ThreeViewerComponent],
  templateUrl: './configurator.component.html',
  styleUrl: './configurator.component.css'
})
export class ConfiguratorComponent implements OnInit {
  readonly commercialEnabled = COMMERCIAL_ENABLED;
  readonly embedded = EMBEDDED;
  readonly features = FEATURES;
  catalog = signal<CatalogResponse | null>(null);
  vehicle = signal<Vehicle | null>(null);
  accessories = signal<SelectedAccessory[]>([]);
  graphics = signal<GraphicPlacement[]>([]);
  selectedInstanceId = signal<string | null>(null);
  phase = signal<'vehicle' | 'configure' | 'contact' | 'success'>('vehicle');
  leftTab = signal<'equipment' | 'graphics' | 'interior'>('equipment');
  mobilePanel = signal<'catalog' | 'viewer' | 'summary'>('viewer');
  category = signal<'all' | 'proteccion' | 'iluminacion' | 'utilidad'>('all');
  transformMode = signal<'translate' | 'rotate' | 'scale'>('translate');
  busy = signal(false);
  error = signal('');
  successCode = signal('');
  publicUrl = signal('');
  copied = signal(false);
  graphicPreset = signal<GraphicPreset | null>(null);
  graphicWidth = signal(40);
  graphicHeight = signal(12);
  graphicRotation = signal(0);
  graphicActive = signal(false);
  paint = signal<PaintOption | null>(null);
  interior = signal<InteriorConfiguration>({ materialId: 'ecocuero', color: '#34373a', camera: 'driver' });
  viewMode = signal<'exterior' | 'interior'>('exterior');
  customer: CustomerPayload = {
    type: 'corporate',
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    ruc: '',
    position: '',
    city: 'Lima',
    notes: ''
  };
  requestNotes = '';
  history: Snapshot[] = [];
  readonly filteredItems = computed(() => {
    const c = this.catalog(),
      v = this.vehicle(),
      cat = this.category();
    if (!c || !v) return [];
    return c.items.filter(i => (cat === 'all' || i.category === cat) && this.fitment(i, v.id)?.compatible);
  });
  readonly selectedAccessory = computed(
    () => this.accessories().find(x => x.instanceId === this.selectedInstanceId()) || null
  );
  readonly graphicTool = computed<GraphicToolState>(() => ({
    active: this.graphicActive(),
    preset: this.graphicPreset(),
    widthCm: this.graphicWidth(),
    heightCm: this.graphicHeight(),
    rotation: this.graphicRotation()
  }));

  constructor(private api: ApiService) {}
  ngOnInit() {
    this.api.getCatalog().subscribe({
      next: c => this.catalog.set(c),
      error: () =>
        this.error.set('No se pudo cargar el catálogo. Verifica que el backend Node.js esté iniciado.')
    });
  }
  chooseVehicle(v: Vehicle) {
    this.vehicle.set(v);
    this.accessories.set([]);
    this.graphics.set([]);
    this.history = [];
    this.phase.set('configure');
    this.mobilePanel.set('viewer');
  }
  changeVehicle() {
    if (this.accessories().length || this.graphics().length) {
      if (!confirm('Cambiar de vehículo eliminará la configuración actual. ¿Continuar?')) return;
    }
    this.vehicle.set(null);
    this.accessories.set([]);
    this.graphics.set([]);
    this.phase.set('vehicle');
  }
  /** Ya está en la configuración (las luces pueden repetirse, así que nunca cuentan como agregadas). */
  isAdded(item: CatalogItem) {
    return item.category !== 'iluminacion' && this.accessories().some(a => a.catalogItemId === item.id);
  }
  fitment(item: CatalogItem, vehicleId: string): Fitment | undefined {
    return item.fitments.find(f => f.vehicleId === vehicleId);
  }
  addItem(item: CatalogItem) {
    const v = this.vehicle();
    if (!v) return;
    const f = this.fitment(item, v.id);
    if (!f?.compatible) return;
    const repeatable = item.category === 'iluminacion';
    const existing = this.accessories().find(a => a.catalogItemId === item.id);
    if (existing && !repeatable) {
      this.selectedInstanceId.set(existing.instanceId);
      return;
    }
    this.remember();
    const a: SelectedAccessory = {
      instanceId: crypto.randomUUID(),
      catalogItemId: item.id,
      name: item.name,
      fitment: structuredClone(f),
      transform: structuredClone(f.transform),
      addedAt: Date.now()
    };
    this.accessories.update(x => [...x, a]);
    this.selectedInstanceId.set(a.instanceId);
    this.mobilePanel.set('viewer');
  }
  removeSelected() {
    const id = this.selectedInstanceId();
    if (!id) return;
    this.remember();
    this.accessories.update(x => x.filter(a => a.instanceId !== id));
    this.selectedInstanceId.set(null);
  }
  removeItem(id: string) {
    this.remember();
    this.accessories.update(x => x.filter(a => a.instanceId !== id));
    if (this.selectedInstanceId() === id) this.selectedInstanceId.set(null);
  }
  onTransform(ev: { instanceId: string; transform: Transform3D }) {
    this.remember();
    this.accessories.update(items =>
      items.map(a =>
        a.instanceId === ev.instanceId ? { ...a, transform: this.clampTransform(a, ev.transform) } : a
      )
    );
  }
  private clampTransform(a: SelectedAccessory, t: Transform3D): Transform3D {
    const c = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v)),
      b = a.fitment.bounds;
    const scale = { x: c(t.scale.x, 0.5, 2), y: c(t.scale.y, 0.5, 2), z: c(t.scale.z, 0.5, 2) };
    if (!b) return { ...t, scale };
    return {
      ...t,
      scale,
      position: {
        x: c(t.position.x, b.min.x, b.max.x),
        y: c(t.position.y, b.min.y, b.max.y),
        z: c(t.position.z, b.min.z, b.max.z)
      }
    };
  }
  onGraphicPlaced(g: GraphicPlacement) {
    this.remember();
    this.graphics.update(x => [...x, g]);
    this.graphicActive.set(false);
  }
  selectGraphicPreset(p: GraphicPreset) {
    this.graphicPreset.set(p);
    this.graphicWidth.set(p.defaultWidthCm);
    this.graphicHeight.set(p.defaultHeightCm);
    this.leftTab.set('graphics');
  }
  deleteGraphic(id: string) {
    this.remember();
    this.graphics.update(x => x.filter(g => g.instanceId !== id));
  }
  undo() {
    const s = this.history.pop();
    if (!s) return;
    this.accessories.set(structuredClone(s.accessories));
    this.graphics.set(structuredClone(s.graphics));
    this.selectedInstanceId.set(null);
  }
  private remember() {
    this.history.push({
      accessories: structuredClone(this.accessories()),
      graphics: structuredClone(this.graphics())
    });
    if (this.history.length > 30) this.history.shift();
  }
  goContact() {
    if (!this.vehicle()) return;
    this.phase.set('contact');
    this.mobilePanel.set('summary');
  }
  backToConfigure() {
    this.phase.set('configure');
    this.mobilePanel.set('viewer');
  }
  validCustomer() {
    if (!this.customer.fullName.trim() || !this.customer.email.trim() || !this.customer.phone.trim())
      return false;
    if (
      this.customer.type === 'corporate' &&
      (!this.customer.companyName?.trim() || !this.customer.ruc?.trim())
    )
      return false;
    return true;
  }
  submit() {
    const v = this.vehicle();
    if (!v || !this.validCustomer()) {
      this.error.set('Completa los datos obligatorios antes de enviar.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api
      .submitLead({
        customer: { ...this.customer },
        configuration: {
          vehicle: v,
          ...(this.paint() ? { paint: this.paint()! } : {}),
          accessories: this.accessories(),
          graphics: this.graphics(),
          ...(FEATURES.interior ? { interior: this.interior() } : {}),
          notes: this.requestNotes
        }
      })
      .subscribe({
        next: r => {
          this.busy.set(false);
          this.successCode.set(r.lead.code);
          this.publicUrl.set(r.publicUrl);
          this.phase.set('success');
        },
        error: e => {
          this.busy.set(false);
          this.error.set(e?.error?.message || 'No se pudo enviar la solicitud.');
        }
      });
  }
  copyLink() {
    navigator.clipboard?.writeText(this.publicUrl()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    });
  }
  setCustomerType(t: 'corporate' | 'personal') {
    this.customer.type = t;
  }
  setLeftTab(tab: 'equipment' | 'graphics' | 'interior') {
    this.leftTab.set(tab);
    this.viewMode.set(tab === 'interior' ? 'interior' : 'exterior');
    this.graphicActive.set(false);
  }
  setInteriorMaterial(id: string) {
    const m = this.catalog()?.interiorMaterials.find(x => x.id === id);
    if (!m) return;
    this.interior.update(v => ({ ...v, materialId: id, color: m.color }));
  }
  setInteriorCamera(camera: InteriorConfiguration['camera']) {
    this.interior.update(v => ({ ...v, camera }));
  }
  setInteriorColor(color: string) {
    this.interior.update(v => ({ ...v, color }));
  }
  // Atajos: W/E/R mover/girar/escalar, Supr eliminar, Esc soltar selección, Ctrl+Z deshacer.
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (this.phase() !== 'configure' || t?.closest('input,textarea,select,[contenteditable]')) return;
    const key = e.key.toLowerCase(),
      s = this.selectedAccessory();
    if ((e.ctrlKey || e.metaKey) && key === 'z') {
      e.preventDefault();
      this.undo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (key === 'escape') {
      this.selectedInstanceId.set(null);
      this.graphicActive.set(false);
      return;
    }
    if (!s) return;
    if (key === 'delete' || key === 'backspace') {
      e.preventDefault();
      this.removeSelected();
      return;
    }
    const modes: Record<string, 'translate' | 'rotate' | 'scale'> = {
      w: 'translate',
      e: 'rotate',
      r: 'scale'
    };
    if (modes[key] && s.fitment.placementMode !== 'fixed') this.transformMode.set(modes[key]);
  }
  statusLabel(s: 'verified' | 'reference' | 'pending') {
    return s === 'verified'
      ? 'Ficha validada'
      : s === 'reference'
        ? 'Datos referenciales'
        : 'Pendiente validar';
  }
}
