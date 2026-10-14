import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { SessionService } from '../../core/session.service';
import { COMMERCIAL_PATH } from '../../app.variant';
import { Notice } from '../../models/domain';

// Cabecera común del Área Comercial: módulos, avisos y usuario.
@Component({
  selector: 'app-commercial-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './commercial-nav.component.html',
  styleUrl: './commercial-nav.component.css'
})
export class CommercialNavComponent implements OnInit, OnDestroy {
  readonly base = COMMERCIAL_PATH;
  notices = signal<Notice[]>([]);
  open = signal(false);
  readonly pending = computed(() => this.notices().filter(n => !n.descartado));
  readonly pendingKeys = computed(() => this.pending().map(n => n.key));
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private api: ApiService,
    public session: SessionService,
    private router: Router
  ) {}

  ngOnInit() {
    this.load();
    // Los avisos de vencimiento cambian con el tiempo: se actualizan cada 2 minutos.
    this.timer = setInterval(() => this.load(), 120000);
  }
  ngOnDestroy() {
    clearInterval(this.timer);
  }

  link(path: string) {
    return path ? `${this.base}/${path}` : this.base || '/';
  }
  load() {
    this.api.notices(this.session.token()).subscribe({ next: n => this.notices.set(n), error: () => {} });
  }
  toggle(event: Event) {
    event.stopPropagation();
    this.open.update(v => !v);
  }
  @HostListener('document:click')
  close() {
    this.open.set(false);
  }
  dismiss(keys: string[], event?: Event) {
    event?.stopPropagation();
    if (!keys.length) return;
    this.api.dismissNotices(this.session.token(), keys).subscribe({ next: n => this.notices.set(n) });
  }
  go(n: Notice) {
    this.open.set(false);
    this.router.navigateByUrl(
      this.link(`solicitud/${n.solicitudId}`) + (n.tipo === 'nueva' ? '' : '?tab=quote')
    );
  }
  logout() {
    this.session.clear();
    this.router.navigateByUrl(this.link('login'));
  }
}
