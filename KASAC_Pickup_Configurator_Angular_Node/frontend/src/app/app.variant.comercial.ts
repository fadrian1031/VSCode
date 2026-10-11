import { Routes } from '@angular/router';
import { commercialAuth, commercialGuest } from './core/commercial-auth.guard';

// Área Comercial como aplicación propia (pestaña interna, con login), servida en /comercial/.
// El cliente nunca la ve: no se enlaza desde la web pública y todas sus llamadas requieren sesión.
export const COMMERCIAL_ENABLED = true;
export const EMBEDDED = false;
export const COMMERCIAL_APP = true;
export const COMMERCIAL_PATH = '';
export const COMMERCIAL_ROUTES: Routes = [
  {
    path: '',
    canActivate: [commercialAuth('/login')],
    loadComponent: () =>
      import('./pages/commercial-dashboard/commercial-dashboard.component').then(
        m => m.CommercialDashboardComponent
      )
  },
  {
    path: 'login',
    canActivate: [commercialGuest('/')],
    loadComponent: () =>
      import('./pages/commercial-login/commercial-login.component').then(m => m.CommercialLoginComponent)
  },
  {
    path: 'solicitud/:id',
    canActivate: [commercialAuth('/login')],
    loadComponent: () =>
      import('./pages/commercial-detail/commercial-detail.component').then(m => m.CommercialDetailComponent)
  }
];
