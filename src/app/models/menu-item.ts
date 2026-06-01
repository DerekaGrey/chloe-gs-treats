/**
 * A single sellable item on the menu (e.g. "Brown Butter Chocolate Chip Cookies").
 *
 * Pricing is per PACK, not per unit. Bigger packs are cheaper per piece, so each
 * pack tier stores its own price. Money is always stored as integer CENTS
 * (e.g. 600 = $6.00) to avoid floating-point rounding bugs.
 */
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: MenuCategory;
  photoUrls: string[];

  /** Available pack sizes + their prices. */
  packPricing: PackTier[];

  /** Optional free/paid choices: icing flavour, drizzle, no-nut, etc. */
  optionGroups?: OptionGroup[];

  /** True for made-to-order items vs. ready stock (informational for now). */
  isCustomOrder: boolean;

  /** Whether the item currently shows on the menu. */
  available: boolean;

  /** Allergens for the cottage-food label, e.g. ['wheat', 'dairy', 'eggs']. */
  allergens: string[];

  /** Ingredient list shown on the item label. */
  ingredients?: string;

  /** Overrides the global lead time if set (in days). */
  leadTimeDaysOverride?: number;

  /** Display order on the menu (lower = earlier). */
  sortOrder: number;
}

export type MenuCategory = 'cookies' | 'scones' | 'rolls' | 'treats' | 'custom';

/** One purchasable pack size, e.g. { label: '6', quantity: 6, priceCents: 1000 }. */
export interface PackTier {
  label: string;       // shown to the customer, e.g. "6"
  quantity: number;    // number of pieces in the pack
  priceCents: number;  // price of one pack, in cents
}

/** A group of choices the customer makes for an item (icing, drizzle, nuts...). */
export interface OptionGroup {
  name: string;                 // "Icing", "Drizzle", "Nuts"
  required: boolean;            // must a choice be made?
  selectionType: 'single';     // (only single-select for now)
  options: ItemOption[];
}

export interface ItemOption {
  label: string;            // "Cream Cheese Icing"
  priceCentsDelta: number;  // usually 0 (free add-on)
}
