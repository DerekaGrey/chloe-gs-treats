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

### Popup-day sign-up list, with an email whenever a popup is scheduled

**Idea (2026-10-09):** an option on the site to sign up for news about popup days. Whenever Chloe schedules a popup in the admin screen, everyone on the list gets an email about it.

**How it would work**
- **Sign-up form** somewhere visible (footer, home page, the Schedule page, and possibly a separate "also tell me about popups" box at checkout; never add buyers to the list without that explicit tick). It saves just an email address (and optionally a name) plus when and where they signed up.
- **Sending:** a trigger on new popup events (`onDocumentCreated` on `popupEvents`) emails the list with the date, time, location and what is on the stand. Alternatively a "Send announcement" button on the event in the admin screen, so editing or drafting an event never emails anyone by accident.
- **Unsubscribe:** every email carries a one-click unsubscribe link (a signed token, handled by a Cloud Function) that removes the address.

**Rules and risks to plan for (this is marketing email, not an order receipt)**
- **Consent and unsubscribe:** only people who sign up. Every email needs a working unsubscribe, honored promptly. Double opt-in (confirm by clicking a link in a first email) keeps typos and other people's addresses off the list.
- **Postal address:** US anti-spam law (CAN-SPAM) requires a valid physical postal address in commercial emails. This overlaps with the home-address question: a PO box or a business address would avoid putting the house in every announcement. Check the exact requirement before launching.
- **Sender limits:** announcements currently could only go through the bakery Gmail account (about 500 recipients a day, and bulk sending from a personal Gmail can get the account flagged). Fine for a small list, but a larger one needs a real email provider (which needs a verified domain), or a service that manages lists and unsubscribes itself.
- **Privacy of the list:** the email addresses must not be readable from the browser. Sign-ups should go through a Cloud Function, not directly into Firestore, so the list is private and can be protected with App Check and rate limiting.
- **Abuse:** a public form can be spammed with fake or other people's emails; double opt-in and rate limits handle most of that.
- **Privacy notice:** a short line near the form saying what the emails are for and how to unsubscribe.

**Open questions (not decided yet):** send automatically on creation or via an admin button; double opt-in or not; where the form lives; whether to also announce changes or cancellations to an event; Gmail vs a proper email service; what postal address goes in the footer; whether to add a reminder shortly before the event.

**Related:** reuses `sendEmail`, and shares the "update email opt-in wording" question with the reminders and thank-you items below.

### Thank-you email after an order is picked up

**Idea (2026-10-09):** when Chloe marks an order **Picked Up** in the admin screen, email the customer a short thank-you from Chloe G's.

**Why it is probably not too spammy:** a customer would get about three emails per order in total (confirmation, the planned 1-day reminder, and this thank-you), each at a different, useful moment. A single thank-you after the order is done is a normal, welcome touch. It stays welcome if it is short, personal and sent once.

**Things to get right**
- **Send once.** Mark the order (`thanksSentAt`) so toggling the status back and forth, or a retry, cannot email twice.
- **Only to buyers who agreed to emails.** Today the checkout box says "email me a confirmation". Reminders and a thank-you go beyond a confirmation, so the box wording should change to something like "Email me updates about my order". Orders placed before the wording change should keep their original scope.
- **Keep it a thank-you, not marketing.** A purely thank-you / order-complete message is transactional. If it starts to carry promotions (new flavors, upcoming popups, discounts), it becomes marketing email, which brings stricter rules (clear sender identity, an unsubscribe option). A light "see what's on the menu" link is fine, but check before adding promotions.
- **Timing.** Emailing the instant she taps the button, while the customer may still be standing there, can feel odd. Sending a few hours later or the next morning is nicer, but needs the scheduler (shared with the reminders work).
- **Mistakes.** If she marks the wrong order Picked Up, the email is already out. A short delay (or a confirm prompt in the admin) reduces that.
- **Not for cancelled orders.** Only the Picked Up transition triggers it.
- **Make it useful:** reply goes to Chloe's Gmail (it already sends from her account), and it could invite a review or feedback and link to the menu for reordering.

**Technically:** a Firestore trigger on order updates (`onDocumentUpdated`) that fires when the status changes to `pickedup`, plus the sent-marker above. Reuse `sendEmail`.

**Open questions (not decided yet):** send immediately or delayed; include a review/feedback link; wording of the opt-in box; who the email is signed by.

### Past orders tab (time-gate finished orders)

**Today:** Picked Up and Cancelled orders stay in their tabs, and in "All", forever. The admin screen also loads *every* order ever placed through one live listener on the whole `orders` collection, so the list gets longer and the reads grow with history.

**Options**
- **A. UI only.** Add a **Past orders** tab. Picked Up / Cancelled orders whose pickup date is older than N days (e.g. 30) move there and drop out of "All". No data change and no scheduled job. It tidies the screen but does not reduce reads.
- **B. A, plus stop loading everything.** The live list only queries recent orders (e.g. `pickupDate` within the last N days, or any order not yet finished). "Past orders" fetches older ones on demand, a page at a time. This is the one that keeps the admin fast as years of orders pile up.
- **C. A `archived` flag set by a scheduled job.** Needs Cloud Scheduler (shared with the reminders work). Only worth it if we later want to query by it.

**Decisions needed:** how many days; measure from the pickup date (we have it) or from when the order was marked picked up (we do not record that today); whether Cancelled orders move over immediately; searching past orders by name or order number.

**Related: how long to keep customer details.** Orders hold names, emails, phone numbers and delivery addresses. Do not delete orders that are needed for tax and accounting records (ask Chloe's accountant how long to keep them). One option is to keep the totals but blank out the contact details after some months.

### Simplify the order statuses (clean-up)

**Why:** there are 6 statuses and 5 filter tabs, and some do not match how orders really flow now.
- **Pending** is dead on the live site: a card is charged at checkout, so every real order is created as Confirmed and Paid. It is left over from the removed pay-at-pickup idea.
- **Active** is not a status, only a tab that shows Confirmed + Baking.

**Ideas**
- Drop Pending (move any existing ones to Confirmed). Rename the tabs after what Chloe actually does, e.g. *To bake* (Confirmed + Baking), *Ready*, *Done*, *Cancelled*. Merge Confirmed and Baking if she does not use both.
- **Cancelling an order does not refund it** (the admin screen only changes the status; refunds are done by hand in the Square Dashboard). Either remind her on cancel or issue the refund through the Square API.
- Optional: email the customer when an order moves to Ready ("ready for pickup").

**What it touches:** the `OrderStatus` type, `STATUS_NEXT` and the filters in `order-list.ts`, existing order documents, the emails, and tests.

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
