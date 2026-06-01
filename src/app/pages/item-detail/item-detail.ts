import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MenuService } from '../../services/menu.service';
import { CartService } from '../../services/cart.service';
import { ConfigService } from '../../services/config.service';
import { CentsPipe } from '../../shared/cents.pipe';
import { ItemOption, OptionGroup, PackTier, SelectedOption } from '../../models';

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

  readonly disclaimer = this.config.config.cottageFoodDisclaimer;

  // The item being viewed (looked up from the :id route param).
  readonly item = this.menu.getById(this.route.snapshot.paramMap.get('id') ?? '');

  // --- selection state (signals) ---
  readonly selectedPack = signal<PackTier | undefined>(this.item?.packPricing[0]);
  // Map of group name -> chosen option. Defaults to each group's first option.
  readonly selectedOptions = signal<Record<string, ItemOption>>(this.defaultOptions());
  readonly packCount = signal(1);

  // Unit price = pack price + selected option deltas.
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

  private defaultOptions(): Record<string, ItemOption> {
    const result: Record<string, ItemOption> = {};
    for (const group of this.item?.optionGroups ?? []) {
      result[group.name] = group.options[0];
    }
    return result;
  }

  selectPack(pack: PackTier): void {
    this.selectedPack.set(pack);
  }

  selectOption(group: OptionGroup, option: ItemOption): void {
    this.selectedOptions.update((current) => ({ ...current, [group.name]: option }));
  }

  isOptionSelected(groupName: string, option: ItemOption): boolean {
    return this.selectedOptions()[groupName]?.label === option.label;
  }

  changeQty(delta: number): void {
    this.packCount.update((q) => Math.max(1, q + delta));
  }

  addToCart(): void {
    if (!this.item || !this.selectedPack()) return;
    const options: SelectedOption[] = Object.entries(this.selectedOptions()).map(
      ([groupName, opt]) => ({
        groupName,
        optionLabel: opt.label,
        priceCentsDelta: opt.priceCentsDelta,
      }),
    );
    this.cart.add(this.item, this.selectedPack()!, options, this.packCount());
    this.router.navigate(['/cart']);
  }
}
