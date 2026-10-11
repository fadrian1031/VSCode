import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { ConfiguratorComponent } from './pages/configurator/configurator.component';
import { PublicRequestComponent } from './pages/public-request/public-request.component';
import { COMMERCIAL_APP, COMMERCIAL_ROUTES, EMBEDDED } from './app.variant';

export const routes: Routes = COMMERCIAL_APP
  ? [...COMMERCIAL_ROUTES, { path: '**', redirectTo: '' }]
  : [
      // Embebida en la web KASAC, la portada es la propia web: se entra directo al configurador.
      { path: '', component: EMBEDDED ? ConfiguratorComponent : LandingComponent },
      { path: 'configura-tu-pickup', component: ConfiguratorComponent },
      { path: 'solicitud/:token', component: PublicRequestComponent },
      ...COMMERCIAL_ROUTES,
      { path: '**', redirectTo: '' }
    ];
