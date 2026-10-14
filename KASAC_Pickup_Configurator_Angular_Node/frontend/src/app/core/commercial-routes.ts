import { Routes } from '@angular/router';
import { adminOnly, commercialAuth, commercialGuest } from './commercial-auth.guard';

/**
 * Rutas del Área Comercial. prefix = '' cuando es la app propia (/comercial/ en el servidor)
 * o 'comercial' cuando va dentro de la app de desarrollo.
 */
export function commercialRoutes(prefix: string): Routes {
  const p = (path: string) => [prefix, path].filter(Boolean).join('/');
  const home = '/' + prefix;
  const login = '/' + p('login');
  const guarded = { canActivate: [commercialAuth(login)] };
  return [
    {
      path: p('login'),
      canActivate: [commercialGuest(home)],
      loadComponent: () =>
        import('../pages/commercial-login/commercial-login.component').then(m => m.CommercialLoginComponent)
    },
    {
      path: prefix,
      ...guarded,
      loadComponent: () =>
        import('../pages/commercial-dashboard/commercial-dashboard.component').then(
          m => m.CommercialDashboardComponent
        )
    },
    {
      path: p('solicitud/:id'),
      ...guarded,
      loadComponent: () =>
        import('../pages/commercial-detail/commercial-detail.component').then(
          m => m.CommercialDetailComponent
        )
    },
    {
      path: p('clientes'),
      ...guarded,
      loadComponent: () =>
        import('../pages/commercial-customers/commercial-customers.component').then(
          m => m.CommercialCustomersComponent
        )
    },
    {
      path: p('indicadores'),
      ...guarded,
      loadComponent: () =>
        import('../pages/commercial-indicators/commercial-indicators.component').then(
          m => m.CommercialIndicatorsComponent
        )
    },
    {
      path: p('historico'),
      ...guarded,
      loadComponent: () =>
        import('../pages/commercial-history/commercial-history.component').then(
          m => m.CommercialHistoryComponent
        )
    },
    {
      path: p('usuarios'),
      canActivate: [commercialAuth(login), adminOnly(home)],
      loadComponent: () =>
        import('../pages/commercial-users/commercial-users.component').then(m => m.CommercialUsersComponent)
    }
  ];
}
