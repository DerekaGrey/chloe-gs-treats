/**
 * Firebase web config is NOT secret: these values identify the project and ship
 * to every browser. Data protection is handled by Firestore security rules, not
 * by hiding this config.
 */
export const environment = {
  production: false,
  /** Sandbox build: talk ONLY to the local Firebase emulators, never the live project. */
  useEmulators: true,
  googlePlacesApiKey: 'AIzaSyBxAlOj7dCrv7xcShPYt0yBgyB3SBY_CJY',
  square: {
    // SANDBOX credentials. Live values live in environment.production.ts.
    mode: 'sandbox' as 'sandbox' | 'production',
    applicationId: 'sandbox-sq0idb-nMpdYXWOtm64yd6SMV0fVg',
    locationId: 'LZDNJQW0XEQV1',
    scriptUrl: 'https://sandbox.web.squarecdn.com/v1/square.js',
  },
  firebase: {
    apiKey: 'AIzaSyD7n3Kb_KnWcPSder7lByLsf0ge9qHvaP0',
    authDomain: 'chloe-gs-treats.firebaseapp.com',
    projectId: 'chloe-gs-treats',
    storageBucket: 'chloe-gs-treats.firebasestorage.app',
    messagingSenderId: '370983422776',
    appId: '1:370983422776:web:56fdc852a1459dcc614fcd',
  },
};
