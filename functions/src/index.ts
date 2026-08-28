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
import { defineSecret } from "firebase-functions/params";
import { randomUUID } from "crypto";
import * as admin from "firebase-admin";

admin.initializeApp();

const squareAccessToken = defineSecret("SQUARE_ACCESS_TOKEN");
const resendApiKey = defineSecret("RESEND_API_KEY");

// Update FROM_EMAIL once you verify a domain with Resend.
// Until then, Resend only delivers to your own verified address (owner notifications
// will work; customer emails need a verified domain).
const FROM_EMAIL = "Chloe G's Homemade Treats <onboarding@resend.dev>";

// Sandbox base URL — change to https://connect.squareup.com when going live
const SQUARE_BASE_URL = "https://connect.squareupsandbox.com";
const LOCATION_ID = "LZDNJQW0XEQV1";

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
  apiKey: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error("Resend error:", body);
    throw new Error("Failed to send email");
  }
}

interface PaymentRequest {
  sourceId: string;
  customer: { name: string; email: string; phone: string };
  pickupDate: string;
  fulfillmentType: 'pickup' | 'delivery';
  deliveryAddress?: string;
  deliveryUnit?: string;
  deliveryTime?: string;
  deliveryFeeCents: number;
  taxCents?: number;
  tipCents?: number;
  specialRequests?: string;
  wantsEmailConfirmation: boolean;
  cartLines: CartLine[];
}

export const processPayment = onCall(
  { secrets: [squareAccessToken], maxInstances: 10 },
  async (request) => {
    const data = request.data as PaymentRequest;

    if (
      !data.sourceId ||
      !data.customer?.name ||
      !data.customer?.email ||
      !data.customer?.phone ||
      !data.pickupDate ||
      !Array.isArray(data.cartLines) ||
      data.cartLines.length === 0
    ) {
      throw new HttpsError("invalid-argument", "Missing required fields");
    }

    const subtotalCents = data.cartLines.reduce(
      (sum, line) => sum + line.lineTotalCents,
      0,
    );
    const deliveryFeeCents = data.fulfillmentType === "delivery" ? (data.deliveryFeeCents ?? 500) : 0;

    const db = admin.firestore();

    // The tax rate comes from Firestore, never from the client. Tax applies to
    // the food only: not the delivery fee, and never the tip.
    const configSnap = await db.doc("config/global").get();
    const rawRate = Number(configSnap.data()?.["taxRatePercent"] ?? 0);
    const taxRatePercent = Number.isFinite(rawRate) && rawRate > 0 ? rawRate : 0;
    const taxCents = Math.round((subtotalCents * taxRatePercent) / 100);

    // The browser already showed the customer a total. If its tax figure
    // disagrees with ours, its config is stale (the rate changed mid-session),
    // so fail loudly rather than charge an amount they never agreed to.
    const clientTaxCents = Math.round(Number(data.taxCents ?? 0));
    if (clientTaxCents !== taxCents) {
      throw new HttpsError(
        "failed-precondition",
        "Prices have changed. Please refresh the page and try again.",
      );
    }

    // The tip is the customer's choice so it cannot be recomputed server-side,
    // but it still has to be sanitised: reject non-numbers and floor at zero so
    // a negative value can never reduce the charge.
    //
    // The ceiling is a flat amount rather than a multiple of the subtotal. A
    // ratio would clamp a generous tip on a small order, and since the client
    // shows the total before this runs, clamping would charge an amount the
    // customer never agreed to. This value must match MAX_TIP_CENTS in checkout.ts.
    const MAX_TIP_CENTS = 100_000;
    const rawTip = Number(data.tipCents ?? 0);
    const tipCents = Number.isFinite(rawTip)
      ? Math.min(Math.max(Math.round(rawTip), 0), MAX_TIP_CENTS)
      : 0;

    const totalCents = subtotalCents + taxCents + deliveryFeeCents + tipCents;

    if (totalCents <= 0) {
      throw new HttpsError("invalid-argument", "Order total must be greater than zero");
    }

    // Charge the card via Square REST API (no SDK needed — Node 24 has fetch built in)
    const squareRes = await fetch(`${SQUARE_BASE_URL}/v2/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${squareAccessToken.value()}`,
        "Square-Version": "2025-07-16",
      },
      body: JSON.stringify({
        source_id: data.sourceId,
        idempotency_key: randomUUID(),
        amount_money: { amount: totalCents, currency: "USD" },
        location_id: LOCATION_ID,
        buyer_email_address: data.customer.email,
        note: `Chloe G's Treats, ${data.customer.name}`,
      }),
    });

    if (!squareRes.ok) {
      const err = await squareRes.json().catch(() => ({}));
      console.error("Square payment error:", err);
      throw new HttpsError("internal", "Payment failed. Please try again.");
    }

    const squareData = await squareRes.json() as { payment?: { id?: string } };
    const squarePaymentId = squareData.payment?.id ?? "";

    // Create the Firestore order now that payment succeeded
    const orderNumber = `CG-${Math.floor(1000 + Math.random() * 9000)}`;

    await db.collection("orders").add({
      orderNumber,
      customer: data.customer,
      isGuest: true,
      items: data.cartLines,
      subtotalCents,
      taxCents,
      taxRatePercent,
      totalCents,
      pickupDate: admin.firestore.Timestamp.fromDate(new Date(data.pickupDate)),
      fulfillmentType: data.fulfillmentType ?? "pickup",
      deliveryAddress: data.deliveryAddress ?? null,
      deliveryUnit: data.deliveryUnit ?? null,
      deliveryTime: data.deliveryTime ?? null,
      deliveryFeeCents,
      tipCents,
      specialRequests: data.specialRequests ?? null,
      status: "confirmed",
      paymentMethod: "square",
      paymentStatus: "paid",
      squarePaymentId,
      wantsEmailConfirmation: !!data.wantsEmailConfirmation,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { orderNumber };
  },
);

export const onOrderCreated = onDocumentCreated(
  { document: "orders/{orderId}", secrets: [resendApiKey] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const apiKey = resendApiKey.value();
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
    const taxCents: number = data["taxCents"] ?? 0;
    const tipCents: number = data["tipCents"] ?? 0;
    const lines: CartLine[] = (data["items"] ?? []) as CartLine[];
    const specialRequests: string | undefined = data["specialRequests"] ?? undefined;
    const fulfillmentType: string = data["fulfillmentType"] ?? "pickup";
    const deliveryAddress: string | undefined = data["deliveryAddress"] ?? undefined;
    const deliveryUnit: string | undefined = data["deliveryUnit"] ?? undefined;
    const deliveryTime: string | undefined = data["deliveryTime"] ?? undefined;

    // Customer confirmation — only if they opted in. Logged but non-fatal so a
    // Resend sandbox rejection never blocks the owner notification.
    if (data["wantsEmailConfirmation"] && customerEmail) {
      try {
        await sendEmail({
          apiKey,
          to: customerEmail,
          subject: `Your Chloe G's order ${orderNumber} is confirmed`,
          html: orderEmailHtml({
            name: customerName,
            orderNumber,
            lines,
            totalCents,
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

    // Owner notification — always send
    if (ownerEmail) {
      await sendEmail({
        apiKey,
        to: ownerEmail,
        subject: `New order ${orderNumber}: ${customerName}${fulfillmentType === "delivery" ? " 🚗 DELIVERY" : ""}`,
        html: ownerEmailHtml({
          orderNumber,
          customerName,
          customerEmail,
          customerPhone,
          lines,
          totalCents,
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
    }
  },
);
