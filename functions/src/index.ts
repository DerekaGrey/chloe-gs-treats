// IMPORTANT: do NOT import from the "firebase-functions" root here, and do not
// reintroduce setGlobalOptions(). The root entry eagerly loads v2/index.js, which
// pulls in the database provider -> firebase-admin/lib/database ->
// @firebase/database-compat/standalone, whose bundle unconditionally require()s
// @firebase/app. database-compat declares @firebase/app as an *optional* peer dep,
// so npm skips installing it and the Cloud Run container dies on boot with
// "Cannot find module '@firebase/app'" (surfacing only as "Container Healthcheck
// failed"). Importing the specific subpaths below avoids that chain. package.json
// also pins @firebase/app as a belt-and-braces safeguard — leave both in place.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineBoolean, defineSecret, defineString } from "firebase-functions/params";
import * as nodemailer from "nodemailer";
import {
  MAX_CART_LINES,
  PricingError,
  computeTotals,
  isPickupDateAllowed,
  parseLeadDays,
  priceCart,
  type CartLineRequest,
} from "./pricing.js";
import { saveOrderOrRefund } from "./order-write.js";
import { isValidEmail, singleLine } from "./validation.js";
import * as admin from "firebase-admin";

admin.initializeApp();

const squareAccessToken = defineSecret("SQUARE_ACCESS_TOKEN");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

// Emails go out through the bakery Gmail account using an app password
// (Google Account > Security > App passwords). Gmail always sends as the
// authenticated account, so replies to customers land in Chloe's own inbox.
// Limit is ~500 messages/day, far above this bakery's volume.
const GMAIL_USER = "chloegshomemadetreats@gmail.com";
const FROM_EMAIL = `Chloe G's Homemade Treats <${GMAIL_USER}>`;

// Square mode and location come from functions/.env (see the cutover notes there).
// Defaults to sandbox so a missing value can never silently charge real cards.
const squareEnv = defineString("SQUARE_ENV", { default: "sandbox" });
const squareLocationId = defineString("SQUARE_LOCATION_ID");

// App Check proves a payment request came from OUR website, not a script or bot
// (blocks card-testing abuse). Off by default so a deploy can never break checkout
// before the site is sending tokens; flip APP_CHECK_ENFORCE=true in functions/.env
// once the Firebase console shows the traffic as verified (see README).
const appCheckEnforce = defineBoolean("APP_CHECK_ENFORCE", { default: false });

const squareBaseUrl = () =>
  squareEnv.value() === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
const SQUARE_VERSION = "2025-07-16";

interface CartLine {
  nameSnapshot: string;
  packLabelSnapshot: string;
  packCount: number;
  lineTotalCents: number;
  selectedOptions?: { groupName: string; optionLabel: string }[];
  [key: string]: unknown;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// Customer-supplied strings land in an HTML email — escape them.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function orderEmailHtml(opts: {
  name: string;
  orderNumber: string;
  lines: CartLine[];
  totalCents: number;
  deliveryFeeCents?: number;
  taxCents?: number;
  tipCents?: number;
  pickupDate: Date;
  pickupLocation: string;
  paymentMethod: string;
  fulfillmentType: string;
  deliveryAddress?: string;
  deliveryUnit?: string;
  deliveryTime?: string;
  specialRequests?: string;
}): string {
  const rows = opts.lines
    .map((l) => {
      const optLines = (l.selectedOptions ?? [])
        .map((o) => `<div style="color:#8a6f5e;font-size:12px;margin-top:2px">${esc(o.groupName)}: ${esc(o.optionLabel)}</div>`)
        .join("");
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e8ddd6;color:#33291f;font-size:14px">${l.packCount} × ${esc(l.nameSnapshot)} (pack of ${esc(l.packLabelSnapshot)})${optLines}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e8ddd6;text-align:right;color:#33291f;font-size:14px;white-space:nowrap">${money(l.lineTotalCents)}</td>
      </tr>`;
    })
    .join("");

  const pickup = opts.pickupDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });

  const paymentNote = opts.paymentMethod === "square"
    ? `<p style="margin:0;color:#8a6f5e;font-size:13px">Nothing to pay at pickup. Your card has already been charged.</p>`
    : `<p style="margin:0;color:#33291f;font-size:14px"><strong>Payment:</strong> Please pay via Venmo or cash when you pick up your order.</p>`;

  return `<div style="margin:0;padding:0;background-color:#F4DEE1">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4DEE1;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background-color:#F1ECE2;border-radius:8px;overflow:hidden;max-width:520px;width:100%">

        <!-- Header -->
        <tr><td style="background-color:#C24038;padding:28px 32px;text-align:center">
          <p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#ffffff;letter-spacing:1px">Chloe G's Homemade Treats</p>
          <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#f4dee1;letter-spacing:2px;text-transform:uppercase">Order Confirmation</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;color:#33291f">
          <p style="margin:0 0 4px;font-size:18px;font-weight:bold">Thank you, ${esc(opts.name)}!</p>
          <p style="margin:0 0 20px;font-size:14px;color:#8a6f5e">Your order has been placed. Here are the details:</p>

          <p style="margin:0 0 16px;font-size:13px;color:#8a6f5e;letter-spacing:1px;text-transform:uppercase;font-weight:bold">Order ${esc(opts.orderNumber)}</p>

          <table width="100%" cellpadding="0" cellspacing="0">
            ${rows}
            ${opts.deliveryFeeCents ? `<tr>
              <td style="padding:8px 0 0;font-size:14px;color:#8a6f5e">Delivery fee</td>
              <td style="padding:8px 0 0;text-align:right;font-size:14px;color:#8a6f5e">${money(opts.deliveryFeeCents)}</td>
            </tr>` : ""}
            ${opts.taxCents ? `<tr>
              <td style="padding:8px 0 0;font-size:14px;color:#8a6f5e">Sales tax</td>
              <td style="padding:8px 0 0;text-align:right;font-size:14px;color:#8a6f5e">${money(opts.taxCents)}</td>
            </tr>` : ""}
            ${opts.tipCents ? `<tr>
              <td style="padding:8px 0 0;font-size:14px;color:#8a6f5e">Tip</td>
              <td style="padding:8px 0 0;text-align:right;font-size:14px;color:#8a6f5e">${money(opts.tipCents)}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:12px 0 0;font-size:15px;font-weight:bold;color:#33291f">Total</td>
              <td style="padding:12px 0 0;text-align:right;font-size:15px;font-weight:bold;color:#C24038">${money(opts.totalCents)}</td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background-color:#F4DEE1;border-radius:6px">
            <tr><td style="padding:16px">
              ${opts.fulfillmentType === "delivery"
                ? `<p style="margin:0 0 6px;font-size:13px;color:#8a6f5e;letter-spacing:1px;text-transform:uppercase;font-weight:bold">Delivery</p>
                   <p style="margin:0;font-size:14px;color:#33291f;font-weight:bold">${pickup}${opts.deliveryTime ? ` at ${esc(opts.deliveryTime)}` : ""}</p>
                   <p style="margin:4px 0 0;font-size:13px;color:#8a6f5e">${esc(opts.deliveryAddress ?? "")}</p>
                   ${opts.deliveryUnit ? `<p style="margin:2px 0 0;font-size:13px;color:#33291f;font-weight:bold">${esc(opts.deliveryUnit)}</p>` : ""}
                   <p style="margin:8px 0 0;font-size:12px;color:#8a6f5e;font-style:italic">We'll be in touch to confirm your delivery window.</p>`
                : `<p style="margin:0 0 6px;font-size:13px;color:#8a6f5e;letter-spacing:1px;text-transform:uppercase;font-weight:bold">Pickup</p>
                   <p style="margin:0;font-size:14px;color:#33291f;font-weight:bold">${pickup}</p>
                   <p style="margin:4px 0 0;font-size:13px;color:#8a6f5e">${esc(opts.pickupLocation)}</p>`
              }
            </td></tr>
          </table>

          ${opts.specialRequests ? `<p style="margin:20px 0 0;font-size:14px"><strong>Special requests:</strong> ${esc(opts.specialRequests)}</p>` : ""}

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #e8ddd6">
            <tr><td style="padding-top:16px">${paymentNote}</td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background-color:#e8ddd6;padding:16px 32px;text-align:center">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a6f5e;line-height:1.5">
            This product is prepared in a kitchen not subject to inspection by the Missouri Department of Health and Senior Services.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</div>`;
}

function ownerEmailHtml(opts: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  lines: CartLine[];
  totalCents: number;
  deliveryFeeCents?: number;
  taxCents?: number;
  tipCents?: number;
  pickupDate: Date;
  paymentMethod: string;
  paymentStatus: string;
  fulfillmentType: string;
  deliveryAddress?: string;
  deliveryUnit?: string;
  deliveryTime?: string;
  specialRequests?: string;
}): string {
  const rows = opts.lines
    .map((l) => {
      const optLines = (l.selectedOptions ?? [])
        .map((o) => `${esc(o.groupName)}: ${esc(o.optionLabel)}`)
        .join(", ");
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e8ddd6;color:#33291f;font-size:14px">${l.packCount} × ${esc(l.nameSnapshot)} (pack of ${esc(l.packLabelSnapshot)})${optLines ? `<div style="color:#8a6f5e;font-size:12px;margin-top:2px">${optLines}</div>` : ""}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e8ddd6;text-align:right;color:#33291f;font-size:14px;white-space:nowrap">${money(l.lineTotalCents)}</td>
      </tr>`;
    })
    .join("");

  const pickup = opts.pickupDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });

  const paymentLabel = opts.paymentMethod === "square" ? "Square (paid)" : "Pay at pickup";
  const isDelivery = opts.fulfillmentType === "delivery";
  const fulfillmentLabel = isDelivery
    ? `${pickup}${opts.deliveryTime ? ` at ${esc(opts.deliveryTime)}` : ""}`
    : pickup;

  return `<div style="margin:0;padding:0;background-color:#F4DEE1">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4DEE1;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#F1ECE2;border-radius:8px;overflow:hidden;max-width:560px;width:100%">

        <!-- Header -->
        <tr><td style="background-color:#C24038;padding:24px 32px">
          <p style="margin:0;font-family:Georgia,serif;font-size:18px;color:#ffffff">Chloe G's Homemade Treats</p>
          <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#ffffff">New Order: ${esc(opts.orderNumber)}${isDelivery ? " 🚗" : ""}</p>
        </td></tr>

        <!-- Customer info -->
        <tr><td style="padding:24px 32px 0;font-family:Arial,Helvetica,sans-serif">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4DEE1;border-radius:6px">
            <tr><td style="padding:16px">
              <p style="margin:0 0 6px;font-size:13px;color:#8a6f5e;letter-spacing:1px;text-transform:uppercase;font-weight:bold">Customer</p>
              <p style="margin:0;font-size:14px;color:#33291f;font-weight:bold">${esc(opts.customerName)}</p>
              <p style="margin:2px 0 0;font-size:13px;color:#8a6f5e">${esc(opts.customerEmail)}</p>
              ${opts.customerPhone ? `<p style="margin:2px 0 0;font-size:13px;color:#8a6f5e">${esc(opts.customerPhone)}</p>` : ""}
            </td></tr>
          </table>
        </td></tr>

        <!-- Fulfillment + payment -->
        <tr><td style="padding:16px 32px 0;font-family:Arial,Helvetica,sans-serif">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding-right:8px;vertical-align:top">
                <p style="margin:0 0 4px;font-size:13px;color:#8a6f5e;letter-spacing:1px;text-transform:uppercase;font-weight:bold">${isDelivery ? "Delivery" : "Pickup"}</p>
                <p style="margin:0;font-size:14px;color:#33291f;font-weight:bold">${fulfillmentLabel}</p>
                ${isDelivery && opts.deliveryAddress ? `<p style="margin:2px 0 0;font-size:13px;color:#8a6f5e">${esc(opts.deliveryAddress)}</p>` : ""}
                ${isDelivery && opts.deliveryUnit ? `<p style="margin:2px 0 0;font-size:14px;color:#C24038;font-weight:bold">${esc(opts.deliveryUnit)}</p>` : ""}
              </td>
              <td width="50%" style="padding-left:8px;vertical-align:top">
                <p style="margin:0 0 4px;font-size:13px;color:#8a6f5e;letter-spacing:1px;text-transform:uppercase;font-weight:bold">Payment</p>
                <p style="margin:0;font-size:14px;color:#33291f;font-weight:bold">${paymentLabel}</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Order items -->
        <tr><td style="padding:20px 32px 0;font-family:Arial,Helvetica,sans-serif">
          <p style="margin:0 0 8px;font-size:13px;color:#8a6f5e;letter-spacing:1px;text-transform:uppercase;font-weight:bold">Items</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${rows}
            ${opts.deliveryFeeCents ? `<tr>
              <td style="padding:8px 0 0;font-size:14px;color:#8a6f5e">Delivery fee</td>
              <td style="padding:8px 0 0;text-align:right;font-size:14px;color:#8a6f5e">${money(opts.deliveryFeeCents)}</td>
            </tr>` : ""}
            ${opts.taxCents ? `<tr>
              <td style="padding:8px 0 0;font-size:14px;color:#8a6f5e">Sales tax</td>
              <td style="padding:8px 0 0;text-align:right;font-size:14px;color:#8a6f5e">${money(opts.taxCents)}</td>
            </tr>` : ""}
            ${opts.tipCents ? `<tr>
              <td style="padding:8px 0 0;font-size:14px;color:#8a6f5e">Tip</td>
              <td style="padding:8px 0 0;text-align:right;font-size:14px;color:#8a6f5e">${money(opts.tipCents)}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:12px 0 0;font-size:15px;font-weight:bold;color:#33291f">Total</td>
              <td style="padding:12px 0 0;text-align:right;font-size:15px;font-weight:bold;color:#C24038">${money(opts.totalCents)}</td>
            </tr>
          </table>
        </td></tr>

        ${opts.specialRequests ? `<tr><td style="padding:20px 32px 0;font-family:Arial,Helvetica,sans-serif">
          <p style="margin:0 0 4px;font-size:13px;color:#8a6f5e;letter-spacing:1px;text-transform:uppercase;font-weight:bold">Special Requests</p>
          <p style="margin:0;font-size:14px;color:#33291f">${esc(opts.specialRequests)}</p>
        </td></tr>` : ""}

        <!-- Footer -->
        <tr><td style="padding:24px 32px;font-family:Arial,Helvetica,sans-serif">
          <p style="margin:0;font-size:12px;color:#8a6f5e">Reply to this email or contact ${esc(opts.customerEmail)} to reach the customer.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</div>`;
}

async function sendEmail(opts: {
  password: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: opts.password },
  });
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  } catch (err) {
    console.error("Gmail send error:", err);
    throw new Error("Failed to send email");
  }
}

interface PaymentRequest {
  sourceId: string;
  /** Client-generated UUID, one per checkout attempt. Doubles as the order doc ID. */
  idempotencyKey: string;
  /** Which Square environment the browser was built for; must match this server. */
  squareMode: 'sandbox' | 'production';
  customer: { name: string; email: string; phone: string };
  pickupDate: string;
  fulfillmentType: 'pickup' | 'delivery';
  deliveryAddress?: string;
  deliveryUnit?: string;
  deliveryTime?: string;
  /** The total the customer saw. Must equal the server-computed total. */
  expectedTotalCents: number;
  tipCents?: number;
  specialRequests?: string;
  wantsEmailConfirmation: boolean;
  cartLines: CartLineRequest[];
}

const TIMEZONE = "America/Chicago";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Today's date in the bakery's timezone as YYYY-MM-DD. */
function todayInBakeryTz(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

async function squareRefund(paymentId: string, amountCents: number, idempotencyKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${squareBaseUrl()}/v2/refunds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${squareAccessToken.value()}`,
        "Square-Version": SQUARE_VERSION,
      },
      body: JSON.stringify({
        idempotency_key: `refund-${idempotencyKey}`,
        payment_id: paymentId,
        amount_money: { amount: amountCents, currency: "USD" },
        reason: "Order could not be saved",
      }),
    });
    if (!res.ok) console.error("Square refund error:", await res.json().catch(() => ({})));
    return res.ok;
  } catch (e) {
    console.error("Square refund threw:", e);
    return false;
  }
}

export const processPayment = onCall(
  { secrets: [squareAccessToken], maxInstances: 10, enforceAppCheck: appCheckEnforce },
  async (request) => {
    const data = request.data as PaymentRequest;

    const name = singleLine(str(data?.customer?.name, 100));
    const email = str(data?.customer?.email, 200);
    const phone = str(data?.customer?.phone, 40);
    const fulfillmentType = data?.fulfillmentType;

    if (
      typeof data?.sourceId !== "string" || !data.sourceId ||
      typeof data?.idempotencyKey !== "string" || !UUID_RE.test(data.idempotencyKey) ||
      !name || !phone || !isValidEmail(email) ||
      (fulfillmentType !== "pickup" && fulfillmentType !== "delivery") ||
      !Array.isArray(data.cartLines) ||
      data.cartLines.length === 0 ||
      data.cartLines.length > MAX_CART_LINES
    ) {
      throw new HttpsError("invalid-argument", "Missing or invalid fields");
    }

    // A half-finished go-live (site flipped but functions not, or the reverse)
    // would otherwise fail with confusing Square auth errors. Fail clearly instead.
    const serverMode = squareEnv.value() === "production" ? "production" : "sandbox";
    if (data.squareMode !== serverMode) {
      console.error(`Square mode mismatch: browser=${data.squareMode} server=${serverMode}`);
      throw new HttpsError(
        "failed-precondition",
        "Payments are being updated. Please refresh the page and try again.",
      );
    }

    const deliveryAddress = str(data.deliveryAddress, 300);
    const deliveryUnit = str(data.deliveryUnit, 60);
    const deliveryTime = str(data.deliveryTime, 20);
    if (fulfillmentType === "delivery" && (!deliveryAddress || !deliveryTime)) {
      throw new HttpsError("invalid-argument", "Delivery address and time are required.");
    }
    const specialRequests = str(data.specialRequests, 1000);

    const db = admin.firestore();
    const orderRef = db.doc(`orders/${data.idempotencyKey.toLowerCase()}`);

    // A retry of an attempt we already completed (e.g. the response was lost):
    // hand back the existing order instead of charging again.
    const existing = await orderRef.get();
    if (existing.exists) {
      return { orderId: orderRef.id, orderNumber: existing.data()?.["orderNumber"] as string };
    }

    const configSnap = await db.doc("config/global").get();
    const config = configSnap.data() ?? {};

    // Pickup/delivery date: must be a real date, past the lead time, not blacked out.
    const pickupMs = Date.parse(String(data.pickupDate));
    if (Number.isNaN(pickupMs)) {
      throw new HttpsError("invalid-argument", "Invalid pickup date.");
    }
    const pickupYmd = new Date(pickupMs).toISOString().slice(0, 10);
    const leadDays = parseLeadDays(config["defaultLeadTimeDays"]);
    const blackouts = ((config["blackoutDates"] ?? []) as admin.firestore.Timestamp[])
      .map((t) => t.toDate().toISOString().slice(0, 10));
    if (!isPickupDateAllowed({ pickupYmd, todayYmd: todayInBakeryTz(), leadDays, blackoutYmds: blackouts })) {
      throw new HttpsError(
        "failed-precondition",
        "That date is no longer available. Please choose another date.",
      );
    }

    // Every price comes from Firestore, never from the client.
    let lines;
    try {
      lines = await priceCart(async (id) => {
        const snap = await db.doc(`menuItems/${id}`).get();
        return snap.exists ? snap.data() : undefined;
      }, data.cartLines);
    } catch (e) {
      if (e instanceof PricingError) throw new HttpsError(e.code, e.message);
      throw e;
    }
    const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);

    // Tax, delivery fee, tip and total: see computeTotals in pricing.ts.
    const {
      deliveryFeeCents,
      taxRatePercent,
      taxCents,
      tipCents,
      totalCents,
    } = computeTotals({
      subtotalCents,
      fulfillmentType,
      taxRatePercent: config["taxRatePercent"],
      tipCents: data.tipCents,
    });

    // The browser already showed the customer a total. If its figure disagrees
    // with ours (menu price edited, tax rate changed mid-session), fail loudly
    // rather than charge an amount they never agreed to.
    const clientExpectedCents = Math.round(Number(data.expectedTotalCents));
    if (!Number.isFinite(clientExpectedCents) || clientExpectedCents !== totalCents) {
      throw new HttpsError(
        "failed-precondition",
        "Prices have changed. Please refresh the page and try again.",
      );
    }

    if (totalCents <= 0) {
      throw new HttpsError("invalid-argument", "Order total must be greater than zero");
    }

    // Charge the card via Square REST API (no SDK needed — Node 24 has fetch built in).
    // The idempotency key is the client's per-attempt UUID, so Square itself
    // refuses to charge the same attempt twice.
    const squareRes = await fetch(`${squareBaseUrl()}/v2/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${squareAccessToken.value()}`,
        "Square-Version": SQUARE_VERSION,
      },
      body: JSON.stringify({
        source_id: data.sourceId,
        idempotency_key: data.idempotencyKey,
        amount_money: { amount: totalCents, currency: "USD" },
        location_id: squareLocationId.value(),
        buyer_email_address: email,
        note: `Chloe G's Treats, ${name}`,
      }),
    });

    if (!squareRes.ok) {
      const err = await squareRes.json().catch(() => ({})) as { errors?: { category?: string; code?: string }[] };
      console.error("Square payment error:", err);
      // Card problems are the customer's to fix; anything else is ours.
      if (err.errors?.[0]?.category === "PAYMENT_METHOD_ERROR") {
        throw new HttpsError("failed-precondition", "Your card was declined. Please check your details or try a different card.");
      }
      throw new HttpsError("internal", "Payment failed. Please try again.");
    }

    const squareData = await squareRes.json() as { payment?: { id?: string } };
    const squarePaymentId = squareData.payment?.id ?? "";

    // Create the Firestore order now that payment succeeded. If this fails the
    // customer has been charged for an order we cannot see, so refund them.
    const orderNumber = `CG-${Math.floor(100000 + Math.random() * 900000)}`;
    const orderFields = {
        orderNumber,
        customer: { name, email, phone },
        isGuest: true,
        items: lines,
        subtotalCents,
        taxCents,
        taxRatePercent,
        totalCents,
        pickupDate: admin.firestore.Timestamp.fromMillis(pickupMs),
        fulfillmentType,
        deliveryAddress: fulfillmentType === "delivery" ? deliveryAddress : null,
        deliveryUnit: fulfillmentType === "delivery" ? deliveryUnit || null : null,
        deliveryTime: fulfillmentType === "delivery" ? deliveryTime : null,
        deliveryFeeCents,
        tipCents,
        specialRequests: specialRequests || null,
        status: "confirmed",
        paymentMethod: "square",
        paymentStatus: "paid",
        squarePaymentId,
        wantsEmailConfirmation: !!data.wantsEmailConfirmation,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const outcome = await saveOrderOrRefund({
      create: () => orderRef.create(orderFields),
      loadExistingOrderNumber: async () =>
        (await orderRef.get()).data()?.["orderNumber"] as string | undefined,
      refund: () => squareRefund(squarePaymentId, totalCents, data.idempotencyKey),
      log: (e) => console.error("Order write failed after successful charge:", e, { squarePaymentId, totalCents }),
    });
    if (outcome.kind === "duplicate") {
      // A concurrent request with the same idempotency key already saved this order.
      return { orderId: orderRef.id, orderNumber: outcome.orderNumber ?? orderNumber };
    }
    if (outcome.kind === "failed") {
      throw new HttpsError(
        "internal",
        outcome.refunded
          ? "We couldn't save your order, and your card has been refunded. Please try again."
          : "We couldn't save your order. Please contact us before trying again; you may have been charged.",
      );
    }

    return { orderId: orderRef.id, orderNumber };
  },
);

/**
 * Confirmation-page lookup. Orders are not readable from the browser (they hold
 * customer PII); the unguessable order ID returned by processPayment is the
 * capability that grants access to exactly that one order.
 */
export const getOrderConfirmation = onCall({ maxInstances: 10 }, async (request) => {
  const orderId = request.data?.orderId;
  if (typeof orderId !== "string" || !UUID_RE.test(orderId)) {
    throw new HttpsError("invalid-argument", "Invalid order.");
  }
  const snap = await admin.firestore().doc(`orders/${orderId.toLowerCase()}`).get();
  const d = snap.data();
  if (!snap.exists || !d) throw new HttpsError("not-found", "Order not found.");

  const toIso = (t: unknown) => (t as admin.firestore.Timestamp | undefined)?.toDate().toISOString() ?? null;
  return {
    orderNumber: d["orderNumber"],
    customer: d["customer"],
    items: d["items"] ?? [],
    subtotalCents: d["subtotalCents"],
    totalCents: d["totalCents"],
    pickupDate: toIso(d["pickupDate"]),
    fulfillmentType: d["fulfillmentType"] ?? "pickup",
    deliveryAddress: d["deliveryAddress"] ?? null,
    deliveryUnit: d["deliveryUnit"] ?? null,
    deliveryTime: d["deliveryTime"] ?? null,
    deliveryFeeCents: d["deliveryFeeCents"] ?? 0,
    taxCents: d["taxCents"] ?? 0,
    taxRatePercent: d["taxRatePercent"] ?? 0,
    tipCents: d["tipCents"] ?? 0,
    specialRequests: d["specialRequests"] ?? null,
    status: d["status"],
    paymentMethod: d["paymentMethod"],
    paymentStatus: d["paymentStatus"],
    wantsEmailConfirmation: d["wantsEmailConfirmation"] ?? false,
    createdAt: toIso(d["createdAt"]),
  };
});

export const onOrderCreated = onDocumentCreated(
  { document: "orders/{orderId}", secrets: [gmailAppPassword] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const password = gmailAppPassword.value().replace(/\s+/g, "");
    const pickupDate = (data["pickupDate"] as admin.firestore.Timestamp).toDate();
    const paymentMethod: string = data["paymentMethod"] ?? "pay_at_pickup";

    // Read owner email + pickup location from Firestore config so changes in
    // the admin Settings screen take effect without a redeploy.
    const db = admin.firestore();
    const configSnap = await db.doc("config/global").get();
    const configData = configSnap.data() ?? {};
    const ownerEmail: string = configData["contactEmail"] ?? "chloegshomemadetreats@gmail.com";
    const pickupLocation: string = configData["pickupLocation"] ?? "Corporate Lake Properties, 4804 John Garry Dr, Columbia, MO";

    const customerName: string = data["customer"]?.["name"] ?? "Customer";
    const customerEmail: string = data["customer"]?.["email"] ?? "";
    const customerPhone: string | undefined = data["customer"]?.["phone"] ?? undefined;
    const orderNumber: string = data["orderNumber"] ?? "";
    const totalCents: number = data["totalCents"] ?? 0;
    const deliveryFeeCents: number = data["deliveryFeeCents"] ?? 0;
    const taxCents: number = data["taxCents"] ?? 0;
    const tipCents: number = data["tipCents"] ?? 0;
    const lines: CartLine[] = (data["items"] ?? []) as CartLine[];
    const specialRequests: string | undefined = data["specialRequests"] ?? undefined;
    const fulfillmentType: string = data["fulfillmentType"] ?? "pickup";
    const deliveryAddress: string | undefined = data["deliveryAddress"] ?? undefined;
    const deliveryUnit: string | undefined = data["deliveryUnit"] ?? undefined;
    const deliveryTime: string | undefined = data["deliveryTime"] ?? undefined;

    // Customer confirmation — only if they opted in. Logged but non-fatal so a
    // failed customer email never blocks the owner notification.
    if (data["wantsEmailConfirmation"] && customerEmail) {
      try {
        await sendEmail({
          password,
          to: customerEmail,
          subject: `Your Chloe G's order ${orderNumber} is confirmed`,
          html: orderEmailHtml({
            name: customerName,
            orderNumber,
            lines,
            totalCents,
            deliveryFeeCents,
            taxCents,
            tipCents,
            pickupDate,
            pickupLocation,
            paymentMethod,
            fulfillmentType,
            deliveryAddress,
            deliveryUnit,
            deliveryTime,
            specialRequests,
          }),
        });
      } catch (err) {
        console.error("Customer confirmation email failed (non-fatal):", err);
      }
    }

    // Owner notification — always attempted. A failure is logged rather than
    // thrown: the order is already saved and paid, and a thrown error here only
    // produces an unread function failure.
    if (ownerEmail) {
      try {
        await sendEmail({
          password,
          to: ownerEmail,
          subject: `New order ${orderNumber}: ${customerName}${fulfillmentType === "delivery" ? " 🚗 DELIVERY" : ""}`,
          html: ownerEmailHtml({
            orderNumber,
            customerName,
            customerEmail,
            customerPhone,
            lines,
            totalCents,
            deliveryFeeCents,
            taxCents,
            tipCents,
            pickupDate,
            paymentMethod,
            paymentStatus: data["paymentStatus"] ?? "unpaid",
            fulfillmentType,
            deliveryAddress,
            deliveryUnit,
            deliveryTime,
            specialRequests,
          }),
        });
      } catch (err) {
        console.error(`OWNER NOTIFICATION FAILED for order ${orderNumber}; check the GMAIL_APP_PASSWORD secret:`, err);
      }
    }
  },
);
