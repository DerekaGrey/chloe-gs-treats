// Guard run before every deploy. Everything deployed to Firebase is LIVE, so
// refuse to continue while the live Square configuration is unfinished.
// Runs from the project root (see predeploy in firebase.json and scripts/build.mjs).
import { readFileSync } from 'node:fs';

const problems = [];

const envProd = readFileSync('src/environments/environment.production.ts', 'utf8');
if (envProd.includes('REPLACE_ME')) {
  problems.push('src/environments/environment.production.ts still contains REPLACE_ME (production Square applicationId / locationId).');
}

const fnEnv = readFileSync('functions/.env', 'utf8');
if (fnEnv.includes('REPLACE_ME')) {
  problems.push('functions/.env still contains REPLACE_ME (production SQUARE_LOCATION_ID).');
}
if (!/^SQUARE_ENV=production\s*$/m.test(fnEnv)) {
  problems.push('functions/.env must set SQUARE_ENV=production for a deploy.');
}

if (problems.length) {
  console.error('\nRefusing to deploy: the live Square configuration is not finished.\n');
  for (const p of problems) console.error('  - ' + p);
  console.error('\nSee the go-live steps in README.md.\n');
  process.exit(1);
}
console.log('Live Square configuration looks complete.');
