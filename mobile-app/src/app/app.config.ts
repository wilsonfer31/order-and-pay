import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter }    from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes }           from './app.routes';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { apiPrefixInterceptor } from './interceptors/api-prefix.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiPrefixInterceptor])),
    provideIonicAngular({ mode: 'md' }),
  ]
};
