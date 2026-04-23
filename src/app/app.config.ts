import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MAT_DATE_LOCALE, MatDateFormats, provideNativeDateAdapter } from '@angular/material/core';
import { provideRouter } from '@angular/router';

import { authInterceptor } from './auth/auth.interceptor';
import { routes } from './app.routes';

const APP_DATE_FORMATS: MatDateFormats = {
  parse: {
    dateInput: null,
    timeInput: null,
  },
  display: {
    dateInput: {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    },
    timeInput: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
    monthYearLabel: {
      month: 'short',
      year: 'numeric',
    },
    dateA11yLabel: {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    },
    monthYearA11yLabel: {
      month: 'long',
      year: 'numeric',
    },
    timeOptionLabel: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
  },
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    provideNativeDateAdapter(APP_DATE_FORMATS),
    provideRouter(routes),
  ],
};
