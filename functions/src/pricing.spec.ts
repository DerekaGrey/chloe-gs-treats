import { describe, it, expect } from "vitest";
import {
  DELIVERY_FEE_CENTS,
  MAX_CART_LINES,
  MAX_PACKS_PER_LINE,
  MAX_TIP_CENTS,
  PricingError,
  addDays,
  computeTotals,
  isPickupDateAllowed,
  parseLeadDays,
  priceCart,
  type ItemLookup,
} from "./pricing.js";

// A menu like the real one: pack tiers, one required option group (icing, with a
// paid choice) and one optional group.
const MENU: Record<string, Record<string, unknown>> = {
  cookies: {
    name: "Brown Butter Cookies",
    available: true,
    packPricing: [
      { label: "6", quantity: 6, priceCents: 1000 },
      { label: "12", quantity: 12, priceCents: 1800 },
    ],
  },
  scones: {
    name: "Carrot Cake Scones",
    available: true,
    packPricing: [{ label: "4", quantity: 4, priceCents: 1200 }],
    optionGroups: [
      {
        name: "Icing",
        required: true,
        options: [
          { label: "Cream Cheese", priceCentsDelta: 0 },
          { label: "Maple", priceCentsDelta: 150 },
        ],
      },
      {
        name: "Drizzle",
        required: false,
        options: [{ label: "Caramel", priceCentsDelta: 100 }],
      },
    ],
  },
  hidden: {
    name: "Retired Item",
    available: false,
    packPricing: [{ label: "1", quantity: 1, priceCents: 500 }],
  },
};

const lookup: ItemLookup = async (id) => MENU[id];

const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as PricingError;
  }
  throw new Error("expected priceCart to reject, but it resolved");
};

describe("priceCart", () => {
  it("prices a pack from the menu: pack price x pack count", async () => {
    const [line] = await priceCart(lookup, [{ menuItemId: "cookies", packLabel: "12", packCount: 2 }]);
    expect(line.packPriceCentsSnapshot).toBe(1800);
    expect(line.packQuantity).toBe(12);
    expect(line.lineTotalCents).toBe(3600);
  });

  it("adds a paid option's price to every pack in the line", async () => {
    const [line] = await priceCart(lookup, [
      { menuItemId: "scones", packLabel: "4", packCount: 3, selectedOptions: [{ groupName: "Icing", optionLabel: "Maple" }] },
    ]);
    // 3 packs x (1200 + 150)
    expect(line.lineTotalCents).toBe(4050);
    expect(line.selectedOptions).toEqual([{ groupName: "Icing", optionLabel: "Maple", priceCentsDelta: 150 }]);
  });

  it("sums the deltas of several option groups", async () => {
    const [line] = await priceCart(lookup, [
      {
        menuItemId: "scones",
        packLabel: "4",
        packCount: 1,
        selectedOptions: [
          { groupName: "Icing", optionLabel: "Maple" },
          { groupName: "Drizzle", optionLabel: "Caramel" },
        ],
      },
    ]);
    expect(line.lineTotalCents).toBe(1200 + 150 + 100);
  });

  it("takes the name and price from the menu and ignores anything else the client sends", async () => {
    const tampered = {
      menuItemId: "cookies",
      packLabel: "6",
      packCount: 1,
      // none of these are part of the request contract; they must have no effect
      lineTotalCents: 1,
      packPriceCentsSnapshot: 1,
      nameSnapshot: "Free Cookies",
      priceCents: 1,
    } as never;
    const [line] = await priceCart(lookup, [tampered]);
    expect(line.lineTotalCents).toBe(1000);
    expect(line.nameSnapshot).toBe("Brown Butter Cookies");
    expect(line.packPriceCentsSnapshot).toBe(1000);
  });

  it("prices several lines independently, in order", async () => {
    const lines = await priceCart(lookup, [
      { menuItemId: "cookies", packLabel: "6", packCount: 1 },
      { menuItemId: "scones", packLabel: "4", packCount: 2, selectedOptions: [{ groupName: "Icing", optionLabel: "Cream Cheese" }] },
    ]);
    expect(lines.map((l) => l.lineTotalCents)).toEqual([1000, 2400]);
  });

  it("treats a missing option delta as free", async () => {
    const noDelta: ItemLookup = async () => ({
      name: "X",
      packPricing: [{ label: "1", quantity: 1, priceCents: 700 }],
      optionGroups: [{ name: "G", required: true, options: [{ label: "A" }] }],
    });
    const [line] = await priceCart(noDelta, [
      { menuItemId: "x", packLabel: "1", packCount: 1, selectedOptions: [{ groupName: "G", optionLabel: "A" }] },
    ]);
    expect(line.lineTotalCents).toBe(700);
  });

  describe("rejects a cart that does not match the menu", () => {
    it("unknown item", async () => {
      const e = await failure(priceCart(lookup, [{ menuItemId: "nope", packLabel: "6", packCount: 1 }]));
      expect(e).toBeInstanceOf(PricingError);
      expect(e.code).toBe("failed-precondition");
    });

    it("an item that is no longer available", async () => {
      const e = await failure(priceCart(lookup, [{ menuItemId: "hidden", packLabel: "1", packCount: 1 }]));
      expect(e.code).toBe("failed-precondition");
    });

    it("a pack size the item does not sell", async () => {
      const e = await failure(priceCart(lookup, [{ menuItemId: "cookies", packLabel: "24", packCount: 1 }]));
      expect(e.code).toBe("failed-precondition");
    });

    it("a missing required option", async () => {
      const e = await failure(priceCart(lookup, [{ menuItemId: "scones", packLabel: "4", packCount: 1 }]));
      expect(e.code).toBe("failed-precondition");
    });

    it("two choices in the same group", async () => {
      const e = await failure(
        priceCart(lookup, [
          {
            menuItemId: "scones",
            packLabel: "4",
            packCount: 1,
            selectedOptions: [
              { groupName: "Icing", optionLabel: "Maple" },
              { groupName: "Icing", optionLabel: "Cream Cheese" },
            ],
          },
        ]),
      );
      expect(e.code).toBe("failed-precondition");
    });

    it("an option label the group does not offer", async () => {
      const e = await failure(
        priceCart(lookup, [
          { menuItemId: "scones", packLabel: "4", packCount: 1, selectedOptions: [{ groupName: "Icing", optionLabel: "Free Icing" }] },
        ]),
      );
      expect(e.code).toBe("failed-precondition");
    });

    it("an option for a group that does not exist (stale or tampered cart)", async () => {
      const e = await failure(
        priceCart(lookup, [
          {
            menuItemId: "scones",
            packLabel: "4",
            packCount: 1,
            selectedOptions: [
              { groupName: "Icing", optionLabel: "Maple" },
              { groupName: "Secret Discount", optionLabel: "-100%" },
            ],
          },
        ]),
      );
      expect(e.code).toBe("failed-precondition");
    });

    it("an option on an item that has no option groups", async () => {
      const e = await failure(
        priceCart(lookup, [
          { menuItemId: "cookies", packLabel: "6", packCount: 1, selectedOptions: [{ groupName: "Extra", optionLabel: "Free" }] },
        ]),
      );
      expect(e.code).toBe("failed-precondition");
    });
  });

  describe("rejects a malformed request", () => {
    const bad = (req: Record<string, unknown>) =>
      failure(priceCart(lookup, [{ menuItemId: "cookies", packLabel: "6", packCount: 1, ...req } as never]));

    it.each([0, -1, 1.5, MAX_PACKS_PER_LINE + 1, Number.NaN, "abc", null, undefined])(
      "pack count %s",
      async (packCount) => {
        const e = await bad({ packCount });
        expect(e.code).toBe("invalid-argument");
      },
    );

    it("accepts the largest allowed pack count", async () => {
      const [line] = await priceCart(lookup, [{ menuItemId: "cookies", packLabel: "6", packCount: MAX_PACKS_PER_LINE }]);
      expect(line.lineTotalCents).toBe(1000 * MAX_PACKS_PER_LINE);
    });

    it.each(["", ".", "..", "a/b", "../config/global", "a".repeat(65), 42, null])("menu item id %j", async (menuItemId) => {
      const e = await bad({ menuItemId });
      expect(e.code).toBe("invalid-argument");
    });

    it("selectedOptions that is not a list", async () => {
      const e = await bad({ selectedOptions: "Maple" });
      expect(e.code).toBe("invalid-argument");
    });
  });
});

describe("computeTotals", () => {
  const base = { subtotalCents: 2000, fulfillmentType: "pickup" as const, taxRatePercent: 0, tipCents: 0 };

  it("with no tax, fee or tip, the total is the subtotal", () => {
    expect(computeTotals(base)).toMatchObject({ taxCents: 0, deliveryFeeCents: 0, tipCents: 0, totalCents: 2000 });
  });

  it("pickup has no delivery fee; delivery adds exactly the fixed fee", () => {
    expect(computeTotals(base).deliveryFeeCents).toBe(0);
    const delivery = computeTotals({ ...base, fulfillmentType: "delivery" });
    expect(delivery.deliveryFeeCents).toBe(DELIVERY_FEE_CENTS);
    expect(delivery.totalCents).toBe(2000 + DELIVERY_FEE_CENTS);
  });

  it("taxes the food only, never the delivery fee or the tip", () => {
    const t = computeTotals({ subtotalCents: 2000, fulfillmentType: "delivery", taxRatePercent: 8.5, tipCents: 300 });
    expect(t.taxCents).toBe(170); // 8.5% of 2000, not of 2000 + 500 + 300
    expect(t.totalCents).toBe(2000 + 170 + 500 + 300);
  });

  it("rounds tax to the nearest cent", () => {
    expect(computeTotals({ ...base, subtotalCents: 1050, taxRatePercent: 8.5 }).taxCents).toBe(89); // 89.25
    expect(computeTotals({ ...base, subtotalCents: 1000, taxRatePercent: 7.975 }).taxCents).toBe(80); // 79.75
    expect(computeTotals({ ...base, subtotalCents: 1, taxRatePercent: 8.5 }).taxCents).toBe(0); // 0.085
  });

  it.each([undefined, null, -5, 0, "abc", Number.NaN, Infinity])("treats tax rate %s as no tax", (taxRatePercent) => {
    expect(computeTotals({ ...base, taxRatePercent }).taxCents).toBe(0);
  });

  it("accepts a tax rate stored as a string, as config sometimes is", () => {
    expect(computeTotals({ ...base, taxRatePercent: "8.5" }).taxCents).toBe(170);
  });

  describe("tip", () => {
    it("is passed through when valid, rounded to a whole cent", () => {
      expect(computeTotals({ ...base, tipCents: 300 }).tipCents).toBe(300);
      expect(computeTotals({ ...base, tipCents: 150.6 }).tipCents).toBe(151);
    });

    it("can never reduce the charge: negatives become 0", () => {
      const t = computeTotals({ ...base, tipCents: -500 });
      expect(t.tipCents).toBe(0);
      expect(t.totalCents).toBe(2000);
    });

    it.each([undefined, null, "abc", Number.NaN, Infinity, -Infinity])("treats %s as no tip", (tipCents) => {
      expect(computeTotals({ ...base, tipCents }).tipCents).toBe(0);
    });

    it("is capped at a flat ceiling, not a share of the subtotal", () => {
      expect(computeTotals({ ...base, tipCents: MAX_TIP_CENTS }).tipCents).toBe(MAX_TIP_CENTS);
      expect(computeTotals({ ...base, tipCents: MAX_TIP_CENTS + 1 }).tipCents).toBe(MAX_TIP_CENTS);
      // a generous tip on a tiny order is NOT clamped to a multiple of the subtotal
      expect(computeTotals({ ...base, subtotalCents: 100, tipCents: 5000 }).tipCents).toBe(5000);
    });
  });

  it("matches a hand-worked order: 2 x $18 + maple scones, delivered, 8.5% tax, $3 tip", () => {
    const subtotal = 3600 + 4050; // from the priceCart examples above
    const t = computeTotals({ subtotalCents: subtotal, fulfillmentType: "delivery", taxRatePercent: 8.5, tipCents: 300 });
    expect(t.taxCents).toBe(650); // 7650 x 8.5% = 650.25
    expect(t.totalCents).toBe(7650 + 650 + 500 + 300);
  });

  // These two values are duplicated in src/app/shared/checkout-totals.ts.
  // checkout-parity.spec.ts fails if the two copies disagree; this test also pins the
  // current values so an intentional change is a deliberate, reviewed edit.
  it("pins the delivery fee and tip ceiling that the browser also uses", () => {
    expect(DELIVERY_FEE_CENTS).toBe(500);
    expect(MAX_TIP_CENTS).toBe(100_000);
  });

  it("keeps the cart limits the payment function enforces", () => {
    expect(MAX_CART_LINES).toBe(50);
    expect(MAX_PACKS_PER_LINE).toBe(100);
  });
});

describe("pickup date rules", () => {
  it("addDays handles month, year and leap-day rollover", () => {
    expect(addDays("2026-10-09", 3)).toBe("2026-10-12");
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-02-27", 2)).toBe("2028-02-29");
    expect(addDays("2027-02-27", 2)).toBe("2027-03-01");
    expect(addDays("2026-10-09", 0)).toBe("2026-10-09");
  });

  it("addDays is unaffected by daylight-saving changes", () => {
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09"); // US spring-forward is 8 Mar 2026
    expect(addDays("2026-10-31", 2)).toBe("2026-11-02"); // US fall-back is 1 Nov 2026
  });

  const rule = (pickupYmd: string, extra: Partial<Parameters<typeof isPickupDateAllowed>[0]> = {}) =>
    isPickupDateAllowed({ pickupYmd, todayYmd: "2026-10-09", leadDays: 3, blackoutYmds: [], ...extra });

  it("allows exactly the lead time away and anything later", () => {
    expect(rule("2026-10-12")).toBe(true);
    expect(rule("2026-10-13")).toBe(true);
    expect(rule("2027-01-01")).toBe(true);
  });

  it("refuses today, the past, and anything inside the lead time", () => {
    expect(rule("2026-10-11")).toBe(false);
    expect(rule("2026-10-10")).toBe(false);
    expect(rule("2026-10-09")).toBe(false);
    expect(rule("2026-10-08")).toBe(false);
  });

  it("refuses a blacked-out day even when it is far enough away", () => {
    expect(rule("2026-10-20", { blackoutYmds: ["2026-10-20"] })).toBe(false);
    expect(rule("2026-10-21", { blackoutYmds: ["2026-10-20"] })).toBe(true);
  });

  it("with a zero lead time, allows today", () => {
    expect(rule("2026-10-09", { leadDays: 0 })).toBe(true);
  });

  it("parseLeadDays reads numbers and numeric strings, and defaults to 3", () => {
    expect(parseLeadDays(5)).toBe(5);
    expect(parseLeadDays("3")).toBe(3); // production stores the lead time as a string
    expect(parseLeadDays("7")).toBe(7);
    expect(parseLeadDays(undefined)).toBe(3);
    expect(parseLeadDays(null)).toBe(3);
    expect(parseLeadDays("abc")).toBe(3);
  });
});
