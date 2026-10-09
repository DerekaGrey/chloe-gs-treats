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

1. Install **Java 21+** (the Firestore emulator needs it): `winget install EclipseAdoptium.Temurin.21.JDK --source winget --accept-source-agreements --accept-package-agreements`, then open a new terminal.
2. `npm install` and `npm --prefix functions install`.
3. Create `functions/.secret.local` from `functions/.secret.local.example` and fill in the **sandbox** `SQUARE_ACCESS_TOKEN` (developer.squareup.com > your app > Sandbox). `GMAIL_APP_PASSWORD` is optional; without it local order emails just fail (logged).
4. `functions/.env.local` is already provided (see `.env.local.example`); it forces sandbox mode in the emulator.

Each session, one command:

```
npm run local
```

It finds Java, starts the emulators, seeds test data only if the local database is empty, and starts the site at http://localhost:4200 (emulator UI at http://localhost:4000, local admin `admin@local.test` / `localadmin123`). Ctrl+C stops everything and saves the emulator data. In Claude Code you can also type `/local`.

The pieces, if you want them separately: `npm run emulators`, `npm start`, `npm run seed:local`.

The first time (empty local database) it also copies the **real menu, events and settings from production** so local shows the same items, prices and photos. That is read-only from production and never copies orders or customers. Refresh it any time, e.g. after Chloe edits the menu, with `npm run pull:prod` while the emulators are running.

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

## App Check (bot protection for payments)

`processPayment` can require an App Check token, which proves a request came from this website and not a script (this blocks card-testing abuse). The site sends tokens automatically in live builds; the local emulators don't check them. Enforcement is controlled by `APP_CHECK_ENFORCE` in `functions/.env` and is **off by default**, so a deploy can never break checkout.

One-time setup (Firebase console and Google reCAPTCHA, which only you can do):

1. Create a **reCAPTCHA v3** key at https://www.google.com/recaptcha/admin for the site's domains (`chloe-gs-treats.web.app`, plus any custom domain). Keep the **site key** and **secret key**.
2. Firebase console > **App Check** > Apps > register the web app, choose **reCAPTCHA**, paste the **secret key**.
3. Put the **site key** in `src/environments/environment.production.ts` (`appCheckSiteKey`). The site key is public.
4. `npm run deploy` (enforcement still off). Place a test order on the live site.
5. Firebase console > App Check > APIs > Cloud Functions: confirm requests show as **verified**.
6. Set `APP_CHECK_ENFORCE=true` in `functions/.env` and deploy again. Real orders now need a valid token.

If checkout ever fails after step 6, set `APP_CHECK_ENFORCE=false` and redeploy to switch enforcement off again.

## Email

Order emails go out through the bakery Gmail account via SMTP (`GMAIL_APP_PASSWORD` secret, a Google App Password; requires 2-Step Verification). To rotate it: `firebase functions:secrets:set GMAIL_APP_PASSWORD --data-file <file>`, delete the file, redeploy.

## Layout

- `src/app` Angular app (signals, standalone components). `src/environments/environment.ts` = sandbox/local, `environment.production.ts` = live.
- `functions/src/index.ts` Cloud Functions: `processPayment` (server-side pricing, Square charge, order write, auto-refund on failure), `getOrderConfirmation`, `onOrderCreated` (emails).
- `firestore.rules` orders are admin-read only and created solely by `processPayment`.
- `scripts/` build and deploy guards. `seed.mjs` seeds Firestore (use `npm run seed:local` for the emulator).
