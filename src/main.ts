import { bootstrapApplication } from '@angular/platform-browser';
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { AppComponent, routes } from './app/app';

const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
  ],
};

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
