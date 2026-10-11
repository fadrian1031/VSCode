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
export type LeadStatus = 'NEW' | 'CONTACTED' | 'NEGOTIATING' | 'QUOTED' | 'APPROVED' | 'LOST';
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
  approvedAt: string | null;
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
  /** Solo en la bandeja: totales de la cotización guardada. */
  quoteTotal?: (QuoteTotals & { currency: Currency }) | null;
}
// Lo único que ve el cliente por el enlace público: sin datos personales, estado ni notas internas.
export interface PublicLeadView {
  code: string;
  createdAt: string;
  configuration: ConfigurationSnapshot;
}
