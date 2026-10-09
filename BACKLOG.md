# Backlog

Things we want to do but have not started. Newest first within each section. Move an item to "Done" (or delete it) when it ships.

## Planned features

### Email reminders for Chloe and for buyers

**What was asked (2026-10-09):**
- **Chloe** gets an email **2 days before** a pickup / delivery day, so she knows what to bake.
- **The buyer** gets an email **1 day before** their pickup / delivery.
- Both by email.

**How it would work**
- A scheduled Cloud Function (`onSchedule`, Cloud Scheduler) runs once a day in the morning, `America/Chicago` time.
- Chloe's reminder: find orders whose pickup/delivery date is today + 2. Needs a decision (below) on one email per day vs one per order.
- Buyer's reminder: find orders whose pickup/delivery date is today + 1 and email each buyer.
- Skip `cancelled` orders. Mark each order as reminded (`ownerReminderSentAt`, `buyerReminderSentAt`) so a retry or a second run can never send twice.
- Send through the existing Gmail setup (`sendEmail` in `functions/src/index.ts`); volume is tiny against Gmail's ~500/day.
- Dates: orders store the pickup date as local midnight, so compare as `YYYY-MM-DD` the same way `isPickupDateAllowed` does in `functions/src/pricing.ts` (UTC date of the stored timestamp, "today" in Central time). Keep the date matching in a pure function with unit tests, like the pricing rules.
- Cloud Scheduler is covered by the Blaze plan the project is already on; cost is negligible.

**Open questions to settle before building**
1. **Chloe's email: one digest per day, or one email per order?** A digest ("Tuesday: 3 orders, 24 cookies, 8 scones...") is probably more useful for baking. It could include totals per item and the delivery vs pickup split.
2. **What time of day** should reminders go out (e.g. 8 AM Central)?
3. **Buyer consent.** Today the checkout has an "email me a confirmation" box. Should reminders follow that same box, or get their own "remind me" option? Following the existing box is simplest.
4. **Content for the buyer:** pickup address and date, or for delivery the address and time slot, plus the order summary. Depends on the real pickup address being set (it is "TBD" right now).
5. **Orders placed inside the window.** The default lead time is 3 days, so Chloe's 2-day reminder is always still in the future. If the lead time is ever set below 2 days, an order could skip a reminder; decide whether to send immediately in that case.
6. **Admin changes.** If an order is edited or cancelled after a reminder is sent, nothing is recalled. Probably fine; note it.

**Testing notes:** the Functions emulator does not fire schedules on its own, so keep the logic in a pure, unit-tested function and trigger the handler manually in the emulator.

## Open tasks before / around launch

- **Real pickup address.** The live setting is "TBD" (Admin > Settings). Also replace the old `4804 John Garry Dr` address still hardcoded as a fallback in `functions/src/index.ts`, `src/app/data/seed-config.ts` and `seed.mjs`. Decide how much of a home address to show on the confirmation page and in emails.
- **Confirm the sales tax rate.** Production is 8.5% and unconfirmed; Columbia's standard combined rate is listed as 7.975% (up to 8.475% in some districts), and whether baked goods are reduced-rate depends on Missouri DOR rules (amended 2026). Chloe or her accountant must confirm; she must also be registered for Missouri sales tax.
- **App Check enforcement.** App Check tokens are attached by the site, enforcement of the payment function is `APP_CHECK_ENFORCE=false` in `functions/.env`. Enforcement was also turned on somewhere in the Firebase console on 2026-10-09 (exactly where is unknown). Verify in the console that requests show as verified, check the menu, photos, admin login and one real order after relaunch, then decide what to keep enforced.

## Ideas and deferred improvements

- **"Pause ordering" switch** in Admin > Settings: keeps the site up but closes checkout (client banner plus a server-side refusal in `processPayment`). Useful for vacations, sell-outs, and for keeping the site online before the address is ready.
- **Server-side admin session timeout.** The 30-minute idle timeout is client-side only (`IdleTimeoutService`). Fix with short-lived custom tokens and a Cloud Function. Raise it if the app ever has several admins, more sensitive customer data, or other payment handling.
- **Per-item tax rates.** The app uses one flat rate for everything. Needed only if some items are taxed differently.
- **More tests:** the checkout page UI and the admin screens have none. The sandbox walk-through (`/local`) covers them for now.
- **Upgrade `firebase-functions`.** The deploy warns the package is outdated.
- **Initial bundle size** is over the 500 kB budget (about 650 kB); a warning on every build.
