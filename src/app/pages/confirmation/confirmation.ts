import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { OrderService } from '../../services/order.service';
import { ConfigService } from '../../services/config.service';
import { CentsPipe } from '../../shared/cents.pipe';
import { Order } from '../../models';

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

  readonly cfg = computed(() => this.config.config);
  readonly order = signal<Order | undefined>(undefined);

  constructor() {
    const orderNumber = this.route.snapshot.paramMap.get('orderNumber') ?? '';
    this.orders.getByNumber(orderNumber).then(o => this.order.set(o));
  }
}
