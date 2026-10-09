// One command for the whole local sandbox:  npm run local
//
//   1. makes sure Java is available (the Firestore emulator needs it)
//   2. starts the Firebase emulators and waits until they accept connections
//   3. seeds test data, but only if the local database is empty
//   4. starts the site (sandbox build) at http://localhost:4200
//
// Ctrl+C stops everything; the emulators save their data on the way out.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const PROJECT = 'chloe-gs-treats';
const PORTS = { auth: 9099, functions: 5001, firestore: 8080, storage: 9199, site: 4200 };

// ---- Java -----------------------------------------------------------------
function ensureJava() {
  const has = () => spawnSync('java', ['-version'], { shell: true, stdio: 'ignore' }).status === 0;
  if (has()) return;

  // A terminal opened before Java was installed has a stale PATH; look in the
  // default install location instead.
  const roots = ['C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Java', 'C:\\Program Files\\Microsoft'];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const jdk = readdirSync(root).find((d) => /jdk/i.test(d) && existsSync(path.join(root, d, 'bin', 'java.exe')));
    if (jdk) {
      process.env.PATH = `${path.join(root, jdk, 'bin')}${path.delimiter}${process.env.PATH}`;
      console.log(`Using Java from ${path.join(root, jdk)}`);
      if (has()) return;
    }
  }
  console.error(
    '\nJava was not found. The Firestore emulator needs Java 21+.\n' +
      'Install it with:  winget install EclipseAdoptium.Temurin.21.JDK --source winget --accept-source-agreements --accept-package-agreements\n' +
      'then open a NEW terminal and run `npm run local` again.\n',
  );
  process.exit(1);
}

// ---- helpers --------------------------------------------------------------
// `localhost` can resolve to IPv4 or IPv6 depending on the tool (the Angular dev
// server binds ::1 on some machines, the emulators bind 127.0.0.1), so check both.
const tryConnect = (host, port) =>
  new Promise((resolve) => {
    const s = net.connect({ port, host });
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('error', () => resolve(false));
  });
const isUp = async (port) => (await tryConnect('127.0.0.1', port)) || (await tryConnect('::1', port));

// Cold starts are usually ~20s but have taken 2+ minutes once (JVM and network
// calls on first launch), so wait generously and say what we are waiting for.
async function waitFor(port, label, timeoutMs = 300_000) {
  const start = Date.now();
  let lastNote = start;
  while (Date.now() - start < timeoutMs) {
    if (await isUp(port)) return;
    if (Date.now() - lastNote >= 20_000) {
      console.log(`[local] still waiting for ${label} (${Math.round((Date.now() - start) / 1000)}s)...`);
      lastNote = Date.now();
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for ${label} on port ${port}`);
}

const children = [];
function run(cmd, args = []) {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: true, env: process.env });
  children.push(child);
  return child;
}

async function main() {
  ensureJava();

  // Warn (don't block) when sandbox payments can't work yet.
  try {
    const secrets = readFileSync('functions/.secret.local', 'utf8');
    if (!/^SQUARE_ACCESS_TOKEN=\S+/m.test(secrets)) {
      console.warn(
        '\n! functions/.secret.local has no SQUARE_ACCESS_TOKEN. Browsing works, but sandbox payments will fail.\n' +
          '  Get the SANDBOX token from developer.squareup.com > your app > Sandbox.\n',
      );
    }
  } catch {
    console.warn('\n! functions/.secret.local is missing (copy functions/.secret.local.example).\n');
  }

  const busy = [];
  for (const [name, port] of Object.entries(PORTS)) if (await isUp(port)) busy.push(`${name}:${port}`);
  if (busy.length) {
    console.error(`\nThese local ports are already in use: ${busy.join(', ')}.\nIs the local sandbox already running? Stop it first (Ctrl+C in its terminal).\n`);
    process.exit(1);
  }

  console.log('\n[local] starting emulators...\n');
  const emulators = run('npm', ['run', 'emulators']);
  emulators.on('exit', (code) => {
    if (!stopping) {
      console.error(`\n[local] emulators exited unexpectedly (code ${code}).`);
      shutdown(1);
    }
  });

  await waitFor(PORTS.firestore, 'Firestore emulator');
  await waitFor(PORTS.auth, 'Auth emulator');
  await waitFor(PORTS.functions, 'Functions emulator');

  // Seed only an empty database, so a restart never overwrites local test data.
  const res = await fetch(
    `http://127.0.0.1:${PORTS.firestore}/v1/projects/${PROJECT}/databases/(default)/documents/menuItems?pageSize=1`,
  );
  const body = await res.json();
  if (!body.documents?.length) {
    console.log('\n[local] local database is empty, seeding test data...\n');
    const seed = spawnSync('npm', ['run', 'seed:local'], { stdio: 'inherit', shell: true });
    if (seed.status !== 0) {
      console.error('\n[local] seeding failed.');
      shutdown(1);
    }
  } else {
    console.log('\n[local] local data already present, skipping seed.');
  }

  console.log('\n[local] starting the site...\n');
  run('npm', ['start']);
  await waitFor(PORTS.site, 'the site', 180_000);

  console.log(`
==========================================================
  LOCAL SANDBOX IS UP  (test payments, fake data)
  Site:          http://localhost:4200
  Emulator UI:   http://localhost:4000   (orders, users)
  Admin login:   admin@local.test / localadmin123
  Test card:     4111 1111 1111 1111, any future date/CVV/ZIP
  Stop:          Ctrl+C
==========================================================
`);
}

// Ctrl+C reaches every child in this console already; wait for them so the
// emulators can export their data, then exit.
//
// Anything still alive afterwards (or after a startup failure) is killed as a
// whole process tree, so a failed run never leaves emulators running in the
// background holding the ports.
function killTree(child) {
  if (child.exitCode !== null || !child.pid) return;
  spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
}

function shutdown(code = 0) {
  if (shutdown.done) return;
  shutdown.done = true;
  stopping = true;
  console.log('\n[local] stopping...');
  const alive = children.filter((c) => c.exitCode === null);
  const finish = () => {
    children.forEach(killTree);
    process.exit(code);
  };
  if (!alive.length) return finish();
  if (code !== 0) return finish(); // startup failed: nothing worth saving
  let left = alive.length;
  alive.forEach((c) => c.on('exit', () => --left === 0 && finish()));
  setTimeout(finish, 20_000).unref();
}
let stopping = false;
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

main().catch((e) => {
  console.error(`\n[local] ${e.message}`);
  shutdown(1);
});
