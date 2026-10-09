---
name: deploy
description: Deploy Chloe G's Treats to the LIVE Firebase site (real payments) with pre-flight checks, an explicit confirmation, and post-deploy verification. Use when the user says "deploy", "go live", "ship it", or "push to prod".
disable-model-invocation: true
---

Everything deployed to Firebase is LIVE: real customers, real cards, real emails. Sandbox exists only on the user's machine (`/local`). Treat a deploy as outward-facing and hard to undo: do every check below, show the user what is about to go live, and **wait for an explicit yes before running the deploy command**. A earlier "go ahead" for a different change does not count.

## 1. Pre-flight (run these; stop and report on the first failure)

Run from the project root `C:\code\PDT\chloe-gs-treats` (NOT `functions/`, which has a different `deploy` script).

1. **Branch and tree:** `git branch --show-current` must be `main`, and `git status --short` must be empty. If not on `main` or the tree is dirty, stop: deploys only come from a clean, merged `main`.
2. **Up to date:** `git fetch origin` then `git rev-list --left-right --count origin/main...main`. Anything to pull (left > 0) means stop and tell the user. Anything unpushed (right > 0): tell the user that GitHub does not have what is about to go live, and ask whether to push first.
3. **Tests:** `npm run test:all` must pass (client Vitest plus the server pricing and parity tests). If the client worker crashes with "Worker exited unexpectedly", rerun once (it has been seen intermittently); if it fails again, report it.
4. **Live config guard:** `node scripts/check-live.mjs` must say the live Square configuration looks complete. (`npm run deploy` runs it too, but surfacing it first is clearer.)
5. **Known live settings:** read `functions/.env` and report `SQUARE_ENV` (must be `production`) and `APP_CHECK_ENFORCE` (true/false) so the user sees what the deploy will turn on.

## 2. Show what will go live

Summarise for the user in a few lines:
- the commits being deployed (`git log --oneline -5`),
- that hosting, Cloud Functions, Firestore rules and Storage rules all go out together,
- that this replaces the live site at https://chloe-gs-treats.web.app,
- any secret changes that only take effect on this deploy (e.g. a `SQUARE_ACCESS_TOKEN` or `GMAIL_APP_PASSWORD` set since the last deploy).

Then ask: "Deploy to live now?" and stop until they answer yes.

## 3. Deploy

`npm run deploy` from the project root. It takes several minutes, so use `run_in_background` and read the output when it finishes (do not poll in a loop). Never run `firebase deploy --only functions` (or hosting, or rules) on its own: they must go out together. Never pass `--force`.

Success means the output ends with "Deploy complete!". Look specifically for:
- `Skipped (No changes detected)` on a function is fine,
- an "unexpected state" or "not associated with a service" warning means redeploy the functions once, with nothing else running.

## 4. Verify and report

1. `curl -s -o /dev/null -w "%{http_code}" https://chloe-gs-treats.web.app` should be 200.
2. Tell the user to do the checks only a person can:
   - open the live site and click through whatever changed,
   - for a payment-related change, place one small real order (cheapest item, pickup, email box ticked), confirm the confirmation page, both emails, Admin > Orders and the Square Dashboard, then refund it in the Square Dashboard (refunds are theirs to do),
   - after a first deploy with App Check, check Firebase console > App Check > APIs > Cloud Functions shows requests as verified, and only then set `APP_CHECK_ENFORCE=true` and deploy again.
3. If something is wrong, read the function logs (`firebase functions:log`) rather than guessing.

## Rolling back

Hosting: Firebase console > Hosting > release history has a one-click rollback. Functions and rules: revert the offending commit on `main` and run this skill again. Do not roll back by deploying from an old branch.
