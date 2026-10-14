import { Routes } from '@angular/router';
import { commercialRoutes } from './core/commercial-routes';

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
export const COMMERCIAL_ROUTES: Routes = commercialRoutes('comercial');
