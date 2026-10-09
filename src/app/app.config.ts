import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

// Initialize Firebase once. All Firebase SDK calls (getFirestore, getAuth,
// getStorage) return the same singleton — no need to thread an instance around.
const firebaseApp = initializeApp(environment.firebase);

// Firestore rejects a write outright if any field is undefined. Optional fields
// are naturally undefined all over this app, so opt into dropping them instead.
// This has to run before the first getFirestore() call anywhere.
const firestore = initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });

// Sandbox builds (ng serve) use only the local emulators (`npm run emulators`), so
// testing can never touch real orders, real customers or real payments. Deployed
// builds use the production environment file, where this is false.
if (environment.useEmulators) {
  connectFirestoreEmulator(firestore, 'localhost', 8080);
  connectAuthEmulator(getAuth(firebaseApp), 'http://localhost:9099', { disableWarnings: true });
  connectStorageEmulator(getStorage(firebaseApp), 'localhost', 9199);
  connectFunctionsEmulator(getFunctions(firebaseApp), 'localhost', 5001);
}

// App Check: attaches a reCAPTCHA Enterprise token to every callable request so the
// payment function can reject traffic that did not come from this site. Not used
// against the local emulators, which do not check it.
if (!environment.useEmulators && environment.appCheckSiteKey) {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(environment.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
  ],
};
