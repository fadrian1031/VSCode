import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { SessionService } from '../../core/session.service';
import { CommercialNavComponent } from '../../components/commercial-nav/commercial-nav.component';
import { CommercialUser, Role } from '../../models/domain';

// Módulo de usuarios y roles: solo el administrador crea usuarios, cambia roles o los desactiva.
@Component({
  selector: 'app-commercial-users',
  standalone: true,
  imports: [CommonModule, FormsModule, CommercialNavComponent],
  templateUrl: './commercial-users.component.html',
  styleUrl: './commercial-users.component.css'
})
export class CommercialUsersComponent implements OnInit {
  users = signal<CommercialUser[]>([]);
  message = signal<{ type: 'ok' | 'error'; text: string } | null>(null);
  form = { name: '', email: '', password: '', role: 'comercial' as Role };

  constructor(
    private api: ApiService,
    public session: SessionService
  ) {}

  ngOnInit() {
    this.load();
  }
  load() {
    this.api.users(this.session.token()).subscribe({ next: u => this.users.set(u) });
  }
  private done(text: string) {
    this.message.set({ type: 'ok', text });
    this.load();
  }
  private failed(e: any) {
    this.message.set({ type: 'error', text: e?.error?.message || 'No se pudo guardar.' });
    this.load();
  }

  create() {
    this.api.createUser(this.session.token(), this.form).subscribe({
      next: u => {
        this.form = { name: '', email: '', password: '', role: 'comercial' };
        this.done(`Usuario ${u.email} creado.`);
      },
      error: e => this.failed(e)
    });
  }
  setRole(u: CommercialUser, role: Role) {
    this.api.updateUser(this.session.token(), u.id, { role }).subscribe({
      next: () => this.done(`${u.name} ahora es ${role === 'admin' ? 'administrador' : 'comercial'}.`),
      error: e => this.failed(e)
    });
  }
  toggle(u: CommercialUser) {
    this.api.updateUser(this.session.token(), u.id, { active: !u.active }).subscribe({
      next: () => this.done(`${u.name} ${u.active ? 'desactivado' : 'activado'}.`),
      error: e => this.failed(e)
    });
  }
  resetPassword(u: CommercialUser) {
    const password = prompt(`Nueva contraseña para ${u.name} (mínimo 8 caracteres):`);
    if (!password) return;
    this.api.updateUser(this.session.token(), u.id, { password }).subscribe({
      next: () => this.done(`Contraseña de ${u.name} actualizada.`),
      error: e => this.failed(e)
    });
  }
}
