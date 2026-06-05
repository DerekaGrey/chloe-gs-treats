/**
 * Firebase web config is NOT secret: these values identify the project and ship
 * to every browser. Data protection is handled by Firestore security rules, not
 * by hiding this config.
 */
export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyD7n3Kb_KnWcPSder7lByLsf0ge9qHvaP0',
    authDomain: 'chloe-gs-treats.firebaseapp.com',
    projectId: 'chloe-gs-treats',
    storageBucket: 'chloe-gs-treats.firebasestorage.app',
    messagingSenderId: '370983422776',
    appId: '1:370983422776:web:56fdc852a1459dcc614fcd',
  },
};
