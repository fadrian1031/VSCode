import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { SessionService } from '../../core/session.service';
import { COMMERCIAL_PATH } from '../../app.variant';

@Component({
  selector: 'app-commercial-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './commercial-login.component.html',
  styleUrl: './commercial-login.component.css'
})
export class CommercialLoginComponent {
  email = '';
  password = '';
  busy = signal(false);
  error = signal('');
  constructor(
    private api: ApiService,
    private session: SessionService,
    private router: Router
  ) {}
  login() {
    this.busy.set(true);
    this.error.set('');
    this.api.login(this.email, this.password).subscribe({
      next: r => {
        this.session.setToken(r.token);
        this.router.navigateByUrl(COMMERCIAL_PATH || '/');
      },
      error: e => {
        this.busy.set(false);
        this.error.set(e?.error?.message || 'No se pudo iniciar sesión.');
      }
    });
  }
}
