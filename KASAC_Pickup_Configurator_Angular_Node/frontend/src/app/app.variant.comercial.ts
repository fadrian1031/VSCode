import { Routes } from '@angular/router';
import { commercialRoutes } from './core/commercial-routes';

// Área Comercial como aplicación propia (pestaña interna, con login), servida en /comercial/.
// El cliente nunca la ve: no se enlaza desde la web pública y todas sus llamadas requieren sesión.
export const COMMERCIAL_ENABLED = true;
export const EMBEDDED = false;
export const COMMERCIAL_APP = true;
export const COMMERCIAL_PATH = '';
export const COMMERCIAL_ROUTES: Routes = commercialRoutes('');
