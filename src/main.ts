import { bootstrapApplication } from '@angular/platform-browser';
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { TitleStrategy, provideRouter, withInMemoryScrolling } from '@angular/router';
import { AppComponent, routes } from './app/app';
import { AppTitleStrategy } from './app/core/title-strategy';

const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
  ],
};

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
