import { MenuItem, PackTier } from './menu-item';
import { SelectedOption } from './order';

/** One line in the shopping cart: a chosen pack of an item, with options + count. */
export interface CartLine {
  lineId: string;                  // unique per cart line (for edit/remove)
  item: MenuItem;
  pack: PackTier;                  // which pack size
  selectedOptions: SelectedOption[];
  packCount: number;               // how many of this pack
}
