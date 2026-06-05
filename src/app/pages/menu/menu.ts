import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuService } from '../../services/menu.service';
import { MenuCategory, MenuItem } from '../../models';
import { CentsPipe } from '../../shared/cents.pipe';

interface CategorySection {
  category: MenuCategory;
  label: string;
  items: MenuItem[];
}

const CATEGORY_LABELS: Record<MenuCategory, string> = {
  cookies: 'Cookies',
  scones: 'Scones',
  rolls: 'Cinnamon Rolls',
  treats: 'Treats',
  custom: 'Custom Orders',
};

@Component({
  selector: 'app-menu',
  imports: [RouterLink, CentsPipe],
  templateUrl: './menu.html',
  styleUrl: './menu.scss',
})
export class Menu {
  private menu = inject(MenuService);

  readonly sections = computed<CategorySection[]>(() =>
    this.menu.getCategories().map(c => ({
      category: c,
      label: CATEGORY_LABELS[c],
      items: this.menu.getByCategory(c),
    })),
  );

  startingPriceCents(item: MenuItem): number {
    return Math.min(...item.packPricing.map(p => p.priceCents));
  }
}
