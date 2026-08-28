import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CentsPipe } from '../../../../shared/cents.pipe';
import { AdminOrderService } from '../../../../services/admin-order.service';
import { Order, OrderStatus } from '../../../../models';

type FilterTab = 'all' | 'pending' | 'active' | 'ready' | 'pickedup' | 'cancelled';

const STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'baking',
  baking: 'ready',
  ready: 'pickedup',
};

const STATUS_NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: 'Confirm',
  confirmed: 'Start Baking',
  baking: 'Mark Ready',
  ready: 'Mark Picked Up',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  baking: 'Baking',
  ready: 'Ready',
  pickedup: 'Picked Up',
  cancelled: 'Cancelled',
};

@Component({
  selector: 'app-admin-order-list',
  standalone: true,
  imports: [RouterLink, CentsPipe],
  templateUrl: './order-list.html',
  styleUrl: './order-list.scss',
})
export class OrderList {
  private readonly orderService = inject(AdminOrderService);

  readonly activeFilter = signal<FilterTab>('all');
  readonly expandedIds = signal<Set<string>>(new Set());
  readonly workingId = signal<string | null>(null);
  readonly error = signal('');

  readonly filters: { value: FilterTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'active', label: 'Active' },
    { value: 'ready', label: 'Ready' },
    { value: 'pickedup', label: 'Picked Up' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  readonly filteredOrders = computed(() => {
    const filter = this.activeFilter();
    const orders = this.orderService.getAll();
    switch (filter) {
      case 'pending': return orders.filter(o => o.status === 'pending');
      case 'active': return orders.filter(o => o.status === 'confirmed' || o.status === 'baking');
      case 'ready': return orders.filter(o => o.status === 'ready');
      case 'pickedup': return orders.filter(o => o.status === 'pickedup');
      case 'cancelled': return orders.filter(o => o.status === 'cancelled');
      default: return orders;
    }
  });

  countFor(filter: FilterTab): number {
    const orders = this.orderService.getAll();
    switch (filter) {
      case 'pending': return orders.filter(o => o.status === 'pending').length;
      case 'active': return orders.filter(o => o.status === 'confirmed' || o.status === 'baking').length;
      case 'ready': return orders.filter(o => o.status === 'ready').length;
      case 'pickedup': return orders.filter(o => o.status === 'pickedup').length;
      case 'cancelled': return orders.filter(o => o.status === 'cancelled').length;
      default: return orders.length;
    }
  }

  statusLabel(status: OrderStatus): string {
    return STATUS_LABELS[status];
  }

  statusClass(status: OrderStatus): string {
    return `status-${status}`;
  }

  nextStatusLabel(status: OrderStatus): string {
    return STATUS_NEXT_LABEL[status] ?? '';
  }

  canAdvance(status: OrderStatus): boolean {
    return status in STATUS_NEXT;
  }

  canCancel(status: OrderStatus): boolean {
    return status === 'pending' || status === 'confirmed';
  }

  toggleExpand(id: string): void {
    const next = new Set(this.expandedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedIds.set(next);
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  async advance(order: Order): Promise<void> {
    const next = STATUS_NEXT[order.status];
    if (!next || !order.id) return;
    this.workingId.set(order.id);
    try {
      await this.orderService.updateStatus(order.id, next);
    } catch {
      this.error.set('Failed to update status.');
    } finally {
      this.workingId.set(null);
    }
  }

  async cancel(order: Order): Promise<void> {
    if (!confirm(`Cancel order ${order.orderNumber}?`)) return;
    if (!order.id) return;
    this.workingId.set(order.id);
    try {
      await this.orderService.updateStatus(order.id, 'cancelled');
    } catch {
      this.error.set('Failed to cancel order.');
    } finally {
      this.workingId.set(null);
    }
  }

  async togglePayment(order: Order): Promise<void> {
    if (!order.id) return;
    this.workingId.set(order.id);
    try {
      await this.orderService.updatePaymentStatus(
        order.id,
        order.paymentStatus === 'paid' ? 'unpaid' : 'paid',
      );
    } catch {
      this.error.set('Failed to update payment.');
    } finally {
      this.workingId.set(null);
    }
  }
}
