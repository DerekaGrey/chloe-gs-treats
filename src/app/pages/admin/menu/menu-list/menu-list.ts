import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuService } from '../../../../services/menu.service';
import { AdminMenuService } from '../../../../services/admin-menu.service';
import { MenuItem, MenuCategory } from '../../../../models';

const CATEGORY_LABELS: Record<MenuCategory, string> = {
  cookies: 'Cookies',
  scones: 'Scones',
  rolls: 'Rolls',
  treats: 'Treats',
  bread: 'Bread',
  custom: 'Custom',
};

@Component({
  selector: 'app-admin-menu-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './menu-list.html',
  styleUrl: './menu-list.scss',
})
export class MenuList {
  private readonly menuService = inject(MenuService);
  private readonly adminMenuService = inject(AdminMenuService);

  readonly togglingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly error = signal('');

  get items(): MenuItem[] {
    return this.menuService.getAll().slice().sort((a, b) => a.sortOrder - b.sortOrder);
  }

  categoryLabel(cat: MenuCategory): string {
    return CATEGORY_LABELS[cat] ?? cat;
  }

  async toggleAvailability(item: MenuItem): Promise<void> {
    this.togglingId.set(item.id);
    try {
      await this.adminMenuService.updateAvailability(item.id, !item.available);
    } catch {
      this.error.set('Failed to update availability.');
    } finally {
      this.togglingId.set(null);
    }
  }

  async deleteItem(item: MenuItem): Promise<void> {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    this.deletingId.set(item.id);
    try {
      await this.adminMenuService.delete(item.id);
    } catch {
      this.error.set('Failed to delete item.');
    } finally {
      this.deletingId.set(null);
    }
  }
}
