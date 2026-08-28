/**
 * One-time script: grants admin custom claim to a Firebase Auth user.
 *
 * BEFORE running:
 *   1. npm install --save-dev firebase-admin
 *   2. Firebase Console → Project Settings → Service Accounts →
 *      "Generate new private key" → save as service-account.json in this directory.
 *   3. Find the target UID in Firebase Console → Authentication → Users.
 *   4. node set-admin-claim.mjs <UID>
 *
 * Safe to re-run: setCustomUserClaims overwrites, so it's idempotent.
 * Delete service-account.json when done — it has full project access.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createRequire } from 'module';

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node set-admin-claim.mjs <UID>');
  process.exit(1);
}

const require = createRequire(import.meta.url);
let serviceAccount;
try {
  serviceAccount = require('./service-account.json');
} catch {
  console.error('service-account.json not found in project root.');
  console.error('Download it from: Firebase Console → Project Settings → Service Accounts');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
await auth.setCustomUserClaims(uid, { admin: true });
console.log(`✓  admin: true set on UID ${uid}`);

const user = await auth.getUser(uid);
console.log('Claims:', user.customClaims);
console.log('\nDone. You can delete service-account.json now.');
process.exit(0);
