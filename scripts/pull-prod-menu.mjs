// Copies the REAL menu, events and settings from production into the LOCAL
// emulator, so local testing shows the same items, prices and photos as the site.
//
//   npm run pull:prod        (the emulators must be running)
//
// Direction is strictly production -> local:
//   - production is only ever read (GET), through its public REST API. Menu,
//     events and config are publicly readable by design (see firestore.rules).
//   - writes go only to the emulator at 127.0.0.1, and this script refuses to run
//     if that is not what it is pointed at.
// Orders and customer data are never copied. Photos stay in production Storage;
// the local site just loads the same public image URLs.

const PROJECT = 'chloe-gs-treats';
const PROD = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(HOST)) {
  console.error(`Refusing to write to "${HOST}": the target must be the local emulator.`);
  process.exit(1);
}
const LOCAL = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
// The emulator treats this token as an admin and skips security rules.
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

async function readProd(path) {
  const docs = [];
  let token = '';
  do {
    const res = await fetch(`${PROD}/${path}?pageSize=200${token ? `&pageToken=${token}` : ''}`);
    if (!res.ok) throw new Error(`Reading production ${path} failed: HTTP ${res.status}`);
    const body = await res.json();
    docs.push(...(body.documents ?? []));
    token = body.nextPageToken ?? '';
  } while (token);
  return docs;
}

async function readProdDoc(path) {
  const res = await fetch(`${PROD}/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Reading production ${path} failed: HTTP ${res.status}`);
  return res.json();
}

const idOf = (doc) => doc.name.split('/').pop();

async function clearLocal(collection) {
  const res = await fetch(`${LOCAL}/${collection}?pageSize=300`, { headers: OWNER });
  const body = await res.json();
  for (const doc of body.documents ?? []) {
    await fetch(`${LOCAL}/${collection}/${idOf(doc)}`, { method: 'DELETE', headers: OWNER });
  }
}

async function writeLocal(path, doc) {
  const res = await fetch(`${LOCAL}/${path}`, {
    method: 'PATCH',
    headers: OWNER,
    body: JSON.stringify({ fields: doc.fields }),
  });
  if (!res.ok) throw new Error(`Writing local ${path} failed: HTTP ${res.status} ${await res.text()}`);
}

try {
  for (const collection of ['menuItems', 'popupEvents']) {
    const docs = await readProd(collection);
    await clearLocal(collection);
    for (const doc of docs) await writeLocal(`${collection}/${idOf(doc)}`, doc);
    console.log(`Copied ${docs.length} ${collection} from production`);
  }
  const config = await readProdDoc('config/global');
  if (config) {
    await writeLocal('config/global', config);
    console.log('Copied config/global from production');
  }
  console.log('Local menu now matches production (orders and customers are not copied).');
} catch (err) {
  console.error(`\npull:prod failed: ${err.message}`);
  console.error('Local data was left as it was seeded; is the emulator running, and are you online?');
  process.exit(1);
}
