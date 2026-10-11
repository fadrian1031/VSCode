import { Routes } from '@angular/router';
import { commercialAuth, commercialGuest } from './core/commercial-auth.guard';

// Variante de la aplicación, elegida en tiempo de build (angular.json → fileReplacements):
//   app.variant.ts            interna para desarrollo (ng serve): configurador + Área Comercial en /comercial
//   app.variant.public.ts     pública: sin Área Comercial          (ng build --configuration public)
//   app.variant.web.ts        web KASAC: pública + embebida en iframe (ng build --configuration web)
//   app.variant.comercial.ts  Área Comercial sola, servida en /comercial (ng build --configuration comercial)
export const COMMERCIAL_ENABLED = true;
// Embebida en la web KASAC: sin landing ni logo propios, rutas por hash, enlaces externos en la ventana principal.
export const EMBEDDED = false;
// App dedicada al Área Comercial: sus rutas viven en la raíz de la app (/comercial/ en el servidor).
export const COMMERCIAL_APP = false;
// Prefijo de las rutas comerciales dentro de esta app.
export const COMMERCIAL_PATH = '/comercial';
export const COMMERCIAL_ROUTES: Routes = [
  {
    path: 'comercial/login',
    canActivate: [commercialGuest('/comercial')],
    loadComponent: () =>
      import('./pages/commercial-login/commercial-login.component').then(m => m.CommercialLoginComponent)
  },
  {
    path: 'comercial',
    canActivate: [commercialAuth('/comercial/login')],
    loadComponent: () =>
      import('./pages/commercial-dashboard/commercial-dashboard.component').then(
        m => m.CommercialDashboardComponent
      )
  },
  {
    path: 'comercial/solicitud/:id',
    canActivate: [commercialAuth('/comercial/login')],
    loadComponent: () =>
      import('./pages/commercial-detail/commercial-detail.component').then(m => m.CommercialDetailComponent)
  }
];
