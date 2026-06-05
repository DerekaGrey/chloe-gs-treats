import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MenuService } from '../../services/menu.service';
import { CartService } from '../../services/cart.service';
import { ConfigService } from '../../services/config.service';
import { CentsPipe } from '../../shared/cents.pipe';
import { ItemOption, MenuItem, OptionGroup, PackTier, SelectedOption } from '../../models';

@Component({
  selector: 'app-item-detail',
  imports: [RouterLink, CentsPipe],
  templateUrl: './item-detail.html',
  styleUrl: './item-detail.scss',
})
export class ItemDetail {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private menu = inject(MenuService);
  private cart = inject(CartService);
  private config = inject(ConfigService);

  readonly disclaimer = computed(() => this.config.config.cottageFoodDisclaimer);
  readonly item = computed(() =>
    this.menu.getById(this.route.snapshot.paramMap.get('id') ?? ''),
  );

  readonly selectedPack = signal<PackTier | undefined>(undefined);
  readonly selectedOptions = signal<Record<string, ItemOption>>({});
  readonly packCount = signal(1);

  readonly unitPriceCents = computed(() => {
    const pack = this.selectedPack();
    if (!pack) return 0;
    const optionDelta = Object.values(this.selectedOptions()).reduce(
      (s, o) => s + o.priceCentsDelta,
      0,
    );
    return pack.priceCents + optionDelta;
  });

  readonly totalCents = computed(() => this.unitPriceCents() * this.packCount());

  constructor() {
    // Once the item loads from Firestore, set pack/option defaults (runs once).
    effect(() => {
      const item = this.item();
      if (item && untracked(() => !this.selectedPack())) {
        this.selectedPack.set(item.packPricing[0]);
        this.selectedOptions.set(this.defaultOptions(item));
      }
    });
  }

  private defaultOptions(item: MenuItem): Record<string, ItemOption> {
    const result: Record<string, ItemOption> = {};
    for (const group of item.optionGroups ?? []) {
      result[group.name] = group.options[0];
    }
    return result;
  }

  selectPack(pack: PackTier): void {
    this.selectedPack.set(pack);
  }

  selectOption(group: OptionGroup, option: ItemOption): void {
    this.selectedOptions.update(current => ({ ...current, [group.name]: option }));
  }

  isOptionSelected(groupName: string, option: ItemOption): boolean {
    return this.selectedOptions()[groupName]?.label === option.label;
  }

  changeQty(delta: number): void {
    this.packCount.update(q => Math.max(1, q + delta));
  }

  addToCart(): void {
    const item = this.item();
    if (!item || !this.selectedPack()) return;
    const options: SelectedOption[] = Object.entries(this.selectedOptions()).map(
      ([groupName, opt]) => ({
        groupName,
        optionLabel: opt.label,
        priceCentsDelta: opt.priceCentsDelta,
      }),
    );
    this.cart.add(item, this.selectedPack()!, options, this.packCount());
    this.router.navigate(['/cart']);
  }
}
