/**
 * LIVE configuration. Angular swaps this in for `--configuration production`
 * (built by `npm run deploy:live`). Plain `npm run build` / `npm run deploy`
 * use environment.ts (Square sandbox) instead, so real cards are never charged
 * by accident.
 *
 * Fill the three Square values below from developer.squareup.com > your app >
 * Production tab. scripts/build.mjs refuses to run a live build while any
 * value still contains REPLACE_ME.
 */
export const environment = {
  production: true,
  useEmulators: false,
  /** reCAPTCHA v3 SITE key (public) registered under Firebase console > App Check. */
  appCheckSiteKey: 'REPLACE_ME',
  googlePlacesApiKey: 'AIzaSyBxAlOj7dCrv7xcShPYt0yBgyB3SBY_CJY',
  square: {
    mode: 'production' as 'sandbox' | 'production',
    applicationId: 'REPLACE_ME',
    locationId: 'REPLACE_ME',
    scriptUrl: 'https://web.squarecdn.com/v1/square.js',
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
