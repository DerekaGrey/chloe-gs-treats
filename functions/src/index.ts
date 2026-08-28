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
  pickupDate: Date;
  pickupLocation: string;
  paymentMethod: string;
  specialRequests?: string;
}): string {
  const rows = opts.lines
    .map((l) => {
      const optLines = (l.selectedOptions ?? [])
        .map((o) => `<div style="color:#777;font-size:12px">${esc(o.groupName)}: ${esc(o.optionLabel)}</div>`)
        .join("");
      return `<tr>
        <td style="padding:6px 0">${l.packCount} × ${esc(l.nameSnapshot)} (pack of ${esc(l.packLabelSnapshot)})${optLines}</td>
        <td style="padding:6px 0;text-align:right">${money(l.lineTotalCents)}</td>
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
    ? "<p style=\"color:#777;font-size:12px;margin-top:24px\">Nothing to pay at pickup — your card has already been charged.</p>"
    : "<p style=\"margin-top:20px\"><strong>Payment:</strong> Pay via Venmo or cash when you pick up your order.</p>";

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#33291f">
    <h2 style="color:#b03a2e">Thank you, ${esc(opts.name)}!</h2>
    <p>Your order has been placed. Here are the details:</p>
    <p><strong>Order ${esc(opts.orderNumber)}</strong></p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows}
      <tr><td style="border-top:1px solid #ddd;padding-top:8px"><strong>Total</strong></td>
          <td style="border-top:1px solid #ddd;padding-top:8px;text-align:right"><strong>${money(opts.totalCents)}</strong></td></tr>
    </table>
    <p style="margin-top:20px"><strong>Pickup:</strong> ${pickup}<br>${esc(opts.pickupLocation)}</p>
    ${opts.specialRequests ? `<p><strong>Special requests:</strong> ${esc(opts.specialRequests)}</p>` : ""}
    ${paymentNote}
    <p style="color:#777;font-size:12px;margin-top:24px">
      This product is prepared in a kitchen not subject to inspection by the Missouri Department of Health and Senior Services.
    </p>
  </div>`;
}

function ownerEmailHtml(opts: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  lines: CartLine[];
  totalCents: number;
  pickupDate: Date;
  paymentMethod: string;
  paymentStatus: string;
  specialRequests?: string;
}): string {
  const rows = opts.lines
    .map((l) => {
      const optLines = (l.selectedOptions ?? [])
        .map((o) => `${esc(o.groupName)}: ${esc(o.optionLabel)}`)
        .join(", ");
      return `<tr>
        <td style="padding:4px 8px 4px 0">${l.packCount} × ${esc(l.nameSnapshot)} (pack of ${esc(l.packLabelSnapshot)})${optLines ? ` — ${optLines}` : ""}</td>
        <td style="padding:4px 0;text-align:right">${money(l.lineTotalCents)}</td>
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

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:580px;margin:0 auto;color:#33291f">
    <h2 style="color:#b03a2e">New order — ${esc(opts.orderNumber)}</h2>
    <p><strong>Customer:</strong> ${esc(opts.customerName)}<br>
       <strong>Email:</strong> ${esc(opts.customerEmail)}<br>
       ${opts.customerPhone ? `<strong>Phone:</strong> ${esc(opts.customerPhone)}<br>` : ""}
       <strong>Pickup:</strong> ${pickup}<br>
       <strong>Payment:</strong> ${paymentLabel}
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows}
      <tr><td style="border-top:1px solid #ddd;padding-top:8px"><strong>Total</strong></td>
          <td style="border-top:1px solid #ddd;padding-top:8px;text-align:right"><strong>${money(opts.totalCents)}</strong></td></tr>
    </table>
    ${opts.specialRequests ? `<p style="margin-top:16px"><strong>Special requests:</strong> ${esc(opts.specialRequests)}</p>` : ""}
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

    if (subtotalCents <= 0) {
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
        amount_money: { amount: subtotalCents, currency: "USD" },
        location_id: LOCATION_ID,
        buyer_email_address: data.customer.email,
        note: `Chloe G's Treats — ${data.customer.name}`,
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
    const db = admin.firestore();
    const orderNumber = `CG-${Math.floor(1000 + Math.random() * 9000)}`;

    await db.collection("orders").add({
      orderNumber,
      customer: data.customer,
      isGuest: true,
      items: data.cartLines,
      subtotalCents,
      totalCents: subtotalCents,
      pickupDate: admin.firestore.Timestamp.fromDate(new Date(data.pickupDate)),
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
    const lines: CartLine[] = (data["items"] ?? []) as CartLine[];
    const specialRequests: string | undefined = data["specialRequests"] ?? undefined;

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
            pickupDate,
            pickupLocation,
            paymentMethod,
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
        subject: `New order ${orderNumber} — ${customerName}`,
        html: ownerEmailHtml({
          orderNumber,
          customerName,
          customerEmail,
          customerPhone,
          lines,
          totalCents,
          pickupDate,
          paymentMethod,
          paymentStatus: data["paymentStatus"] ?? "unpaid",
          specialRequests,
        }),
      });
    }
  },
);
