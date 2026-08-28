import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

// Initialize Firebase once. All Firebase SDK calls (getFirestore, getAuth,
// getStorage) return the same singleton — no need to thread an instance around.
const firebaseApp = initializeApp(environment.firebase);

// Firestore rejects a write outright if any field is undefined. Optional fields
// are naturally undefined all over this app, so opt into dropping them instead.
// This has to run before the first getFirestore() call anywhere.
initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
  ],
};
