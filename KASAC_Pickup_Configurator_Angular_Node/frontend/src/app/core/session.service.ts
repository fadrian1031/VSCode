import { Injectable, computed, signal } from '@angular/core';
import { CommercialUser } from '../models/domain';

// Sesión del Área Comercial: token firmado por el servidor y datos del usuario (nombre y rol).
const TOKEN = 'kasac_commercial_token',
  USER = 'kasac_commercial_user';

function readUser(): CommercialUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER) || 'null');
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  token = signal(localStorage.getItem(TOKEN) || '');
  user = signal<CommercialUser | null>(readUser());
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  setToken(value: string, user?: CommercialUser) {
    localStorage.setItem(TOKEN, value);
    this.token.set(value);
    if (user) this.setUser(user);
  }
  setUser(user: CommercialUser) {
    localStorage.setItem(USER, JSON.stringify(user));
    this.user.set(user);
  }
  clear() {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(USER);
    this.token.set('');
    this.user.set(null);
  }
  isLogged() {
    return !!this.token();
  }
}
