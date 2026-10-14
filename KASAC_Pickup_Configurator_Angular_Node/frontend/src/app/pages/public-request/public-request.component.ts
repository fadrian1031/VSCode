import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { PublicLeadView } from '../../models/domain';
import { ThreeViewerComponent } from '../../components/three-viewer/three-viewer.component';
import { EMBEDDED } from '../../app.variant';
import { FEATURES } from '../../features';
import { CURRENCY_SYMBOL, SECTIONS, lineTotal, money } from '../../core/commercial';
@Component({
  selector: 'app-public-request',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ThreeViewerComponent],
  templateUrl: './public-request.component.html',
  styleUrl: './public-request.component.css'
})
export class PublicRequestComponent implements OnInit {
  readonly embedded = EMBEDDED;
  readonly features = FEATURES;
  lead = signal<PublicLeadView | null>(null);
  error = signal('');
  viewMode = signal<'exterior' | 'interior'>('exterior');
  readonly symbol = CURRENCY_SYMBOL;
  readonly sections = SECTIONS;
  readonly money = money;
  readonly lineTotal = lineTotal;
  // Respuesta del cliente a su cotización
  rejecting = signal(false);
  reason = '';
  busy = signal(false);
  answerError = signal('');
  private token = '';

  constructor(
    private route: ActivatedRoute,
    private api: ApiService
  ) {}
  ngOnInit() {
    const token = (this.token = this.route.snapshot.paramMap.get('token') || '');
    this.api.getPublicLead(token).subscribe({
      next: r => this.lead.set(r),
      error: () => this.error.set('No encontramos esta configuración o el enlace ya no es válido.')
    });
  }

  pdfUrl() {
    return this.api.publicQuotePdfUrl(this.token);
  }
  itemsOf(section: string) {
    return this.lead()?.quote?.items.filter(i => i.section === section) || [];
  }
  /** El cliente aprueba o rechaza; el servidor registra la fecha (FA) y avisa al Área Comercial. */
  answer(decision: 'aprobar' | 'rechazar') {
    if (decision === 'rechazar' && !this.reason.trim()) {
      this.answerError.set('Cuéntenos brevemente el motivo, así podremos mejorar la propuesta.');
      return;
    }
    if (decision === 'aprobar' && !confirm('¿Confirma que aprueba esta cotización?')) return;
    this.busy.set(true);
    this.answerError.set('');
    this.api.answerPublicQuote(this.token, decision, this.reason.trim()).subscribe({
      next: r => {
        this.lead.set(r);
        this.busy.set(false);
        this.rejecting.set(false);
      },
      error: e => {
        this.busy.set(false);
        this.answerError.set(e?.error?.message || 'No se pudo registrar su respuesta. Inténtelo de nuevo.');
      }
    });
  }
}
