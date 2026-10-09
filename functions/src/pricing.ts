// Pure pricing and checkout-rule logic for processPayment. No Firebase imports:
// everything here is a plain function so it can be unit tested (see pricing.spec.ts).
// index.ts maps PricingError to HttpsError at the edge.

export type PricingErrorCode = "invalid-argument" | "failed-precondition";

export class PricingError extends Error {
  constructor(
    readonly code: PricingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PricingError";
  }
}

// DELIVERY_FEE_CENTS and MAX_TIP_CENTS must match the same-named constants in
// src/app/pages/checkout/checkout.ts, otherwise the total shown to the customer
// would differ from the amount charged. pricing.spec.ts pins both values.
export const DELIVERY_FEE_CENTS = 500;
export const MAX_TIP_CENTS = 100_000;
export const MAX_PACKS_PER_LINE = 100;
export const MAX_CART_LINES = 50;

/** What the browser is allowed to say about a line: which item, pack and options. */
export interface CartLineRequest {
  menuItemId: string;
  packLabel: string;
  packCount: number;
  selectedOptions?: { groupName: string; optionLabel: string }[];
}

// A type alias (not an interface) so it stays assignable to index.ts's loose CartLine.
export type PricedLine = {
  menuItemId: string;
  nameSnapshot: string;
  packLabelSnapshot: string;
  packQuantity: number;
  packPriceCentsSnapshot: number;
  packCount: number;
  selectedOptions: { groupName: string; optionLabel: string; priceCentsDelta: number }[];
  lineTotalCents: number;
};

/** Returns the menu item's stored data, or undefined if there is no such item. */
export type ItemLookup = (menuItemId: string) => Promise<Record<string, unknown> | undefined>;

/**
 * Prices every line from the menu data. The client only says WHICH item, pack and
 * options it wants; any price, name or total it sends is ignored.
 */
export async function priceCart(lookup: ItemLookup, requested: CartLineRequest[]): Promise<PricedLine[]> {
  const lines: PricedLine[] = [];

  for (const req of requested) {
    const packCount = Number(req?.packCount);
    if (
      typeof req?.menuItemId !== "string" || !req.menuItemId || req.menuItemId.includes("/") ||
      !Number.isInteger(packCount) || packCount < 1 || packCount > MAX_PACKS_PER_LINE
    ) {
      throw new PricingError("invalid-argument", "Invalid cart.");
    }

    const item = await lookup(req.menuItemId);
    if (!item || item["available"] === false) {
      throw new PricingError(
        "failed-precondition",
        "An item in your cart is no longer available. Please refresh and review your cart.",
      );
    }

    const pack = ((item["packPricing"] ?? []) as { label: string; quantity: number; priceCents: number }[])
      .find((p) => p.label === req.packLabel);
    if (!pack) {
      throw new PricingError(
        "failed-precondition",
        "An item in your cart has changed. Please refresh and review your cart.",
      );
    }

    // Each option group allows one choice; required groups must have one.
    const groups = (item["optionGroups"] ?? []) as {
      name: string;
      required: boolean;
      options: { label: string; priceCentsDelta: number }[];
    }[];
    const chosen = req.selectedOptions ?? [];
    if (!Array.isArray(chosen)) throw new PricingError("invalid-argument", "Invalid cart.");

    const selectedOptions: PricedLine["selectedOptions"] = [];
    for (const group of groups) {
      const picks = chosen.filter((c) => c?.groupName === group.name);
      if (picks.length > 1 || (group.required && picks.length === 0)) {
        throw new PricingError("failed-precondition", "Please review the options on your cart items.");
      }
      if (picks.length === 1) {
        const opt = group.options.find((o) => o.label === picks[0].optionLabel);
        if (!opt) {
          throw new PricingError("failed-precondition", "Please review the options on your cart items.");
        }
        selectedOptions.push({
          groupName: group.name,
          optionLabel: opt.label,
          priceCentsDelta: opt.priceCentsDelta ?? 0,
        });
      }
    }
    // Anything chosen that matched no group means the cart is stale or tampered.
    if (chosen.length !== selectedOptions.length) {
      throw new PricingError("failed-precondition", "Please review the options on your cart items.");
    }

    const optionDelta = selectedOptions.reduce((s, o) => s + o.priceCentsDelta, 0);
    lines.push({
      menuItemId: req.menuItemId,
      nameSnapshot: String(item["name"]),
      packLabelSnapshot: pack.label,
      packQuantity: pack.quantity,
      packPriceCentsSnapshot: pack.priceCents,
      packCount,
      selectedOptions,
      lineTotalCents: packCount * (pack.priceCents + optionDelta),
    });
  }

  return lines;
}

export interface Totals {
  subtotalCents: number;
  deliveryFeeCents: number;
  taxRatePercent: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
}

/**
 * Subtotal -> tax, delivery fee, tip and total.
 * Tax applies to the food only: not the delivery fee, and never the tip.
 * The tip is the customer's choice so it cannot be recomputed, but it is
 * sanitised: non-numbers become 0, negatives are floored at 0 so a tip can never
 * reduce the charge, and a flat ceiling applies (not a multiple of the subtotal,
 * so a generous tip on a small order is never silently clamped).
 */
export function computeTotals(input: {
  subtotalCents: number;
  fulfillmentType: "pickup" | "delivery";
  taxRatePercent: unknown;
  tipCents: unknown;
}): Totals {
  const { subtotalCents, fulfillmentType } = input;
  const deliveryFeeCents = fulfillmentType === "delivery" ? DELIVERY_FEE_CENTS : 0;

  const rawRate = Number(input.taxRatePercent ?? 0);
  const taxRatePercent = Number.isFinite(rawRate) && rawRate > 0 ? rawRate : 0;
  const taxCents = Math.round((subtotalCents * taxRatePercent) / 100);

  const rawTip = Number(input.tipCents ?? 0);
  const tipCents = Number.isFinite(rawTip)
    ? Math.min(Math.max(Math.round(rawTip), 0), MAX_TIP_CENTS)
    : 0;

  return {
    subtotalCents,
    deliveryFeeCents,
    taxRatePercent,
    taxCents,
    tipCents,
    totalCents: subtotalCents + taxCents + deliveryFeeCents + tipCents,
  };
}

/** YYYY-MM-DD plus a number of days (calendar arithmetic in UTC, so no DST surprises). */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Lead time from config; falls back to 3 days when missing or not a number. */
export function parseLeadDays(raw: unknown): number {
  const n = Number(raw ?? 3);
  return Number.isFinite(n) ? n : 3;
}

/** A pickup/delivery date must be at least the lead time away and not blacked out. */
export function isPickupDateAllowed(input: {
  pickupYmd: string;
  todayYmd: string;
  leadDays: number;
  blackoutYmds: string[];
}): boolean {
  return (
    input.pickupYmd >= addDays(input.todayYmd, input.leadDays) &&
    !input.blackoutYmds.includes(input.pickupYmd)
  );
}
