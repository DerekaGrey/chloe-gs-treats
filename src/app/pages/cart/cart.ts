import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CentsPipe } from '../../shared/cents.pipe';
import { CartLine } from '../../models';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, CentsPipe],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class Cart {
  private cartService = inject(CartService);

  // Signals exposed to the template.
  readonly lines = this.cartService.lines;
  readonly subtotalCents = this.cartService.subtotalCents;

  lineTotal(line: CartLine): number {
    return this.cartService.lineTotalCents(line);
  }

  changeQty(line: CartLine, delta: number): void {
    this.cartService.updatePackCount(line.lineId, line.packCount + delta);
  }

  remove(line: CartLine): void {
    this.cartService.remove(line.lineId);
  }

  clear(): void {
    this.cartService.clear();
  }
}
