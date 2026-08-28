import { Injectable, signal } from '@angular/core';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { MenuItem, MenuCategory } from '../models';

function docToMenuItem(d: QueryDocumentSnapshot<DocumentData>): MenuItem {
  const data = d.data();
  return {
    id: d.id,
    name: data['name'],
    description: data['description'],
    category: data['category'],
    photoUrls: data['photoUrls'] ?? [],
    packPricing: data['packPricing'] ?? [],
    optionGroups: data['optionGroups'],
    isCustomOrder: data['isCustomOrder'] ?? false,
    available: data['available'] ?? true,
    allergens: data['allergens'] ?? [],
    ingredients: data['ingredients'],
    leadTimeDaysOverride: data['leadTimeDaysOverride'],
    sortOrder: data['sortOrder'] ?? 0,
  };
}

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly _items = signal<MenuItem[]>([]);

  constructor() {
    const db = getFirestore();
    onSnapshot(
      query(collection(db, 'menuItems'), orderBy('sortOrder')),
      snap => this._items.set(snap.docs.map(docToMenuItem)),
    );
  }

  getAll(): MenuItem[] {
    return this._items();
  }

  getAvailable(): MenuItem[] {
    return this._items().filter(i => i.available);
  }

  getById(id: string): MenuItem | undefined {
    return this._items().find(i => i.id === id);
  }

  getByCategory(category: MenuCategory): MenuItem[] {
    return this.getAvailable().filter(i => i.category === category);
  }

  getCategories(): MenuCategory[] {
    const seen = new Set<MenuCategory>();
    for (const item of this.getAvailable()) seen.add(item.category);
    return [...seen];
  }
}
