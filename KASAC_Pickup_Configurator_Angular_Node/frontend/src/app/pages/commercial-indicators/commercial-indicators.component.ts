import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { SessionService } from '../../core/session.service';
import { CommercialNavComponent } from '../../components/commercial-nav/commercial-nav.component';
import { IndicatorDef, IndicatorResult, IndicatorsResponse } from '../../models/domain';

interface Card {
  def: IndicatorDef;
  pre: number | null;
  post: number | null;
  /** true si la post-prueba mejora frente a la pre-prueba (según el sentido del indicador). */
  improved: boolean | null;
  reachesGoal: boolean | null;
  counts: string;
}

// Módulo de indicadores: compara la pre-prueba (histórico) con la post-prueba (sistema) y la meta de la tesis.
@Component({
  selector: 'app-commercial-indicators',
  standalone: true,
  imports: [CommonModule, FormsModule, CommercialNavComponent],
  templateUrl: './commercial-indicators.component.html',
  styleUrl: './commercial-indicators.component.css'
})
export class CommercialIndicatorsComponent implements OnInit {
  data = signal<IndicatorsResponse | null>(null);
  error = signal('');
  busy = signal('');
  desde = '';
  hasta = '';

  readonly cards = computed<Card[]>(() => {
    const d = this.data();
    if (!d) return [];
    return d.indicadores.map(def => {
      const pre = d.pre[def.id],
        post = d.post[def.id];
      const better = (a: number, b: number) => (def.mejora === 'subir' ? a > b : a < b);
      return {
        def,
        pre,
        post,
        improved: pre === null || post === null ? null : post === pre ? false : better(post, pre),
        reachesGoal: post === null ? null : def.mejora === 'subir' ? post >= def.meta : post <= def.meta,
        counts: this.countsText(def.id, d.post)
      };
    });
  });
  /** Escala común del gráfico de porcentajes (0 a 100). */
  readonly percentCards = computed(() => this.cards().filter(c => c.def.unidad === '%'));
  readonly tpaCard = computed(() => this.cards().find(c => c.def.id === 'tpa') || null);
  readonly tpaMax = computed(() => {
    const c = this.tpaCard();
    return Math.max(10, c?.pre || 0, c?.post || 0, c?.def.meta || 0) * 1.15;
  });

  constructor(
    private api: ApiService,
    private session: SessionService
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.error.set('');
    this.api.indicators(this.session.token(), this.desde, this.hasta).subscribe({
      next: d => this.data.set(d),
      error: () => this.error.set('No se pudieron calcular los indicadores.')
    });
  }
  clear() {
    this.desde = '';
    this.hasta = '';
    this.load();
  }

  countsText(id: string, r: IndicatorResult) {
    if (id === 'pca') return `${r.nca} de ${r.tc} cotizaciones`;
    if (id === 'pcr') return `${r.ncr} de ${r.tc} cotizaciones`;
    if (id === 'pcp') return `${r.ncp} de ${r.tc} cotizaciones`;
    return `${r.nTpa} aprobadas con fecha válida`;
  }
  fmt(v: number | null, unidad: string) {
    if (v === null) return '—';
    return unidad === '%' ? `${v.toFixed(2)} %` : `${v.toFixed(2)} días`;
  }
  /** Diferencia post − pre, con signo. */
  delta(c: Card) {
    if (c.pre === null || c.post === null) return '';
    const d = c.post - c.pre;
    const unit = c.def.unidad === '%' ? ' pp' : ' días';
    return `${d > 0 ? '+' : ''}${d.toFixed(2)}${unit}`;
  }
  monthName(m: string) {
    const [y, mm] = m.split('-').map(Number);
    return new Date(y, mm - 1, 1).toLocaleDateString('es-PE', { month: 'short', year: 'numeric' });
  }

  download(fuente: 'pre' | 'post') {
    this.busy.set(fuente);
    this.api.observationSheets(this.session.token(), fuente, this.desde, this.hasta).subscribe({
      next: blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `fichas-observacion-${fuente === 'pre' ? 'pretest' : 'postest'}.xlsx`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        this.busy.set('');
      },
      error: () => {
        this.busy.set('');
        this.error.set('No se pudo generar el archivo.');
      }
    });
  }
}
