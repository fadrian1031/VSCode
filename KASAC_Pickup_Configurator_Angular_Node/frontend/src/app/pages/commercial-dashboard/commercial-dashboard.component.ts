import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { SessionService } from '../../core/session.service';
import { LeadRequest, LeadStatus } from '../../models/domain';
import { COMMERCIAL_PATH } from '../../app.variant';
import { CURRENCY_SYMBOL, STATUS_LABEL, STATUS_ORDER, money } from '../../core/commercial';

@Component({
  selector: 'app-commercial-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './commercial-dashboard.component.html',
  styleUrl: './commercial-dashboard.component.css'
})
export class CommercialDashboardComponent implements OnInit {
  readonly base = COMMERCIAL_PATH;
  readonly statuses = STATUS_ORDER;
  readonly label = STATUS_LABEL;
  readonly symbol = CURRENCY_SYMBOL;
  readonly money = money;
  leads = signal<LeadRequest[]>([]);
  loaded = signal(false);
  filter = signal<'ALL' | LeadStatus>('ALL');
  query = signal('');
  readonly filtered = computed(() => {
    const f = this.filter(),
      q = this.query().trim().toLowerCase();
    return this.leads().filter(
      l =>
        (f === 'ALL' || l.status === f) &&
        (!q ||
          [
            l.code,
            l.quote?.number,
            l.customer.companyName,
            l.customer.fullName,
            l.customer.ruc,
            l.configuration.vehicle.model
          ].some(v => v?.toLowerCase().includes(q)))
    );
  });
  readonly counts = computed(() => {
    const c: Record<string, number> = { ALL: this.leads().length };
    for (const l of this.leads()) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  });
  system = signal<{
    storage: string;
    persistent: boolean;
    retentionDays: number;
    email: { enabled: boolean; provider: string; to: string[] };
  } | null>(null);
  constructor(
    private api: ApiService,
    public session: SessionService,
    private router: Router
  ) {}
  ngOnInit() {
    if (!this.session.isLogged()) {
      this.router.navigateByUrl(`${this.base}/login`);
      return;
    }
    this.api.system(this.session.token()).subscribe({ next: s => this.system.set(s), error: () => {} });
    this.api.listLeads(this.session.token()).subscribe({
      next: r => {
        this.leads.set(r);
        this.loaded.set(true);
      },
      error: () => {
        this.session.clear();
        this.router.navigateByUrl(`${this.base}/login`);
      }
    });
  }
  logout() {
    this.session.clear();
    this.router.navigateByUrl(`${this.base}/login`);
  }
  link(l: LeadRequest) {
    return `${this.base}/solicitud/${l.id}`;
  }
  customer(l: LeadRequest) {
    return l.customer.type === 'corporate' ? l.customer.companyName : l.customer.fullName;
  }
}
