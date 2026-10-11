import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ApiService } from './api.service';
import { SessionService } from './session.service';

// Protege las rutas del Área Comercial: valida la sesión con el servidor ANTES de cargar y dibujar la pantalla,
// así sin sesión (o con una caducada) nunca llega a verse el panel; se va directo al login.
export const commercialAuth =
  (loginUrl: string): CanActivateFn =>
  () => {
    const session = inject(SessionService),
      router = inject(Router),
      api = inject(ApiService);
    const toLogin = () => {
      session.clear();
      return router.parseUrl(loginUrl);
    };
    if (!session.isLogged()) return toLogin();
    return api.system(session.token()).pipe(
      map(() => true),
      catchError(() => of(toLogin()))
    );
  };

// Con sesión válida, el login lleva directo al panel.
export const commercialGuest =
  (homeUrl: string): CanActivateFn =>
  () =>
    inject(SessionService).isLogged() ? inject(Router).parseUrl(homeUrl) : true;
