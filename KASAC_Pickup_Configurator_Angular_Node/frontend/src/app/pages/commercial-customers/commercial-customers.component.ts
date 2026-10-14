import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { SessionService } from '../../core/session.service';
import { CommercialNavComponent } from '../../components/commercial-nav/commercial-nav.component';
import { COMMERCIAL_PATH } from '../../app.variant';
import { STATUS_LABEL } from '../../core/commercial';
import { Customer, CustomerDetail } from '../../models/domain';

// Módulo de clientes: todos los que enviaron solicitudes, con su historial de cotizaciones.
@Component({
  selector: 'app-commercial-customers',
  standalone: true,
  imports: [CommonModule, RouterLink, CommercialNavComponent],
  templateUrl: './commercial-customers.component.html',
  styleUrl: './commercial-customers.component.css'
})
export class CommercialCustomersComponent implements OnInit {
  readonly base = COMMERCIAL_PATH;
  readonly label = STATUS_LABEL;
  readonly quoteLabel = { APROBADA: 'Aprobada', RECHAZADA: 'Rechazada', PENDIENTE: 'Pendiente' } as const;
  customers = signal<Customer[]>([]);
  selected = signal<CustomerDetail | null>(null);
  loaded = signal(false);
  query = signal('');
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.customers().filter(
      c => !q || [c.nombre, c.documento, c.contacto, c.correo].some(v => v?.toLowerCase().includes(q))
    );
  });

  constructor(
    private api: ApiService,
    private session: SessionService
  ) {}

  ngOnInit() {
    this.api.customers(this.session.token()).subscribe({
      next: c => {
        this.customers.set(c);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true)
    });
  }
  open(c: Customer) {
    this.api.customer(c.key, this.session.token()).subscribe({ next: d => this.selected.set(d) });
  }
  requestLink(id: string) {
    return `${this.base}/solicitud/${id}`;
  }
}
