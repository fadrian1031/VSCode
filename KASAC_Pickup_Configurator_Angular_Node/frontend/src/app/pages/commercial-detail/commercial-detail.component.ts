import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { SessionService } from '../../core/session.service';
import {
  ConfigurationSnapshot,
  LeadRequest,
  LeadStatus,
  Quote,
  QuoteItem,
  QuotePhoto,
  QuoteSection
} from '../../models/domain';
import { ThreeViewerComponent } from '../../components/three-viewer/three-viewer.component';
import { COMMERCIAL_PATH } from '../../app.variant';
import { FEATURES } from '../../features';
import {
  CURRENCY_SYMBOL,
  QUOTE_STATE_LABEL,
  SECTIONS,
  STATUS_LABEL,
  lineTotal,
  money
} from '../../core/commercial';

@Component({
  selector: 'app-commercial-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ThreeViewerComponent],
  templateUrl: './commercial-detail.component.html',
  styleUrl: './commercial-detail.component.css'
})
export class CommercialDetailComponent implements OnInit {
  @ViewChild(ThreeViewerComponent) viewer?: ThreeViewerComponent;
  @ViewChild('quotePanel') quotePanel?: ElementRef<HTMLElement>;
  readonly base = COMMERCIAL_PATH;
  readonly features = FEATURES;
  readonly sections = SECTIONS;
  readonly label = STATUS_LABEL;
  readonly quoteLabel = QUOTE_STATE_LABEL;
  readonly symbol = CURRENCY_SYMBOL;
  readonly money = money;
  readonly lineTotal = lineTotal;
  // Estados que se eligen a mano; Cotizada, Aprobada y Rechazada salen de la cotización.
  readonly manualStatuses: LeadStatus[] = ['NEW', 'CONTACTED', 'NEGOTIATING', 'LOST'];

  // Observaciones frecuentes que Comercial agrega con un clic (una por línea).
  readonly observationPresets = [
    'Incluye instalación en nuestro taller.',
    'No incluye instalación.',
    'Medidas y ubicación de accesorios sujetas a validación técnica en taller.',
    'Precio por unidad; se aplica a cada vehículo indicado.',
    'Adelanto del 50 % con la orden de compra y saldo a la entrega.',
    'Las imágenes del anexo son referenciales.'
  ];

  lead = signal<LeadRequest | null>(null);
  // Configuración del visor: se fija una sola vez para no recargar el modelo 3D al guardar.
  config = signal<ConfigurationSnapshot | null>(null);
  tab = signal<'request' | 'quote'>('request');
  viewMode = signal<'exterior' | 'interior'>('exterior');
  quote = signal<Quote | null>(null);
  photos = signal<QuotePhoto[]>([]);
  busy = signal(''); // acción en curso: '', 'save', 'photos', 'pdf', 'xlsx', 'emit', 'response'
  message = signal<{ type: 'ok' | 'error'; text: string } | null>(null);
  dirty = signal(false);
  rev = signal(0); // fuerza recalcular totales al editar líneas
  notes = '';
  status: LeadStatus = 'NEW';
  // Formulario para registrar la respuesta que el cliente dio por correo o teléfono.
  showResponse = signal(false);
  readonly today = new Date().toISOString().slice(0, 10);
  response = { decision: 'aprobar' as 'aprobar' | 'rechazar', date: '', channel: 'correo', reason: '' };

  readonly quoteState = computed(() => this.lead()?.quoteState || null);
  /** Aprobada o rechazada: el cliente ya respondió y la cotización queda de solo lectura. */
  readonly locked = computed(() => this.quoteState() === 'APROBADA' || this.quoteState() === 'RECHAZADA');
  readonly systemStatus = computed(() =>
    ['QUOTED', 'APPROVED', 'REJECTED'].includes(this.lead()?.status || '')
  );
  readonly totals = computed(() => {
    this.rev();
    const q = this.quote();
    if (!q)
      return {
        sections: [] as { id: QuoteSection; name: string; subtotal: number }[],
        subtotal: 0,
        igv: 0,
        total: 0
      };
    const sections = SECTIONS.map(s => ({
      ...s,
      subtotal: this.round(q.items.filter(i => i.section === s.id).reduce((a, i) => a + lineTotal(i), 0))
    }));
    const subtotal = this.round(sections.reduce((a, s) => a + s.subtotal, 0));
    const igv = this.round(subtotal * q.igvRate);
    return { sections, subtotal, igv, total: this.round(subtotal + igv) };
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public session: SessionService
  ) {}

  ngOnInit() {
    if (!this.session.isLogged()) {
      this.router.navigateByUrl(`${this.base}/login`);
      return;
    }
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.api.getLead(id, this.session.token()).subscribe({
      next: l => {
        this.setLead(l);
        this.loadPhotos();
        if (
          this.route.snapshot.queryParamMap.get('tab') === 'quote' ||
          l.quoteState === 'APROBADA' ||
          l.quoteState === 'RECHAZADA'
        )
          this.selectTab('quote');
      },
      error: e => {
        if (e?.status === 401) {
          this.session.clear();
          this.router.navigateByUrl(`${this.base}/login`);
        } else this.router.navigateByUrl(this.base || '/');
      }
    });
  }

  private setLead(l: LeadRequest) {
    this.lead.set(l);
    if (!this.config()) this.config.set(l.configuration);
    this.notes = l.commercialNotes || '';
    this.status = l.status;
    this.quote.set(structuredClone(l.quote || l.quoteDraft || null));
    this.dirty.set(false);
    this.rev.update(v => v + 1);
  }
  private round(n: number) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }
  private flash(type: 'ok' | 'error', text: string) {
    this.message.set({ type, text });
    setTimeout(() => {
      if (this.message()?.text === text) this.message.set(null);
    }, 5000);
  }
  private fail(e: any, fallback: string) {
    this.busy.set('');
    this.flash('error', e?.error?.message || e?.message || fallback);
  }

  /** Cambia de pestaña y vuelve a encuadrar el modelo, porque el visor cambia de ancho. */
  selectTab(t: 'request' | 'quote') {
    this.tab.set(t);
    if (t === 'quote') this.viewMode.set('exterior');
    setTimeout(() => this.viewer?.resetCamera(), 80);
  }

  hasObservation(q: Quote, o: string) {
    return (q.observations || '').split('\n').some(l => l.trim() === o);
  }
  addObservation(q: Quote, o: string) {
    if (this.hasObservation(q, o)) return;
    q.observations = [(q.observations || '').trimEnd(), o].filter(Boolean).join('\n');
    this.changed();
  }

  customerName(l: LeadRequest) {
    return l.customer.type === 'corporate' ? l.customer.companyName : l.customer.fullName;
  }
  itemsOf(section: QuoteSection) {
    this.rev();
    return this.quote()?.items.filter(i => i.section === section) || [];
  }
  changed() {
    this.dirty.set(true);
    this.rev.update(v => v + 1);
  }

  // Solicitud
  saveRequest() {
    const l = this.lead();
    if (!l) return;
    this.busy.set('request');
    const status = this.manualStatuses.includes(this.status) ? this.status : undefined;
    this.api
      .updateLead(l.id, this.session.token(), { ...(status ? { status } : {}), commercialNotes: this.notes })
      .subscribe({
        next: r => {
          this.lead.update(x =>
            x ? { ...x, status: r.status, commercialNotes: r.commercialNotes, history: r.history } : x
          );
          this.status = r.status;
          this.busy.set('');
          this.flash('ok', 'Cambios guardados.');
        },
        error: e => this.fail(e, 'No se pudo guardar.')
      });
  }

  // Cotización
  addItem(section: QuoteSection) {
    const q = this.quote();
    if (!q) return;
    q.items.push({
      id: crypto.randomUUID(),
      section,
      code: '',
      description: '',
      vehicles: 1,
      quantity: 1,
      unitPrice: 0,
      discount: 0
    });
    this.changed();
  }
  removeItem(item: QuoteItem) {
    const q = this.quote();
    if (!q) return;
    q.items = q.items.filter(i => i !== item);
    this.changed();
  }

  /** Guarda la cotización; la primera vez también toma las fotos del modelo 3D. */
  async saveQuote(silent = false): Promise<boolean> {
    const l = this.lead(),
      q = this.quote();
    if (!l || !q) return false;
    const empty = q.items.filter(i => !i.description.trim());
    if (empty.length) {
      this.flash('error', 'Hay líneas sin descripción: complételas o elimínelas.');
      return false;
    }
    if (!this.photos().length) await this.takePhotos(true);
    this.busy.set('save');
    return new Promise(resolve =>
      this.api.saveQuote(l.id, this.session.token(), q).subscribe({
        next: r => {
          this.setLead(r);
          this.busy.set('');
          if (!silent) this.flash('ok', `Cotización ${r.quote?.number} guardada.`);
          resolve(true);
        },
        error: e => {
          this.fail(e, 'No se pudo guardar la cotización.');
          resolve(false);
        }
      })
    );
  }

  async takePhotos(quiet = false) {
    const l = this.lead();
    if (!l || !this.viewer) return;
    this.busy.set('photos');
    try {
      this.viewMode.set('exterior');
      const views = await this.viewer.captureViews();
      await new Promise<void>((resolve, reject) =>
        this.api
          .savePhotos(l.id, this.session.token(), views)
          .subscribe({ next: () => resolve(), error: reject })
      );
      this.loadPhotos();
      this.busy.set('');
      if (!quiet) this.flash('ok', 'Fotos del modelo actualizadas.');
    } catch (e) {
      this.fail(e, 'No se pudieron tomar las fotos del modelo.');
    }
  }

  private loadPhotos() {
    const l = this.lead();
    if (!l) return;
    this.api
      .getPhotos(l.id, this.session.token())
      .subscribe({ next: p => this.photos.set(p), error: () => this.photos.set([]) });
  }

  async download(kind: 'pdf' | 'xlsx') {
    const l = this.lead();
    if (!l) return;
    if (!this.locked() && (this.dirty() || !l.quote)) {
      if (!(await this.saveQuote(true))) return;
    }
    this.busy.set(kind);
    this.api.quoteFile(l.id, this.session.token(), kind).subscribe({
      next: blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.lead()?.quote?.number || 'cotizacion'}.${kind}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        this.busy.set('');
      },
      error: e => this.fail(e, 'No se pudo generar el archivo.')
    });
  }

  /** Enlace que recibe el cliente: ve su configuración en 3D y, ya emitida, la cotización para aprobarla. */
  clientLink(l: LeadRequest) {
    return `${location.origin}/configurador#/solicitud/${l.publicToken}`;
  }
  copyLink(l: LeadRequest) {
    navigator.clipboard?.writeText(this.clientLink(l)).then(
      () => this.flash('ok', 'Enlace copiado. Envíelo al cliente por correo o WhatsApp.'),
      () => this.flash('error', 'No se pudo copiar; seleccione el enlace y cópielo a mano.')
    );
  }
  mailLink(l: LeadRequest) {
    const q = l.quote;
    const subject = `Cotización ${q?.number} · KASAC`;
    const body = `Estimado(a) ${l.customer.fullName}:\n\nLe enviamos la cotización ${q?.number} de su configuración. Puede verla en 3D, descargar el PDF y aprobarla desde este enlace:\n${this.clientLink(l)}\n\nQuedamos atentos.\nÁrea Comercial KASAC`;
    return `mailto:${l.customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  /** Emitir: guarda si hay cambios y envía la cotización al cliente; el servidor registra la fecha de emisión (FE). */
  async emit() {
    const l = this.lead();
    if (!l) return;
    if (this.dirty() || !l.quote) {
      if (!(await this.saveQuote(true))) return;
    }
    const first = this.quoteState() !== 'EMITIDA';
    const msg = first
      ? `¿Emitir la cotización ${this.lead()?.quote?.number}? Desde ahora el cliente podrá verla en su enlace y aprobarla o rechazarla.`
      : `¿Reenviar la cotización ${this.lead()?.quote?.number} con los cambios? La fecha de emisión original se mantiene.`;
    if (!confirm(msg)) return;
    this.busy.set('emit');
    this.api.emitQuote(l.id, this.session.token()).subscribe({
      next: r => {
        this.setLead(r);
        this.busy.set('');
        this.flash(
          'ok',
          first ? 'Cotización emitida. Copie el enlace y envíelo al cliente.' : 'Cotización reenviada.'
        );
        this.quotePanel?.nativeElement.scrollTo({ top: 0 });
      },
      error: e => this.fail(e, 'No se pudo emitir la cotización.')
    });
  }

  openResponse() {
    this.response = {
      decision: 'aprobar',
      date: new Date().toISOString().slice(0, 10),
      channel: 'correo',
      reason: ''
    };
    this.showResponse.set(true);
  }
  /** Comercial registra la respuesta del cliente con la fecha en que llegó (por ejemplo, la del correo). */
  submitResponse() {
    const l = this.lead();
    if (!l) return;
    if (this.response.decision === 'rechazar' && !this.response.reason.trim()) {
      this.flash('error', 'Indique el motivo del rechazo.');
      return;
    }
    this.busy.set('response');
    this.api.registerResponse(l.id, this.session.token(), this.response).subscribe({
      next: r => {
        this.setLead(r);
        this.showResponse.set(false);
        this.busy.set('');
        this.flash('ok', r.quoteState === 'APROBADA' ? 'Aprobación registrada.' : 'Rechazo registrado.');
      },
      error: e => this.fail(e, 'No se pudo registrar la respuesta.')
    });
  }
  /** Solo administrador: anula una respuesta registrada por error; queda en el historial. */
  undoResponse() {
    const l = this.lead();
    if (!l) return;
    const reason = prompt('¿Por qué se corrige la respuesta? (queda registrado en el historial)');
    if (!reason?.trim()) return;
    this.busy.set('response');
    this.api.undoResponse(l.id, this.session.token(), reason.trim()).subscribe({
      next: r => {
        this.setLead(r);
        this.busy.set('');
        this.flash('ok', 'Respuesta anulada: la cotización vuelve a pendiente por aprobar.');
      },
      error: e => this.fail(e, 'No se pudo corregir la respuesta.')
    });
  }
}
