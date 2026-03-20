import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData }   from '@angular/common';
import localeFr                 from '@angular/common/locales/fr';
import { appConfig }            from './app/app.config';
import { AppComponent }         from './app/app.component';

registerLocaleData(localeFr);
bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
