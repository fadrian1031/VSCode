import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { SessionService } from '../../core/session.service';
import { CommercialNavComponent } from '../../components/commercial-nav/commercial-nav.component';
import { HistoryRow, IndicatorResult } from '../../models/domain';

// Módulo de registro histórico: carga las cotizaciones anteriores al sistema (pre-prueba) desde Excel.
@Component({
  selector: 'app-commercial-history',
  standalone: true,
  imports: [CommonModule, CommercialNavComponent],
  templateUrl: './commercial-history.component.html',
  styleUrl: './commercial-history.component.css'
})
export class CommercialHistoryComponent implements OnInit {
  rows = signal<HistoryRow[]>([]);
  summary = signal<IndicatorResult | null>(null);
  busy = signal(false);
  result = signal<{
    added: number;
    updated: number;
    total: number;
    errors: { fila: number; motivo: string }[];
  } | null>(null);
  error = signal('');
  filter = signal<'TODAS' | HistoryRow['estado']>('TODAS');
  readonly shown = computed(() =>
    this.rows().filter(r => this.filter() === 'TODAS' || r.estado === this.filter())
  );
  readonly label = { APROBADA: 'Aprobada', RECHAZADA: 'Rechazada', PENDIENTE: 'Pendiente' } as const;
  readonly filters: { id: 'TODAS' | HistoryRow['estado']; name: string }[] = [
    { id: 'TODAS', name: 'Todas' },
    { id: 'APROBADA', name: 'Aprobadas' },
    { id: 'RECHAZADA', name: 'Rechazadas' },
    { id: 'PENDIENTE', name: 'Pendientes' }
  ];

  constructor(
    private api: ApiService,
    public session: SessionService
  ) {}

  ngOnInit() {
    this.load();
  }
  load() {
    this.api.history(this.session.token()).subscribe({
      next: r => {
        this.rows.set(r.rows);
        this.summary.set(r.resumen);
      }
    });
  }
  days(r: HistoryRow) {
    if (r.estado !== 'APROBADA' || !r.fechaAprobacion) return null;
    return Math.round(((Date.parse(r.fechaAprobacion) - Date.parse(r.fechaEmision)) / 864e5) * 100) / 100;
  }

  upload(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    this.busy.set(true);
    this.error.set('');
    this.result.set(null);
    this.api.importHistory(this.session.token(), file).subscribe({
      next: r => {
        this.result.set(r);
        this.busy.set(false);
        input.value = '';
        this.load();
      },
      error: e => {
        this.error.set(e?.error?.message || 'No se pudo importar el archivo.');
        this.result.set(
          e?.error?.errors
            ? { added: 0, updated: 0, total: this.rows().length, errors: e.error.errors }
            : null
        );
        this.busy.set(false);
        input.value = '';
      }
    });
  }
  template() {
    this.api.historyTemplate(this.session.token()).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'plantilla-historico-cotizaciones.xlsx';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  }
  clearAll() {
    if (!confirm('¿Borrar todo el registro histórico? Los indicadores de la pre-prueba quedarán vacíos.'))
      return;
    this.api.clearHistory(this.session.token()).subscribe({ next: () => this.load() });
  }
}
