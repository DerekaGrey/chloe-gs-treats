import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { initializeApp } from 'firebase/app';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

// Initialize Firebase once. All Firebase SDK calls (getFirestore, getAuth,
// getStorage) return the same singleton — no need to thread an instance around.
initializeApp(environment.firebase);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
  ],
};
