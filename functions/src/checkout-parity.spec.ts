// The customer's browser computes the total it shows; processPayment recomputes it
// on the server and refuses the charge if the two differ. If these ever drift apart,
// EVERY checkout fails with "Prices have changed". This spec compares the two
// implementations over thousands of combinations so a drift fails here instead.
import { describe, expect, it } from "vitest";
import {
  DELIVERY_FEE_CENTS as CLIENT_FEE,
  MAX_TIP_CENTS as CLIENT_MAX_TIP,
  computeCheckoutTotals,
  type TipChoice,
} from "../../src/app/shared/checkout-totals";
import { DELIVERY_FEE_CENTS as SERVER_FEE, MAX_TIP_CENTS as SERVER_MAX_TIP, computeTotals } from "./pricing.js";

describe("client and server totals agree", () => {
  it("use the same delivery fee and tip ceiling", () => {
    expect(CLIENT_FEE).toBe(SERVER_FEE);
    expect(CLIENT_MAX_TIP).toBe(SERVER_MAX_TIP);
  });

  const subtotals = [0, 1, 33, 99, 100, 333, 999, 1000, 1050, 1800, 2999, 3600, 7650, 12345, 99_999, 600_000, 10_000_000];
  const rates = [0, 0.5, 4.225, 5, 7.975, 8.475, 8.5, 10, -1, Number.NaN];
  const types = ["pickup", "delivery"] as const;
  const tips: [TipChoice, string][] = [
    [null, ""],
    [15, ""],
    [18, ""],
    [20, ""],
    ["custom", ""],
    ["custom", "0"],
    ["custom", "1"],
    ["custom", "3"],
    ["custom", "3.456"],
    ["custom", "12.34"],
    ["custom", "99999"],
    ["custom", "-5"],
    ["custom", "abc"],
  ];

  it("produce identical tax, fee, tip and total for every combination", () => {
    let checked = 0;
    for (const subtotalCents of subtotals) {
      for (const taxRatePercent of rates) {
        for (const fulfillmentType of types) {
          for (const [tipChoice, customTipDollars] of tips) {
            const client = computeCheckoutTotals({ subtotalCents, fulfillmentType, taxRatePercent, tipChoice, customTipDollars });
            // The browser sends the tip it computed; the server recomputes everything else.
            const server = computeTotals({ subtotalCents, fulfillmentType, taxRatePercent, tipCents: client.tipCents });
            const where = JSON.stringify({ subtotalCents, taxRatePercent: String(taxRatePercent), fulfillmentType, tipChoice, customTipDollars });
            expect({ where, ...pick(client) }).toEqual({ where, ...pick(server) });
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(subtotals.length * rates.length * types.length * tips.length);
  });
});

const pick = (t: { taxCents: number; deliveryFeeCents: number; tipCents: number; totalCents: number }) => ({
  taxCents: t.taxCents,
  deliveryFeeCents: t.deliveryFeeCents,
  tipCents: t.tipCents,
  totalCents: t.totalCents,
});
