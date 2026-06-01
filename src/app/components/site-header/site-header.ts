import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
})
export class SiteHeader {
  private cart = inject(CartService);
  private config = inject(ConfigService);

  // Expose to the template.
  readonly brandName = this.config.config.brandName;
  readonly itemCount = this.cart.itemCount; // a signal, call as itemCount() in template
}
