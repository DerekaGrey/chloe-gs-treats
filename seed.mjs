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
  contactEmail: 'hello@chloegstreats.com',
  cottageFoodDisclaimer:
    'This product is prepared in a kitchen not subject to inspection by the Missouri Department of Health and Senior Services.',
});
console.log('config/global written');

// ---------------------------------------------------------------------------
// menuItems
// ---------------------------------------------------------------------------
const menuItems = [
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
