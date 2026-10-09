// Builds the Angular app.
//
//   npm run build        -> SANDBOX build, for running locally (ng serve uses
//                           the same environment.ts). Never deployed.
//   npm run build:live   -> LIVE build. This is what every deploy uses.
//
// A live build is refused while the live Square configuration is unfinished.
import { spawnSync } from 'node:child_process';

const live = process.env.APP_ENV === 'live';

if (live) {
  const check = spawnSync('node', ['scripts/check-live.mjs'], { stdio: 'inherit' });
  if (check.status !== 0) process.exit(check.status ?? 1);
}

console.log(`\nBuilding Angular app: ${live ? 'LIVE (real payments)' : 'SANDBOX (local use only)'}\n`);

const result = spawnSync('npx', ['ng', 'build', '--configuration', live ? 'production' : 'sandbox'], {
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
