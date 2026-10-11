import { Injectable, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class SessionService {
  token = signal(localStorage.getItem('kasac_commercial_token') || '');
  setToken(value: string) {
    localStorage.setItem('kasac_commercial_token', value);
    this.token.set(value);
  }
  clear() {
    localStorage.removeItem('kasac_commercial_token');
    this.token.set('');
  }
  isLogged() {
    return !!this.token();
  }
}
