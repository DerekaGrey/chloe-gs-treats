import { describe, expect, it } from 'vitest';
import {
  DELIVERY_FEE_CENTS,
  MAX_TIP_CENTS,
  TIP_PERCENTS,
  computeCheckoutTotals,
  deliveryFeeCentsFor,
  taxCentsFor,
  tipCentsFor,
} from './checkout-totals';

describe('taxCentsFor', () => {
  it('rounds to the nearest cent', () => {
    expect(taxCentsFor(1050, 8.5)).toBe(89); // 89.25
    expect(taxCentsFor(1000, 7.975)).toBe(80); // 79.75
    expect(taxCentsFor(1, 8.5)).toBe(0); // 0.085
  });

  it('is 0 for a zero rate', () => {
    expect(taxCentsFor(5000, 0)).toBe(0);
  });

  it.each([-5, Number.NaN, Infinity, -Infinity])('treats a bad rate (%s) as no tax', (rate) => {
    expect(taxCentsFor(5000, rate)).toBe(0);
  });
});

describe('deliveryFeeCentsFor', () => {
  it('charges the fixed fee for delivery and nothing for pickup', () => {
    expect(deliveryFeeCentsFor('delivery')).toBe(DELIVERY_FEE_CENTS);
    expect(deliveryFeeCentsFor('pickup')).toBe(0);
  });
});

describe('tipCentsFor', () => {
  it('is 0 when no tip is chosen', () => {
    expect(tipCentsFor(2000, null, '')).toBe(0);
    expect(tipCentsFor(2000, null, '12.00')).toBe(0); // typed dollars are ignored unless "custom" is selected
  });

  it('computes a preset as a share of the subtotal, rounded to the cent', () => {
    expect(tipCentsFor(2000, 15, '')).toBe(300);
    expect(tipCentsFor(2000, 20, '')).toBe(400);
    expect(tipCentsFor(1050, 15, '')).toBe(158); // 157.5 rounds up
  });

  it('offers 15%, 18% and 20%', () => {
    expect(TIP_PERCENTS).toEqual([15, 18, 20]);
  });

  describe('custom tip', () => {
    it.each([
      ['3', 300],
      ['3.50', 350],
      ['0.99', 99],
      ['3.456', 346], // 345.6 rounds up
      [' 5 ', 500],
    ])('"%s" is %s cents', (typed, cents) => {
      expect(tipCentsFor(2000, 'custom', typed)).toBe(cents);
    });

    it.each(['', '0', '-5', 'abc', '.', 'Infinity'])('"%s" is no tip', (typed) => {
      expect(tipCentsFor(2000, 'custom', typed)).toBe(0);
    });
  });

  describe('ceiling', () => {
    it('caps a huge custom tip', () => {
      expect(tipCentsFor(2000, 'custom', '99999999')).toBe(MAX_TIP_CENTS);
    });

    it('caps a PRESET tip on a very large order too, as the server does', () => {
      // 20% of $6,000 is $1,200, above the $1,000 ceiling. Before the shared module the
      // client showed $1,200 and the server charged $1,000, so every attempt was refused.
      expect(tipCentsFor(600_000, 20, '')).toBe(MAX_TIP_CENTS);
    });

    it('does not clamp a generous tip on a small order', () => {
      expect(tipCentsFor(100, 'custom', '50')).toBe(5000);
    });
  });
});

describe('computeCheckoutTotals', () => {
  const base = { subtotalCents: 2000, fulfillmentType: 'pickup' as const, taxRatePercent: 0, tipChoice: null, customTipDollars: '' };

  it('with no tax, fee or tip, the total is the subtotal', () => {
    expect(computeCheckoutTotals(base)).toEqual({
      subtotalCents: 2000,
      taxCents: 0,
      deliveryFeeCents: 0,
      tipCents: 0,
      totalCents: 2000,
    });
  });

  it('taxes the food only, and tips on the subtotal only (not on tax or delivery)', () => {
    const t = computeCheckoutTotals({
      subtotalCents: 2000,
      fulfillmentType: 'delivery',
      taxRatePercent: 8.5,
      tipChoice: 15,
      customTipDollars: '',
    });
    expect(t.taxCents).toBe(170); // 8.5% of 2000, not of 2000 + 500
    expect(t.tipCents).toBe(300); // 15% of 2000, not of the delivery-inclusive amount
    expect(t.totalCents).toBe(2000 + 170 + 500 + 300);
  });

  it('matches the hand-worked order used in the server tests', () => {
    const t = computeCheckoutTotals({
      subtotalCents: 7650,
      fulfillmentType: 'delivery',
      taxRatePercent: 8.5,
      tipChoice: 'custom',
      customTipDollars: '3',
    });
    expect(t.totalCents).toBe(7650 + 650 + 500 + 300);
  });
});
