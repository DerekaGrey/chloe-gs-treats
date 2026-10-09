// Guard run before every deploy. Everything deployed to Firebase is LIVE, so
// refuse to continue while the live Square configuration is unfinished.
// Runs from the project root (see predeploy in firebase.json and scripts/build.mjs).
//
// Only real VALUES count as unfinished: a quoted 'REPLACE_ME' in the TypeScript
// file, or KEY=REPLACE_ME in the .env file. Comments that mention the word do not.
import { readFileSync } from 'node:fs';

export function findProblems(envProductionTs, functionsEnv) {
  const problems = [];

  if (/['"]REPLACE_ME['"]/.test(envProductionTs)) {
    problems.push(
      'src/environments/environment.production.ts still has a REPLACE_ME value ' +
        '(production Square applicationId / locationId, or the App Check reCAPTCHA appCheckSiteKey).',
    );
  }

  if (/^\s*[A-Z_]+\s*=\s*REPLACE_ME\s*$/m.test(functionsEnv)) {
    problems.push('functions/.env still has a REPLACE_ME value (production SQUARE_LOCATION_ID).');
  }
  if (!/^SQUARE_ENV=production\s*$/m.test(functionsEnv)) {
    problems.push('functions/.env must set SQUARE_ENV=production for a deploy.');
  }

  return problems;
}

// Run as a script (not when imported by a test).
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const problems = findProblems(
    readFileSync('src/environments/environment.production.ts', 'utf8'),
    readFileSync('functions/.env', 'utf8'),
  );

  if (problems.length) {
    console.error('\nRefusing to deploy: the live Square configuration is not finished.\n');
    for (const p of problems) console.error('  - ' + p);
    console.error('\nSee the go-live steps in README.md.\n');
    process.exit(1);
  }
  console.log('Live Square configuration looks complete.');
}
