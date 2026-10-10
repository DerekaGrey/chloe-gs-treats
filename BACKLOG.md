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

### Make it clear (and enforced) that delivery is only within Columbia, MO

**Requested 2026-10-09:** let customers know, and stop them if needed, that Chloe only delivers within Columbia, Missouri.

**Why soon:** today nothing prevents an out-of-area delivery order. The address box only *suggests* Columbia addresses (a location bias, not a restriction), and the server only checks that some delivery address was typed. A customer in another town could pay for delivery, and Chloe would have to cancel and refund it by hand (see the refund item below).

**How it could work (both halves matter)**
- **Tell people up front:** a short notice in the delivery section of checkout ("Delivery is available within Columbia, MO only"), and on the About / Schedule pages and any FAQ. Mention it in the order confirmation for delivery orders.
- **Check the address in the browser:** restrict the address suggestions to Columbia and, when a suggestion is chosen, verify its details (city and state) before allowing payment. If it is outside the area, show a clear message and offer pickup instead.
- **Check it again on the server, because the browser can be bypassed:** `processPayment` must refuse a delivery order whose address is outside the area, with a friendly error. A manually typed address (not chosen from the suggestions) still has to be checked, so the simplest robust rule is probably the ZIP code (and "Columbia, MO") against an allowed list, kept as a pure, unit-tested function shared in spirit with the browser, like the checkout totals parity test.
- **Let Chloe change it without a deploy:** an editable "delivery area" (the allowed ZIP codes and/or city) in Admin > Settings, stored in `config/global`.
- **Lighter fallback:** a required tick-box "My delivery address is in Columbia, MO". Easy, but it only asks politely; it does not stop anyone.

**Edge cases to handle:** apartment and unit numbers; PO boxes (no delivery); ZIP codes that straddle the city limits and unincorporated Boone County (so a ZIP list can allow or refuse a few addresses wrongly); nearby towns Chloe might still want (Ashland, Rocheport); addresses typed without a ZIP.

**Open questions (not decided yet):** the rule to use (city limits, a list of ZIP codes, or a distance from the pickup point); the exact ZIP list; whether to say "contact me" for nearby towns; the wording of the notice; whether out-of-area customers can still order for pickup; the delivery fee, which is a flat $5 today.

**Related:** the delivery fee and slots live in `src/app/pages/checkout/checkout.ts` and `functions/src/pricing.ts`; the address suggestions use the Google Places key (see the custom-domain checklist).

### Recommended first: protect the business once real orders arrive

Suggested during a brainstorm on 2026-10-09. The first three protect against the problems that hurt most when orders start arriving; the next two make the paperwork easy. Nothing here is decided.

#### Order limits per day

**Problem:** there is a lead time and there are blackout dates, but no cap on how much Chloe can bake. Forty orders could land on one Saturday.

**How it could work**
- A capacity setting (per day overall, or per item per day) and a "sold out for that day" state. The date picker greys out full days.
- **Enforced on the server**, not just the browser: `processPayment` must count what is already booked for that pickup date. Two customers checking out at the same moment must not both get the last slot, so the check needs a Firestore transaction or a per-day counter document, and capacity must be **reserved before the card is charged** and released if the payment fails or the order is cancelled or refunded.
- The browser needs a public, personal-data-free view of remaining capacity (e.g. a small `dayCapacity/{YYYY-MM-DD}` document with counts only), since orders themselves are private.
- Pickup and delivery might share or split the cap. Chloe needs a way to override or raise a day's limit in Admin > Settings.

**Open questions:** what unit is capped (orders, packs, pieces, or per item); per day or per time slot; whether delivery is counted separately; how popup-stand items fit in (they are not sold online).

#### Baking list for the admin

**What:** an admin screen that totals everything due on a chosen day (default: the next pickup day), e.g. "Saturday: 6 x six-pack cookies, 4 x scones (3 maple, 1 cream cheese)". It excludes cancelled orders, splits pickup from delivery, shows total packs and pieces (`packQuantity` x `packCount`), breaks totals down by option (icing flavors), and lists who is collecting what and when. Printable.

**Notes:** the same calculation is what Chloe's "2 days before" reminder digest needs (see the reminders item), so build it once as a pure, unit-tested function and use it for both. Orders already carry the item snapshots and chosen options it needs.

**Open questions:** day only, or a whole week at a glance; what the print layout looks like.

#### Alerts when something breaks, and backups

**Problem:** failures today only appear in a log nobody reads. The worst cases are silent: a customer is charged but the order could not be saved (and the automatic refund also failed), an owner notification email fails, or the Gmail app password stops working.

**What:**
- **Alerts:** email Chloe and/or the developer when `processPayment`, the order emails, or the refund path fail. Options: a Cloud Monitoring alert on error-level logs (no code), or sending the alert email from inside the function. Possibly also an uptime check on the site.
- **Backups:** scheduled Firestore backups (daily or weekly, with a retention period), and a test that a restore actually works. Orders and customer records are the business's records.

**Open questions:** who gets the alerts; what counts as worth waking someone for; how long backups are kept (see the data-retention note under "Past orders").

#### Sales and tax report

**What:** an admin report for a date range (month or quarter) with sales (item subtotals), **sales tax collected**, delivery fees, tips, and a per-order table, exportable as CSV. It makes sales-tax filing much easier.

**Notes**
- Each order already stores `taxCents` and the `taxRatePercent` it was charged at, so a mid-period rate change does not corrupt the numbers.
- Refunds are not recorded in the app today (they happen in the Square Dashboard), so the report would be wrong for refunded orders until the refund item below exists, or until it reconciles against Square's own export.
- Use Central time for period boundaries.
- Whether the delivery fee is taxable, and the filing period (monthly, quarterly, annual), need confirming with the Missouri Department of Revenue or Chloe's accountant (see the tax-rate task below).

**Open questions:** which columns; whether tips are shown separately; whether to cross-check against Square.

#### Refund from the admin screen

**Today:** cancelling an order only changes its status. A paid order must be refunded by hand in the Square Dashboard. (Same issue as noted under "Simplify the order statuses".)

**What:** a **Refund** (or "Cancel and refund") button that calls an admin-only Cloud Function. It checks the admin claim, calls the Square Refunds API using the order's stored `squarePaymentId`, records the result on the order (`refundedCents`, a refund id, and a `refunded` payment status), and marks the order cancelled. It uses an idempotency key so a double click can never refund twice. Optionally emails the customer that the order was cancelled and refunded.

**Notes:** `paymentStatus` currently only knows `paid` and `unpaid`, so this adds new values, which touches the model, the admin badges and the sales report. Refunding a paid order should also release its capacity under "Order limits per day". Needs testing against the Square sandbox. The existing server-side auto-refund (used when an order fails to save) shows the pattern.

**Open questions:** full refunds only, or partial; whether tips are refunded with it; whether the customer is emailed automatically.

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

- **Custom domain (optional, recommended before printing or announcing widely).** The site runs fine on `chloe-gs-treats.web.app`; payments only need HTTPS, so this is not a blocker. A domain like `chloegstreats.com` (about $12 a year) looks more established, is easier to say and print, and is needed later for a verified sending domain if email outgrows Gmail (see the popup sign-up list). Buy it before any signs, flyers or QR codes are printed. Firebase Hosting connects custom domains with free certificates, and the old `web.app` address keeps working (it can be set to redirect). Checklist when adding one:
  - Connect the domain in Firebase Hosting and add the DNS records it gives you.
  - Add the new domain to the **App Check reCAPTCHA key** (Google Cloud reCAPTCHA console), or App Check tokens will fail on the new domain.
  - Add it to the **Google Maps/Places API key** referrer restrictions, if that key is restricted to specific websites (not verified from the code).
  - Add it to the **Firebase Authentication authorized domains**.
  - Square card payments need nothing extra.
  - Update the README, the emails and anything that mentions the old address.

- **Real pickup address.** The live setting is "TBD" (Admin > Settings). Also replace the old `4804 John Garry Dr` address still hardcoded as a fallback in `functions/src/index.ts`, `src/app/data/seed-config.ts` and `seed.mjs`. Decide how much of a home address to show on the confirmation page and in emails.
- **Sales tax rate: decided to keep 8.5%** (2026-10-09, the owners' call). It has not been independently confirmed with the Missouri DOR or an accountant: Columbia's standard combined rate is listed as 7.975% (up to 8.475% in some districts), and whether baked goods are reduced-rate depends on DOR rules (amended 2026). Worth a check at some point. Chloe must also be registered for Missouri sales tax and file returns. Still open: whether the $5 delivery fee is taxable, and the filing period.
- **App Check enforcement.** App Check tokens are attached by the site, enforcement of the payment function is `APP_CHECK_ENFORCE=false` in `functions/.env`. Enforcement was also turned on somewhere in the Firebase console on 2026-10-09 (exactly where is unknown). Verify in the console that requests show as verified, check the menu, photos, admin login and one real order after relaunch, then decide what to keep enforced.

## Security follow-ups (from the 2026-10-09 pre-launch review)

The review found no critical issues and no secrets in the code or its history. The race condition that could refund a paid order, the loose email check and the menu-id check were fixed and deployed. What is left, roughly in order of importance:

- **Card-testing abuse (the main remaining risk).** App Check is attached by the site but not enforced by the payment function (`APP_CHECK_ENFORCE=false`), and there is no rate limit, so a bot could script many small payment attempts through the site and land declines or charges on Chloe's Square account. Cheap mitigations, roughly in order: enforce App Check once the Firebase console shows real traffic as verified; set a **billing budget alert** in Google Cloud; look at **Square's own fraud and risk settings** in the Dashboard (and make sure the card form asks for CVV and postal code); lower `maxInstances` on `processPayment` (currently 10); add a per-IP or per-email throttle (a counter in Firestore, or a front in Cloud Armor). The idempotency key is client-chosen, so a bot can send a fresh one every time; throttling has to key on something else.
- **Admin account hardening.** Turn on two-step sign-in for the admin account, **disable public self sign-up** in Firebase Authentication (anyone can create an account through the API; it has no admin claim, so it is harmless, but it is needless surface), and confirm only one account has the admin claim. The 30-minute idle timeout is client-side only (see below).
- **Google Maps / Places key.** It is billable and public in the site. In the Google Cloud console, restrict it to this site's web addresses (HTTP referrers, including a future custom domain) and to the Places API (New) only. Cannot be checked from the code.
- **Content Security Policy.** The site has security headers now (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`) but no CSP. Add one in **report-only mode first**; it has to allow Square's card form (`web.squarecdn.com`, `pci-connect.squareup.com`, `connect.squareup.com`), Google Maps/Places and fonts, reCAPTCHA Enterprise, and Firebase. Test with a real payment before enforcing. Also confirm the three new headers are really being served (the hosting emulator cannot show them): open the live site, DevTools > Network > the first request > Response headers.
- **App Check on the confirmation lookup.** `getOrderConfirmation` is unauthenticated and un-throttled; the unguessable order id is the only protection. Low risk, but adding App Check enforcement (and a rate limit) would close the gap. Careful: a token failure there would show a paying customer "order not found".
- **Smaller code items:** order numbers are `CG-` plus 6 random digits and are not guaranteed unique (cosmetic unless Chloe looks orders up by number; use a counter or a doc-id suffix); the stored pickup date trusts the client's date string and has no upper limit (normalise to noon Central and cap how far ahead); the Square `note` and buyer email are customer-controlled but already length-capped.
- **Dependency advisories that remain.** `npm audit` still lists high-severity advisories in Angular (server-side rendering, hydration and i18n features this site does not use, and a date-formatting issue that needs a customer-controlled format), the Firebase client's gRPC dependency (a server-side feature the browser does not use) and nodemailer (options the code never sets). None looks exploitable here, but re-check on the next Angular / Firebase / nodemailer upgrade. The `firebase-functions` package is also flagged as outdated on every deploy.
- **Housekeeping:** if the Gmail app password is ever pasted anywhere, rotate it; make sure the local-only admin login (`admin@local.test`, from `seed.mjs`) never exists in production; the functions and root `typescript` versions differ (`^6` vs `~5.9`), a tooling mismatch only.

## Ideas and deferred improvements

- **Root `package-lock.json` points at the company's internal npm mirror.** 655 of its 658 package addresses are on `tfs.p.vu.local` (an internal Azure DevOps feed), while this machine's npm is set to the public registry. Where that mirror's certificate is not trusted, installs fail: on 2026-10-09 `npm ci` crashed ("Exit handler never called", an npm bug) and, because `npm ci` deletes `node_modules` first, left the site's dependencies uninstalled until it was repaired by pointing a temporary copy of the lockfile at the public registry (every entry carries a checksum, so npm verified each file). The committed lockfile was left unchanged. Fix properly: regenerate the lockfile against the registry the team actually uses, or document the required registry and certificate setup, so a new machine or build server can install. Also: do not run `npm ci` when the network is unreliable; use `npm install` instead.
- **Remember the filter tab on the admin orders page.** It resets to "All" whenever you leave and come back, because the tab is held in the page and not in the address. Putting it in the URL (a query parameter) would also make it bookmarkable. Related: the scroll-restoration fix covers the public menu and cart, not the admin pages.

- **"Pause ordering" switch** in Admin > Settings: keeps the site up but closes checkout (client banner plus a server-side refusal in `processPayment`). Useful for vacations, sell-outs, and for keeping the site online before the address is ready.
- **Server-side admin session timeout.** The 30-minute idle timeout is client-side only (`IdleTimeoutService`). Fix with short-lived custom tokens and a Cloud Function. Raise it if the app ever has several admins, more sensitive customer data, or other payment handling.
- **Per-item tax rates.** The app uses one flat rate for everything. Needed only if some items are taxed differently.
- **More tests:** the checkout page UI and the admin screens have none. The sandbox walk-through (`/local`) covers them for now.
- **Upgrade `firebase-functions`.** The deploy warns the package is outdated.
- **Initial bundle size** is over the 500 kB budget (about 650 kB); a warning on every build.
