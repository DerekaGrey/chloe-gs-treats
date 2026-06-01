import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { OrderService } from '../../services/order.service';
import { ConfigService } from '../../services/config.service';
import { CentsPipe } from '../../shared/cents.pipe';

@Component({
  selector: 'app-confirmation',
  imports: [RouterLink, DatePipe, CentsPipe],
  templateUrl: './confirmation.html',
  styleUrl: './confirmation.scss',
})
export class Confirmation {
  private route = inject(ActivatedRoute);
  private orders = inject(OrderService);
  private config = inject(ConfigService);

  readonly cfg = this.config.config;
  readonly order = this.orders.getByNumber(
    this.route.snapshot.paramMap.get('orderNumber') ?? '',
  );
}
