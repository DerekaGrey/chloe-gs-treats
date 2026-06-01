import { Injectable } from '@angular/core';
import { MenuItem, MenuCategory } from '../models';
import { SEED_MENU } from '../data/seed-menu';

/**
 * Source of menu data. Reads from local seed data for now; later this will read
 * from Firestore. Keeping all menu access behind this service means swapping the
 * data source touches only this file.
 *
 * `providedIn: 'root'` makes this a singleton injectable anywhere in the app.
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
  /** All items currently marked available, sorted for display. */
  getAvailable(): MenuItem[] {
    return SEED_MENU
      .filter((i) => i.available)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getById(id: string): MenuItem | undefined {
    return SEED_MENU.find((i) => i.id === id);
  }

  getByCategory(category: MenuCategory): MenuItem[] {
    return this.getAvailable().filter((i) => i.category === category);
  }

  /** Distinct categories present in the available menu, in display order. */
  getCategories(): MenuCategory[] {
    const seen = new Set<MenuCategory>();
    for (const item of this.getAvailable()) seen.add(item.category);
    return [...seen];
  }
}
