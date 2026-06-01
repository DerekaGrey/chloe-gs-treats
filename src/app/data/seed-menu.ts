import { MenuItem } from '../models';

/**
 * The real current menu (from PROJECT-CONTEXT.md §15), used as local data until
 * Firebase is wired in. Prices are in CENTS.
 *
 * NOTE: ingredient lists below are placeholders except where known, so Chloe should
 * finalize each item's exact ingredients/allergens in the admin screen before the
 * cottage-food labels go live.
 */
export const SEED_MENU: MenuItem[] = [
  // ---------------- COOKIES ----------------
  {
    id: 'bb-choc-chip-cookies',
    name: 'Brown Butter Chocolate Chip Cookies',
    description: 'Rich brown-butter dough with semi-sweet chocolate chips.',
    category: 'cookies',
    photoUrls: ['/images/bb-choc-chip-cookies.jpg'],
    packPricing: [
      { label: '3', quantity: 3, priceCents: 600 },
      { label: '6', quantity: 6, priceCents: 1000 },
      { label: '12', quantity: 12, priceCents: 1800 },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs'],
    ingredients: 'Flour, sugar, brown butter, semi-sweet chocolate chips, eggs, salt, baking soda, vanilla extract.',
    sortOrder: 10,
  },
  {
    id: 'smores-cookies',
    name: "S'mores Cookies",
    description: 'Graham, toasted marshmallow, and melty chocolate in cookie form.',
    category: 'cookies',
    photoUrls: [],
    packPricing: [
      { label: '3', quantity: 3, priceCents: 800 },
      { label: '6', quantity: 6, priceCents: 1400 },
      { label: '12', quantity: 12, priceCents: 2600 },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs'],
    ingredients: 'Flour, sugar, butter, graham crackers, marshmallow, chocolate, eggs, salt, baking soda, vanilla extract.',
    sortOrder: 20,
  },
  {
    id: 'snickerdoodle-cookies',
    name: 'Snickerdoodle Cookies',
    description: 'Soft cinnamon-sugar classic.',
    category: 'cookies',
    photoUrls: ['/images/snickerdoodle-cookies.jpg'],
    packPricing: [
      { label: '3', quantity: 3, priceCents: 600 },
      { label: '6', quantity: 6, priceCents: 1000 },
      { label: '12', quantity: 12, priceCents: 1800 },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs'],
    ingredients: 'Flour, sugar, butter, cinnamon, cream of tartar, eggs, salt, baking soda, vanilla extract.',
    sortOrder: 30,
  },

  // ---------------- SCONES ----------------
  {
    id: 'choc-chip-scones',
    name: 'Chocolate Chip Scones',
    description: 'Sourdough scones studded with semi-sweet chocolate chips.',
    category: 'scones',
    photoUrls: [],
    packPricing: [
      { label: '4', quantity: 4, priceCents: 1400 },
      { label: '8', quantity: 8, priceCents: 2600 },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs'],
    ingredients: 'Flour, sugar, salt, baking powder, butter, semi-sweet chocolate chips, sourdough discard, heavy cream, eggs, vanilla extract.',
    sortOrder: 40,
  },
  {
    id: 'carrot-cake-scones',
    name: 'Carrot Cake Scones',
    description: 'Spiced carrot scones, choose with or without nuts.',
    category: 'scones',
    photoUrls: ['/images/carrot-cake-scones.jpg'],
    packPricing: [
      { label: '4', quantity: 4, priceCents: 1400 },
      { label: '8', quantity: 8, priceCents: 2600 },
    ],
    optionGroups: [
      {
        name: 'Nuts',
        required: true,
        selectionType: 'single',
        options: [
          { label: 'With nuts', priceCentsDelta: 0 },
          { label: 'No-nut', priceCentsDelta: 0 },
        ],
      },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs', 'tree nuts'],
    ingredients: 'Flour, sugar, salt, baking powder, butter, carrots, cinnamon, sourdough discard, heavy cream, eggs, walnuts (omitted for no-nut), vanilla extract.',
    sortOrder: 50,
  },
  {
    id: 'apple-cinnamon-scones',
    name: 'Apple Cinnamon Scones',
    description: 'Cinnamon-spiced sourdough scones with apple.',
    category: 'scones',
    photoUrls: [],
    packPricing: [
      { label: '4', quantity: 4, priceCents: 1400 },
      { label: '8', quantity: 8, priceCents: 2600 },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs'],
    ingredients: 'Flour, sugar, salt, baking powder, butter, apples, cinnamon, sourdough discard, heavy cream, eggs, vanilla extract.',
    sortOrder: 60,
  },
  {
    id: 'lemon-blueberry-scones',
    name: 'Lemon Blueberry Scones',
    description: 'Bright lemon and blueberry sourdough scones.',
    category: 'scones',
    photoUrls: [],
    packPricing: [
      { label: '4', quantity: 4, priceCents: 1400 },
      { label: '8', quantity: 8, priceCents: 2600 },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs'],
    ingredients: 'Flour, sugar, salt, baking powder, butter, blueberries, lemon, sourdough discard, heavy cream, eggs, vanilla extract.',
    sortOrder: 70,
  },

  // ---------------- ROLLS ----------------
  {
    id: 'cinnamon-rolls',
    name: 'Cinnamon Rolls',
    description: 'Soft sourdough cinnamon rolls. Comes with free icing, pick your flavour.',
    category: 'rolls',
    photoUrls: [],
    packPricing: [
      { label: '6', quantity: 6, priceCents: 1500 },
      { label: '12', quantity: 12, priceCents: 2800 },
    ],
    optionGroups: [
      {
        name: 'Icing',
        required: true,
        selectionType: 'single',
        options: [
          { label: 'Cream Cheese Icing', priceCentsDelta: 0 },
          { label: 'Sweet Vanilla Icing', priceCentsDelta: 0 },
        ],
      },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs'],
    ingredients: 'Flour, sugar, butter, cinnamon, sourdough, milk, eggs, salt, yeast. Icing: powdered sugar, butter, vanilla (cream cheese added for cream-cheese icing).',
    sortOrder: 80,
  },

  // ---------------- TREATS ----------------
  {
    id: 'bb-rice-crispy-treats',
    name: 'Brown Butter Rice Crispy Treats',
    description: 'Brown-butter rice crispy treats, add a chocolate drizzle if you like.',
    category: 'treats',
    photoUrls: [],
    packPricing: [
      { label: '6', quantity: 6, priceCents: 1200 },
      { label: '12', quantity: 12, priceCents: 2200 },
    ],
    optionGroups: [
      {
        name: 'Drizzle',
        required: true,
        selectionType: 'single',
        options: [
          { label: 'Milk Chocolate Drizzle', priceCentsDelta: 0 },
          { label: 'White Chocolate Drizzle', priceCentsDelta: 0 },
          { label: 'No Drizzle', priceCentsDelta: 0 },
        ],
      },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy'],
    ingredients: 'Brown butter, marshmallow, crisped rice cereal. Optional milk- or white-chocolate drizzle.',
    sortOrder: 90,
  },
];
