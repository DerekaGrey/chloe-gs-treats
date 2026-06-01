import { Injectable, computed, signal } from '@angular/core';
import { CartLine, MenuItem, PackTier, SelectedOption } from '../models';

const STORAGE_KEY = 'chloegs-cart';

/**
 * Holds the shopping cart in a signal (Angular's reactive state primitive).
 * Components read `lines()`, `itemCount()`, `subtotalCents()` and the UI updates
 * automatically when the cart changes. State is persisted to localStorage so the
 * cart survives a page refresh.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  // Private writable signal; exposed read-only below.
  private readonly _lines = signal<CartLine[]>(this.load());

  /** Read-only view of the cart lines. */
  readonly lines = this._lines.asReadonly();

  /** Total number of packs across all lines (for the header badge). */
  readonly itemCount = computed(() =>
    this._lines().reduce((sum, l) => sum + l.packCount, 0),
  );

  /** Cart subtotal in cents. */
  readonly subtotalCents = computed(() =>
    this._lines().reduce((sum, l) => sum + this.lineTotalCents(l), 0),
  );

  /** Cost of one line, in cents. */
  lineTotalCents(line: CartLine): number {
    const optionDelta = line.selectedOptions.reduce(
      (s, o) => s + o.priceCentsDelta,
      0,
    );
    return line.packCount * (line.pack.priceCents + optionDelta);
  }

  add(
    item: MenuItem,
    pack: PackTier,
    selectedOptions: SelectedOption[],
    packCount = 1,
  ): void {
    const key = this.lineKey(item.id, pack.label, selectedOptions);
    const existing = this._lines().find(
      (l) => this.lineKey(l.item.id, l.pack.label, l.selectedOptions) === key,
    );

    if (existing) {
      this.updatePackCount(existing.lineId, existing.packCount + packCount);
      return;
    }

    const line: CartLine = {
      lineId: crypto.randomUUID(),
      item,
      pack,
      selectedOptions,
      packCount,
    };
    this._lines.update((lines) => [...lines, line]);
    this.persist();
  }

  updatePackCount(lineId: string, packCount: number): void {
    if (packCount <= 0) {
      this.remove(lineId);
      return;
    }
    this._lines.update((lines) =>
      lines.map((l) => (l.lineId === lineId ? { ...l, packCount } : l)),
    );
    this.persist();
  }

  remove(lineId: string): void {
    this._lines.update((lines) => lines.filter((l) => l.lineId !== lineId));
    this.persist();
  }

  clear(): void {
    this._lines.set([]);
    this.persist();
  }

  // ---- identity + persistence helpers ----

  /** Two lines are "the same" if item + pack + chosen options all match. */
  private lineKey(
    itemId: string,
    packLabel: string,
    options: SelectedOption[],
  ): string {
    const opts = options
      .map((o) => `${o.groupName}:${o.optionLabel}`)
      .sort()
      .join('|');
    return `${itemId}::${packLabel}::${opts}`;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._lines()));
    } catch {
      // localStorage may be unavailable (private mode), so ignore.
    }
  }

  private load(): CartLine[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  }
}
