export type VehicleId = 'hilux-2024' | 'ranger-2024' | 'l200-2024';
export type CustomerType = 'corporate' | 'personal';
export type PlacementMode = 'fixed' | 'bounded' | 'free';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Transform3D {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}
export interface Vehicle {
  id: VehicleId;
  brand: string;
  model: string;
  year: string;
  subtitle: string;
  modelPath: string;
  quality: 'detailed' | 'reference';
  accent: string;
}
export interface SpecRow {
  label: string;
  value: string;
}
export interface Fitment {
  vehicleId: VehicleId;
  compatible: boolean;
  specStatus: 'verified' | 'reference' | 'pending';
  description: string;
  specs: SpecRow[];
  modelPath?: string;
  placementMode: PlacementMode;
  transform: Transform3D;
  bounds?: { min: Vec3; max: Vec3 };
}
export interface CatalogItem {
  id: string;
  category: 'proteccion' | 'iluminacion' | 'utilidad';
  name: string;
  shortDescription: string;
  fitments: Fitment[];
}
export interface GraphicPreset {
  id: string;
  type: 'sticker' | 'reflective';
  name: string;
  description: string;
  defaultWidthCm: number;
  defaultHeightCm: number;
  color: string;
}
export interface PaintOption {
  id: string;
  name: string;
  color: string;
}
export interface InteriorMaterial {
  id: string;
  name: string;
  description: string;
  color: string;
  roughness: number;
}
export interface InteriorConfiguration {
  materialId: string;
  color: string;
  camera: 'driver' | 'passenger' | 'rear-left' | 'rear-center' | 'rear-right' | 'free';
}
export interface CatalogResponse {
  vehicles: Vehicle[];
  items: CatalogItem[];
  graphics: GraphicPreset[];
  interiorMaterials: InteriorMaterial[];
  paints: PaintOption[];
  notice: string;
}
export interface SelectedAccessory {
  instanceId: string;
  catalogItemId: string;
  name: string;
  fitment: Fitment;
  transform: Transform3D;
  addedAt: number;
}
export interface GraphicPlacement {
  instanceId: string;
  presetId: string;
  type: 'sticker' | 'reflective';
  name: string;
  widthCm: number;
  heightCm: number;
  color: string;
  position: Vec3;
  normal: Vec3;
  rotation: number;
  points?: Vec3[];
  lengthM?: number;
}
export interface ConfigurationSnapshot {
  vehicle: Vehicle;
  paint?: PaintOption;
  accessories: SelectedAccessory[];
  graphics: GraphicPlacement[];
  interior?: InteriorConfiguration;
  notes: string;
}
export interface CustomerPayload {
  type: CustomerType;
  fullName: string;
  email: string;
  phone: string;
  document?: string;
  companyName?: string;
  ruc?: string;
  position?: string;
  city?: string;
  notes?: string;
}
export type LeadStatus = 'NEW' | 'CONTACTED' | 'NEGOTIATING' | 'QUOTED' | 'APPROVED' | 'REJECTED' | 'LOST';
/** Ciclo de la cotización: borrador → emitida (FE) → aprobada (FA) o rechazada. */
export type QuoteState = 'BORRADOR' | 'EMITIDA' | 'APROBADA' | 'RECHAZADA';
export type QuoteSection = 'equipamiento' | 'electrico' | 'metalica' | 'stickers';
export type Currency = 'USD' | 'PEN';
export interface QuoteItem {
  id: string;
  section: QuoteSection;
  code: string;
  description: string;
  vehicles: number;
  quantity: number;
  unitPrice: number;
  discount: number;
}
export interface Quote {
  number: string;
  version: number;
  currency: Currency;
  igvRate: number;
  serviceType: string;
  motive: string;
  paymentTerms: string;
  validityDays: number;
  delivery: string;
  customerName: string;
  customerDocument: string;
  address: string;
  contact: string;
  operation: string;
  purchaseOrder: string;
  plate: string;
  chassis: string;
  model: string;
  color: string;
  year: string;
  observations: string;
  items: QuoteItem[];
  createdAt: string | null;
  updatedAt: string | null;
  state?: QuoteState;
  /** Fecha de emisión (FE): cuando se envió al cliente por primera vez. */
  issuedAt?: string | null;
  /** Fecha de aprobación (FA). */
  approvedAt: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  answeredBy?: string;
}
export interface QuoteTotals {
  sections: { id: QuoteSection; name: string; subtotal: number }[];
  subtotal: number;
  igv: number;
  total: number;
}
export interface QuotePhoto {
  id: string;
  name: string;
  src: string;
}
export interface LeadRequest {
  id: string;
  code: string;
  publicToken: string;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
  customer: CustomerPayload;
  configuration: ConfigurationSnapshot;
  commercialNotes?: string;
  quote?: Quote | null;
  /** Borrador propuesto por el servidor cuando aún no hay cotización guardada. */
  quoteDraft?: Quote | null;
  /** Totales de la cotización guardada. */
  quoteTotal?: (QuoteTotals & { currency: Currency }) | null;
  quoteState?: QuoteState | null;
  /** Vencimiento de una cotización emitida sin respuesta. */
  quoteExpiry?: { estado: 'vigente' | 'por-vencer' | 'vencida'; vence: string; dias: number } | null;
  /** Historial de cambios (trazabilidad). */
  history?: { at: string; by: string; action: string; detail: string }[];
}
// Cotización emitida tal como la ve el cliente en su enlace.
export interface PublicQuote {
  number: string;
  state: QuoteState;
  issuedAt: string;
  expiresAt: string;
  validityDays: number;
  currency: Currency;
  model: string;
  color: string;
  delivery: string;
  paymentTerms: string;
  items: Pick<QuoteItem, 'section' | 'description' | 'vehicles' | 'quantity' | 'unitPrice' | 'discount'>[];
  totals: QuoteTotals;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
}
// Lo único que ve el cliente por el enlace público: sin datos personales ni notas internas.
export interface PublicLeadView {
  code: string;
  createdAt: string;
  configuration: ConfigurationSnapshot;
  quote: PublicQuote | null;
}

// Área Comercial: usuarios, avisos, clientes e indicadores
export type Role = 'admin' | 'comercial';
export interface CommercialUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}
export interface Notice {
  key: string;
  tipo: 'nueva' | 'aprobada' | 'rechazada' | 'por-vencer' | 'vencida';
  nivel: 'info' | 'ok' | 'warn' | 'error';
  titulo: string;
  detalle: string;
  fecha: string;
  solicitudId: string;
  descartado: boolean;
}
export interface Customer {
  key: string;
  tipo: 'corporate' | 'personal';
  nombre: string;
  documento: string;
  contacto: string;
  correo: string;
  telefono: string;
  ciudad: string;
  solicitudes: number;
  cotizaciones: number;
  aprobadas: number;
  rechazadas: number;
  pendientes: number;
  ultima: string;
}
export interface CustomerDetail extends Customer {
  requests: {
    id: string;
    code: string;
    status: LeadStatus;
    createdAt: string;
    vehicle: string;
    accessories: number;
    quote: {
      number: string;
      state: 'APROBADA' | 'RECHAZADA' | 'PENDIENTE';
      issuedAt: string | null;
      approvedAt: string | null;
    } | null;
  }[];
}
export interface IndicatorDef {
  id: 'pca' | 'pcr' | 'pcp' | 'tpa';
  nombre: string;
  sigla: string;
  dimension: string;
  formula: string;
  definiciones: string;
  unidad: string;
  meta: number;
  mejora: 'subir' | 'bajar';
}
export interface IndicatorResult {
  tc: number;
  nca: number;
  ncr: number;
  ncp: number;
  pca: number | null;
  pcr: number | null;
  pcp: number | null;
  tpa: number | null;
  nTpa: number;
  sinFechaValida: number;
}
export interface IndicatorsResponse {
  periodo: { desde: string; hasta: string };
  indicadores: IndicatorDef[];
  pre: IndicatorResult & { desde: string | null; hasta: string | null };
  post: IndicatorResult;
  evolucion: (IndicatorResult & { mes: string })[];
  generadoEn: string;
}
export interface HistoryRow {
  id: string;
  numero: string;
  cliente: string;
  estado: 'APROBADA' | 'RECHAZADA' | 'PENDIENTE';
  fechaEmision: string;
  fechaAprobacion: string | null;
  observacion: string;
  importadoPor?: string;
  importadoEn?: string;
}
