/**
 * One-time Firestore seed script. Populates menuItems, popupEvents, and config/global.
 *
 * BEFORE running:
 *   1. In the Firebase console, temporarily set Firestore rules to allow all writes:
 *        rules_version = '2';
 *        service cloud.firestore {
 *          match /databases/{database}/documents {
 *            match /{document=**} { allow read, write: if true; }
 *          }
 *        }
 *   2. node seed.mjs
 *   3. Restore proper Firestore rules (see firestore.rules in this directory).
 *
 * Safe to re-run: setDoc with merge:false overwrites, so run once is enough.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD7n3Kb_KnWcPSder7lByLsf0ge9qHvaP0',
  authDomain: 'chloe-gs-treats.firebaseapp.com',
  projectId: 'chloe-gs-treats',
  storageBucket: 'chloe-gs-treats.firebasestorage.app',
  messagingSenderId: '370983422776',
  appId: '1:370983422776:web:56fdc852a1459dcc614fcd',
};

initializeApp(firebaseConfig);
const db = getFirestore();

// ---------------------------------------------------------------------------
// config/global
// ---------------------------------------------------------------------------
const LOCATION = 'Corporate Lake Properties, 4804 John Garry Dr, Columbia, MO';

await setDoc(doc(db, 'config', 'global'), {
  brandName: "Chloe G's Homemade Treats",
  defaultLeadTimeDays: 3,
  blackoutDates: [],
  orderCounter: 1000,
  pickupLocation: LOCATION,
  contactEmail: 'chloegshomemadetreats@gmail.com',
  cottageFoodDisclaimer:
    'This product is prepared in a kitchen not subject to inspection by the Missouri Department of Health and Senior Services.',
});
console.log('config/global written');

// ---------------------------------------------------------------------------
// menuItems
// ---------------------------------------------------------------------------
const menuItems = [
  // ── Cookies ──────────────────────────────────────────────────────────────
  {
    id: 'bb-choc-chip-cookies',
    name: 'Brown Butter Chocolate Chip Cookies',
    description: 'Rich brown-butter sourdough cookies with semi-sweet and milk chocolate chips.',
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
    ingredients: 'Flour, sugar, brown sugar, unsalted butter, baking soda, corn starch, salt, eggs, vanilla extract, sourdough discard (flour and water), semi-sweet chocolate chips, milk chocolate chips.',
    sortOrder: 10,
  },
  {
    id: 'smores-cookies',
    name: "Gourmet S'mores Cookies",
    description: 'Graham, dehydrated marshmallow, and Hershey\'s chocolate in sourdough cookie form.',
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
    ingredients: "Flour, sugar, brown sugar, unsalted butter, baking soda, corn starch, salt, eggs, vanilla extract, sourdough discard (flour and water), semi-sweet chocolate chips, graham crackers, dehydrated marshmallows, marshmallows, Hershey's chocolate.",
    sortOrder: 20,
  },
  {
    id: 'snickerdoodle-cookies',
    name: 'Snickerdoodle Cookies',
    description: 'Soft cinnamon-sugar sourdough classic.',
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
    ingredients: 'Unsalted butter, sugar, sourdough discard (flour and water), egg, vanilla extract, flour, baking soda, cream of tartar, salt, ground cinnamon.',
    sortOrder: 30,
  },
  {
    id: 'cookie-butter-cookies',
    name: 'Cookie Butter Cookies',
    description: 'Sourdough cookies loaded with Biscoff, cookie butter, and white chocolate chips.',
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
    ingredients: 'Flour, sugar, brown sugar, unsalted butter, baking soda, corn starch, salt, eggs, vanilla extract, sourdough discard (flour and water), white chocolate chips, Biscoff cookies, cookie butter.',
    sortOrder: 40,
  },
  // ── Scones ───────────────────────────────────────────────────────────────
  {
    id: 'choc-chip-scones',
    name: 'Chocolate Chip Scones',
    description: 'Sourdough scones studded with semi-sweet chocolate chips.',
    category: 'scones',
    photoUrls: [],
    packPricing: [
      { label: '4', quantity: 4, priceCents: 1200 },
      { label: '8', quantity: 8, priceCents: 2200 },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs'],
    ingredients: 'Flour, sugar, salt, baking powder, unsalted butter, semi-sweet chocolate chips, sourdough discard (flour and water), heavy cream, eggs, vanilla extract.',
    sortOrder: 50,
  },
  {
    id: 'carrot-cake-scones',
    name: 'Carrot Cake Scones',
    description: 'Warmly spiced carrot scones with cream cheese morsels.',
    category: 'scones',
    photoUrls: ['/images/carrot-cake-scones.jpg'],
    packPricing: [
      { label: '4', quantity: 4, priceCents: 1400 },
      { label: '8', quantity: 8, priceCents: 2600 },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs'],
    ingredients: 'Flour, brown sugar, salt, baking soda, baking powder, unsalted butter, ground ginger, nutmeg, cloves, cinnamon, cream cheese morsels, carrots, sourdough discard (flour and water), milk, eggs, vanilla extract, powdered sugar.',
    sortOrder: 60,
  },
  {
    id: 'apple-cinnamon-scones',
    name: 'Apple Cinnamon Scones',
    description: 'Cinnamon and nutmeg sourdough scones with apple and apple sauce.',
    category: 'scones',
    photoUrls: [],
    packPricing: [
      { label: '4', quantity: 4, priceCents: 1400 },
      { label: '8', quantity: 8, priceCents: 2600 },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs'],
    ingredients: 'Flour, sugar, salt, baking powder, unsalted butter, cinnamon, nutmeg, apples, apple sauce, sourdough discard (flour and water), heavy cream, eggs, vanilla extract, powdered sugar, brown sugar, milk.',
    sortOrder: 70,
  },
  {
    id: 'lemon-blueberry-scones',
    name: 'Lemon Blueberry Scones',
    description: 'Bright lemon zest and blueberry sourdough scones.',
    category: 'scones',
    photoUrls: [],
    packPricing: [
      { label: '4', quantity: 4, priceCents: 1400 },
      { label: '8', quantity: 8, priceCents: 2600 },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs'],
    ingredients: 'Flour, sugar, baking powder, salt, unsalted butter, blueberries, eggs, sourdough discard (flour and water), heavy cream, vanilla extract, powdered sugar, lemon zest, lemon juice.',
    sortOrder: 80,
  },
  {
    id: 'strawberries-cream-scones',
    name: 'Strawberries and Cream Scones',
    description: 'Sourdough scones with cream cheese morsels, fresh and dehydrated strawberries.',
    category: 'scones',
    photoUrls: [],
    packPricing: [
      { label: '4', quantity: 4, priceCents: 1400 },
      { label: '8', quantity: 8, priceCents: 2600 },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs'],
    ingredients: 'Flour, sugar, salt, baking powder, unsalted butter, cream cheese morsels, strawberries, sourdough discard (flour and salt), heavy cream, eggs, vanilla extract, powdered sugar, dehydrated strawberries.',
    sortOrder: 90,
  },
  {
    id: 'earl-grey-scones',
    name: 'Earl Grey Scones',
    description: 'Delicate sourdough scones infused with earl grey tea and vanilla bean.',
    category: 'scones',
    photoUrls: [],
    packPricing: [
      { label: '4', quantity: 4, priceCents: 1400 },
      { label: '8', quantity: 8, priceCents: 2600 },
    ],
    isCustomOrder: false,
    available: true,
    allergens: ['wheat', 'dairy', 'eggs'],
    ingredients: 'Flour, sugar, salt, baking powder, unsalted butter, earl grey tea leaves, sourdough discard (flour and water), heavy cream, eggs, vanilla extract, powdered sugar, vanilla bean paste.',
    sortOrder: 100,
  },
  // ── Rolls ────────────────────────────────────────────────────────────────
  {
    id: 'cinnamon-rolls',
    name: 'Cinnamon Rolls',
    description: 'Soft sourdough cinnamon rolls. Comes with your choice of icing.',
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
    ingredients: 'Milk, flour, active sourdough levain (flour, water, sugar), unsalted butter, sugar, eggs, salt, brown sugar, cinnamon.',
    sortOrder: 110,
  },
  // ── Treats ───────────────────────────────────────────────────────────────
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
    ingredients: 'Unsalted butter, rice cereal, kosher salt, marshmallows, vanilla extract. Optional milk or white chocolate drizzle.',
    sortOrder: 120,
  },
  // ── Bread ────────────────────────────────────────────────────────────────
  {
    id: 'sourdough-sandwich-loaf',
    name: 'Sourdough Sandwich Loaf',
    description: 'Classic sourdough sandwich loaf with a soft crumb.',
    category: 'bread',
    photoUrls: [],
    packPricing: [
      { label: '1 loaf', quantity: 1, priceCents: 1200 },
    ],
    isCustomOrder: true,
    available: true,
    allergens: ['wheat'],
    ingredients: 'Flour, water, active sourdough starter (flour and water), salt.',
    sortOrder: 130,
  },
  {
    id: 'jalapeno-cheddar-loaf',
    name: 'Jalapeño Cheddar Sourdough Loaf',
    description: 'Sourdough sandwich loaf loaded with pickled jalapeños and cheddar.',
    category: 'bread',
    photoUrls: [],
    packPricing: [
      { label: '1 loaf', quantity: 1, priceCents: 1400 },
    ],
    isCustomOrder: true,
    available: true,
    allergens: ['wheat', 'dairy'],
    ingredients: 'Flour, water, active sourdough starter (flour and water), salt, pickled jalapeños, jalapeño juice, cheddar cheese.',
    sortOrder: 140,
  },
];

for (const item of menuItems) {
  const { id, ...data } = item;
  await setDoc(doc(db, 'menuItems', id), data);
  console.log(`menuItems/${id} written`);
}

// ---------------------------------------------------------------------------
// popupEvents
// ---------------------------------------------------------------------------
const popupEvents = [
  {
    id: 'evt-1',
    title: 'Saturday Morning Popup',
    startsAt: new Date(2026, 5, 6, 9, 0),
    endsAt: new Date(2026, 5, 6, 13, 30),
    location: LOCATION,
    description: 'Fresh cookies, scones, and cinnamon rolls. Come say hi!',
    standMenu: [
      { name: 'Brown Butter Chocolate Chip Cookies', priceLabel: '3 for $6' },
      { name: 'Snickerdoodle Cookies', priceLabel: '3 for $6' },
      { name: 'Chocolate Chip Scones', priceLabel: '$3 each' },
    ],
    status: 'scheduled',
  },
  {
    id: 'evt-2',
    title: 'Sunday Sweets Stand',
    startsAt: new Date(2026, 5, 14, 10, 0),
    endsAt: new Date(2026, 5, 14, 14, 0),
    location: LOCATION,
    description: 'Featuring carrot cake scones and brown butter rice crispy treats.',
    standMenu: [
      { name: 'Carrot Cake Scones', priceLabel: '$3 each' },
      { name: 'Brown Butter Rice Crispy Treats', priceLabel: '$3 each' },
    ],
    status: 'scheduled',
  },
];

for (const event of popupEvents) {
  const { id, startsAt, endsAt, ...rest } = event;
  await setDoc(doc(db, 'popupEvents', id), {
    ...rest,
    startsAt: Timestamp.fromDate(startsAt),
    endsAt: Timestamp.fromDate(endsAt),
  });
  console.log(`popupEvents/${id} written`);
}

console.log('\nSeed complete!');
process.exit(0);
