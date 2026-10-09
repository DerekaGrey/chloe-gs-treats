// The totals the customer sees at checkout: tax, delivery fee, tip and the amount
// charged. Pure functions with no Angular or Firebase imports, so they can be unit
// tested and compared against the server's rules.
//
// processPayment recomputes all of this on the server (functions/src/pricing.ts)
// and refuses the charge if the totals disagree, so these rules MUST match it:
// functions/src/checkout-parity.spec.ts checks that automatically.

export const DELIVERY_FEE_CENTS = 500;

/** Flat ceiling on a tip. A flat amount (not a share of the subtotal) so a generous tip on a small order is never clamped. */
export const MAX_TIP_CENTS = 100_000;

// Tips are calculated on the subtotal only. The delivery fee already covers
// the trip, so tipping on top of it would be double-charging for the same thing.
export const TIP_PERCENTS = [15, 18, 20];

/** A preset percentage, 'custom' (typed-in dollars), or null for no tip. */
export type TipChoice = number | 'custom' | null;

export type FulfillmentType = 'pickup' | 'delivery';

/** Tax on the food only: not the delivery fee, and never the tip. A bad rate means no tax. */
export function taxCentsFor(subtotalCents: number, taxRatePercent: number): number {
  const rate = Number.isFinite(taxRatePercent) && taxRatePercent > 0 ? taxRatePercent : 0;
  return Math.round((subtotalCents * rate) / 100);
}

export function deliveryFeeCentsFor(fulfillmentType: FulfillmentType): number {
  return fulfillmentType === 'delivery' ? DELIVERY_FEE_CENTS : 0;
}

/** The tip in cents for the customer's choice. Never negative, never above the ceiling. */
export function tipCentsFor(subtotalCents: number, choice: TipChoice, customTipDollars: string): number {
  let cents = 0;
  if (choice === 'custom') {
    const dollars = parseFloat(customTipDollars);
    cents = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0;
  } else if (choice !== null) {
    cents = Math.round((subtotalCents * choice) / 100);
  }
  return Math.min(Math.max(cents, 0), MAX_TIP_CENTS);
}

export interface CheckoutTotals {
  subtotalCents: number;
  taxCents: number;
  deliveryFeeCents: number;
  tipCents: number;
  totalCents: number;
}

export function computeCheckoutTotals(input: {
  subtotalCents: number;
  fulfillmentType: FulfillmentType;
  taxRatePercent: number;
  tipChoice: TipChoice;
  customTipDollars: string;
}): CheckoutTotals {
  const { subtotalCents } = input;
  const taxCents = taxCentsFor(subtotalCents, input.taxRatePercent);
  const deliveryFeeCents = deliveryFeeCentsFor(input.fulfillmentType);
  const tipCents = tipCentsFor(subtotalCents, input.tipChoice, input.customTipDollars);
  return {
    subtotalCents,
    taxCents,
    deliveryFeeCents,
    tipCents,
    totalCents: subtotalCents + taxCents + deliveryFeeCents + tipCents,
  };
}
