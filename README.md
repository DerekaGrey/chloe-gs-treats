# Chloe G's Homemade Treats

Angular 21 + Firebase (Hosting, Firestore, Auth, Storage, Cloud Functions) ordering site for a popup bakery, with Square card payments and Gmail order emails.

## The one rule

**Everything deployed to Firebase is LIVE. Sandbox (test payments) only ever runs on your own machine.**

| | Local (`npm start` + emulators) | Deployed (`npm run deploy`) |
|---|---|---|
| Square | Sandbox | Production |
| Firestore / Auth / Storage | Local emulators (throwaway data) | Real project |
| Functions | Local emulator | Cloud Functions |
| Orders / emails | Fake, local only | Real |

A browser built for one mode refuses to pay against a server in the other (`squareMode` check in `processPayment`).

## Running locally (sandbox)

One-time setup:

1. Install **Java 21+** (the Firestore emulator needs it): `winget install EclipseAdoptium.Temurin.21.JDK`, then open a new terminal.
2. `npm install` and `npm --prefix functions install`.
3. Create `functions/.secret.local` from `functions/.secret.local.example` and fill in the **sandbox** `SQUARE_ACCESS_TOKEN` (developer.squareup.com > your app > Sandbox). `GMAIL_APP_PASSWORD` is optional; without it local order emails just fail (logged).
4. `functions/.env.local` is already provided (see `.env.local.example`); it forces sandbox mode in the emulator.

Each session, in two terminals:

```
npm run emulators     # Firestore, Auth, Storage, Functions + UI at http://localhost:4000
npm start             # the site at http://localhost:4200 (sandbox build)
```

First run only, with the emulators running, seed test data and a local admin login:

```
npm run seed:local    # menu, events, config; admin@local.test / localadmin123
```

Emulator data is saved to `.emulator-data/` (git-ignored) on exit, so you only seed once.

Square sandbox test card: `4111 1111 1111 1111`, any future expiry, any CVV and ZIP.

## Git workflow

- `main` is production. Only deploy from `main`.
- Work on a short-lived feature branch (`feature/<name>`), test it locally against the emulators, then merge to `main`.
- No long-lived `test` branch: local emulators are the test environment.

## Deploying (live)

From the project root, on `main`:

```
npm run deploy
```

This builds the **live** site, builds the functions, and deploys hosting, functions and Firestore/Storage rules together (they must go out together). It is refused while the live Square configuration is unfinished (`scripts/check-live.mjs`). Always run it from the project root: `functions/package.json` has its own, different `deploy` script.

## Going live with real payments (one-time checklist)

Credentials come from developer.squareup.com > your application > **Production** tab.

1. `src/environments/environment.production.ts`: set `square.applicationId` (starts `sq0idp-`) and `square.locationId`.
2. `functions/.env`: set `SQUARE_LOCATION_ID` to the production location (keep `SQUARE_ENV=production`).
3. Set the production access token as a secret (the `!` prompt in Claude Code is non-interactive, so use a file):
   `firebase functions:secrets:set SQUARE_ACCESS_TOKEN --data-file <file>`, then delete the file.
4. Set the real sales tax in the admin Settings screen (`config/global.taxRatePercent`; default is 0%).
5. `npm run deploy`, then place one small real order and refund it from the Square dashboard.

## Email

Order emails go out through the bakery Gmail account via SMTP (`GMAIL_APP_PASSWORD` secret, a Google App Password; requires 2-Step Verification). To rotate it: `firebase functions:secrets:set GMAIL_APP_PASSWORD --data-file <file>`, delete the file, redeploy.

## Layout

- `src/app` Angular app (signals, standalone components). `src/environments/environment.ts` = sandbox/local, `environment.production.ts` = live.
- `functions/src/index.ts` Cloud Functions: `processPayment` (server-side pricing, Square charge, order write, auto-refund on failure), `getOrderConfirmation`, `onOrderCreated` (emails).
- `firestore.rules` orders are admin-read only and created solely by `processPayment`.
- `scripts/` build and deploy guards. `seed.mjs` seeds Firestore (use `npm run seed:local` for the emulator).
