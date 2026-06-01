import { PopupEvent } from '../models';

const LOCATION = 'Corporate Lake Properties, 4804 John Garry Dr, Columbia, MO';

/**
 * Sample upcoming popup appearances (local data for now).
 * Date args are (year, monthIndex, day, hour, minute), where monthIndex is 0-based,
 * so 4 = May, 5 = June.
 *
 * `standMenu` uses STAND pricing (cookie 3-packs, single scones/treats), which is
 * different from the online Shop pack pricing.
 */
export const SEED_EVENTS: PopupEvent[] = [
  {
    id: 'evt-tomorrow',
    title: 'Popup Stand',
    startsAt: new Date(2026, 4, 30, 9, 0),
    endsAt: new Date(2026, 4, 30, 16, 0),
    location: LOCATION,
    description: "Come grab fresh treats at the stand, here's what we're baking:",
    standMenu: [
      { name: 'Brown Butter Chocolate Chip Cookies', priceLabel: '3 for $6' },
      { name: "S'mores Cookies", priceLabel: '3 for $8' },
      { name: 'Chocolate Chip Scones', priceLabel: '$3 each' },
      { name: 'Brown Butter Rice Crispy Treats', priceLabel: '$3 each' },
    ],
    status: 'scheduled',
  },
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
