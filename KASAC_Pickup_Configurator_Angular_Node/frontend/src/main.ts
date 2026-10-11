import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { EMBEDDED } from './app/app.variant';

// Embebida: rutas por hash (#/solicitud/...) para funcionar en hosting estático sin reglas de reescritura.
bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes, ...(EMBEDDED ? [withHashLocation()] : [])), provideHttpClient()]
}).catch(err => console.error(err));
