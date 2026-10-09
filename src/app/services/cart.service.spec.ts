import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CartService } from './cart.service';
import { CartLine, MenuItem, PackTier, SelectedOption } from '../models';

const COOKIES = { id: 'cookies', name: 'Brown Butter Cookies' } as MenuItem;
const SCONES = { id: 'scones', name: 'Carrot Cake Scones' } as MenuItem;

const SIX: PackTier = { label: '6', quantity: 6, priceCents: 1000 };
const TWELVE: PackTier = { label: '12', quantity: 12, priceCents: 1800 };
const FOUR: PackTier = { label: '4', quantity: 4, priceCents: 1200 };

const icing = (optionLabel: string, priceCentsDelta = 0): SelectedOption => ({
  groupName: 'Icing',
  optionLabel,
  priceCentsDelta,
});

const STORAGE_KEY = 'chloegs-cart';

describe('CartService', () => {
  let cart: CartService;

  beforeEach(() => {
    localStorage.clear();
    cart = TestBed.inject(CartService);
  });

  describe('line and subtotal pricing', () => {
    it('prices a line as pack price x pack count', () => {
      cart.add(COOKIES, TWELVE, [], 2);
      expect(cart.lineTotalCents(cart.lines()[0])).toBe(3600);
    });

    it('adds a paid option to every pack in the line', () => {
      cart.add(SCONES, FOUR, [icing('Maple', 150)], 3);
      // 3 x (1200 + 150)
      expect(cart.lineTotalCents(cart.lines()[0])).toBe(4050);
    });

    it('sums the deltas of several options', () => {
      const line: CartLine = {
        lineId: 'x',
        item: SCONES,
        pack: FOUR,
        packCount: 2,
        selectedOptions: [icing('Maple', 150), { groupName: 'Drizzle', optionLabel: 'Caramel', priceCentsDelta: 100 }],
      };
      expect(cart.lineTotalCents(line)).toBe(2 * (1200 + 150 + 100));
    });

    it('free options do not change the price', () => {
      cart.add(SCONES, FOUR, [icing('Cream Cheese', 0)], 1);
      expect(cart.lineTotalCents(cart.lines()[0])).toBe(1200);
    });

    it('subtotal is the sum of every line, and is 0 for an empty cart', () => {
      expect(cart.subtotalCents()).toBe(0);
      cart.add(COOKIES, SIX, [], 1); // 1000
      cart.add(SCONES, FOUR, [icing('Maple', 150)], 2); // 2700
      expect(cart.subtotalCents()).toBe(3700);
    });

    it('is exact in whole cents (no floating-point drift)', () => {
      cart.add(COOKIES, { label: '1', quantity: 1, priceCents: 333 }, [], 3);
      expect(cart.subtotalCents()).toBe(999);
    });
  });

  describe('adding items', () => {
    it('merges the same item, pack and options into one line and adds the counts', () => {
      cart.add(COOKIES, SIX, [], 1);
      cart.add(COOKIES, SIX, [], 2);
      expect(cart.lines()).toHaveLength(1);
      expect(cart.lines()[0].packCount).toBe(3);
    });

    it('treats option order as irrelevant when merging', () => {
      const a = icing('Maple', 150);
      const b: SelectedOption = { groupName: 'Drizzle', optionLabel: 'Caramel', priceCentsDelta: 100 };
      cart.add(SCONES, FOUR, [a, b], 1);
      cart.add(SCONES, FOUR, [b, a], 1);
      expect(cart.lines()).toHaveLength(1);
      expect(cart.lines()[0].packCount).toBe(2);
    });

    it('keeps different options, packs or items on separate lines', () => {
      cart.add(SCONES, FOUR, [icing('Maple', 150)], 1);
      cart.add(SCONES, FOUR, [icing('Cream Cheese')], 1);
      cart.add(COOKIES, SIX, [], 1);
      cart.add(COOKIES, TWELVE, [], 1);
      expect(cart.lines()).toHaveLength(4);
    });

    it('defaults to one pack', () => {
      cart.add(COOKIES, SIX, []);
      expect(cart.lines()[0].packCount).toBe(1);
    });

    it('counts packs across all lines for the header badge', () => {
      cart.add(COOKIES, SIX, [], 2);
      cart.add(SCONES, FOUR, [icing('Maple', 150)], 3);
      expect(cart.itemCount()).toBe(5);
    });
  });

  describe('changing the cart', () => {
    it('updates a pack count', () => {
      cart.add(COOKIES, SIX, [], 1);
      cart.updatePackCount(cart.lines()[0].lineId, 4);
      expect(cart.lines()[0].packCount).toBe(4);
      expect(cart.subtotalCents()).toBe(4000);
    });

    it.each([0, -1])('removes the line when the count is set to %s', (count) => {
      cart.add(COOKIES, SIX, [], 2);
      cart.updatePackCount(cart.lines()[0].lineId, count);
      expect(cart.lines()).toHaveLength(0);
    });

    it('removes just the chosen line', () => {
      cart.add(COOKIES, SIX, [], 1);
      cart.add(SCONES, FOUR, [icing('Maple', 150)], 1);
      cart.remove(cart.lines()[0].lineId);
      expect(cart.lines().map((l) => l.item.id)).toEqual(['scones']);
    });

    it('clears everything', () => {
      cart.add(COOKIES, SIX, [], 1);
      cart.add(SCONES, FOUR, [icing('Maple', 150)], 1);
      cart.clear();
      expect(cart.lines()).toEqual([]);
      expect(cart.subtotalCents()).toBe(0);
    });
  });

  describe('persistence', () => {
    it('saves to localStorage and a fresh service restores the cart', () => {
      cart.add(COOKIES, TWELVE, [], 2);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveLength(1);

      TestBed.resetTestingModule();
      const reloaded = TestBed.inject(CartService);
      expect(reloaded.lines()).toHaveLength(1);
      expect(reloaded.subtotalCents()).toBe(3600);
    });

    it('starts empty when the saved cart is corrupt', () => {
      localStorage.setItem(STORAGE_KEY, '{not json');
      TestBed.resetTestingModule();
      expect(TestBed.inject(CartService).lines()).toEqual([]);
    });

    it('persists the cleared state too', () => {
      cart.add(COOKIES, SIX, [], 1);
      cart.clear();
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([]);
    });
  });
});
