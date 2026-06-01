import { Injectable } from '@angular/core';
import {
  CartLine,
  CustomerInfo,
  Order,
  OrderLineItem,
} from '../models';
import { CartService } from './cart.service';

const ORDERS_KEY = 'chloegs-orders';
const COUNTER_KEY = 'chloegs-order-counter';

/**
 * Creates orders. For now it builds the order, assigns a number, and stores it in
 * localStorage so the confirmation page can read it back. Later this becomes a
 * Firestore write (+ the email Cloud Function trigger).
 */
@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private cart: CartService) {}

  /** Build line-item snapshots from the current cart. */
  private toLineItems(lines: CartLine[]): OrderLineItem[] {
    return lines.map((l) => ({
      menuItemId: l.item.id,
      nameSnapshot: l.item.name,
      packLabelSnapshot: l.pack.label,
      packQuantity: l.pack.quantity,
      packPriceCentsSnapshot: l.pack.priceCents,
      packCount: l.packCount,
      selectedOptions: l.selectedOptions,
      lineTotalCents: this.cart.lineTotalCents(l),
    }));
  }

  createOrder(input: {
    customer: CustomerInfo;
    pickupDate: Date;
    specialRequests?: string;
    wantsEmailConfirmation: boolean;
  }): Order {
    const lines = this.cart.lines();
    const items = this.toLineItems(lines);
    const subtotalCents = items.reduce((s, i) => s + i.lineTotalCents, 0);

    const order: Order = {
      orderNumber: this.nextOrderNumber(),
      customer: input.customer,
      items,
      subtotalCents,
      totalCents: subtotalCents, // no tax/fees in v1
      pickupDate: input.pickupDate,
      specialRequests: input.specialRequests,
      status: 'pending',
      paymentMethod: 'pay_at_pickup',
      paymentStatus: 'unpaid',
      wantsEmailConfirmation: input.wantsEmailConfirmation,
      createdAt: new Date(),
    };

    this.save(order);
    this.cart.clear();
    return order;
  }

  /** Look up a previously placed order by its number (for the confirmation page). */
  getByNumber(orderNumber: string): Order | undefined {
    const all = this.loadAll();
    const found = all.find((o) => o.orderNumber === orderNumber);
    if (!found) return undefined;
    // Dates come back as strings from JSON, so revive them.
    found.pickupDate = new Date(found.pickupDate);
    found.createdAt = new Date(found.createdAt);
    return found;
  }

  // ---- persistence helpers (localStorage stand-in for Firestore) ----

  private nextOrderNumber(): string {
    let n = 1000;
    try {
      n = parseInt(localStorage.getItem(COUNTER_KEY) ?? '1000', 10) + 1;
      localStorage.setItem(COUNTER_KEY, String(n));
    } catch {
      n = Math.floor(1000 + Math.random() * 9000);
    }
    return `CG-${n}`;
  }

  private save(order: Order): void {
    try {
      const all = this.loadAll();
      all.push(order);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(all));
    } catch {
      // ignore storage failures in this local stand-in
    }
  }

  private loadAll(): Order[] {
    try {
      const raw = localStorage.getItem(ORDERS_KEY);
      return raw ? (JSON.parse(raw) as Order[]) : [];
    } catch {
      return [];
    }
  }
}
