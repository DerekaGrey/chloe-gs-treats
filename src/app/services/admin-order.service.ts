import { Injectable, signal } from '@angular/core';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { Order, OrderStatus } from '../models';

function docToOrder(d: QueryDocumentSnapshot<DocumentData>): Order {
  const data = d.data();
  return {
    id: d.id,
    orderNumber: data['orderNumber'],
    customer: data['customer'],
    items: data['items'] ?? [],
    subtotalCents: data['subtotalCents'],
    totalCents: data['totalCents'],
    pickupDate: (data['pickupDate'] as Timestamp).toDate(),
    fulfillmentType: data['fulfillmentType'] ?? 'pickup',
    deliveryAddress: data['deliveryAddress'],
    deliveryUnit: data['deliveryUnit'],
    tipCents: data['tipCents'] ?? 0,
    deliveryTime: data['deliveryTime'],
    deliveryFeeCents: data['deliveryFeeCents'] ?? 0,
    specialRequests: data['specialRequests'],
    status: data['status'],
    paymentMethod: data['paymentMethod'],
    paymentStatus: data['paymentStatus'],
    wantsEmailConfirmation: data['wantsEmailConfirmation'] ?? false,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
  };
}

@Injectable({ providedIn: 'root' })
export class AdminOrderService {
  private readonly db = getFirestore();
  private readonly _orders = signal<Order[]>([]);

  constructor() {
    onSnapshot(
      query(collection(this.db, 'orders'), orderBy('createdAt', 'desc')),
      snap => this._orders.set(snap.docs.map(docToOrder)),
    );
  }

  getAll(): Order[] {
    return this._orders();
  }

  updateStatus(id: string, status: OrderStatus): Promise<void> {
    return updateDoc(doc(this.db, 'orders', id), { status });
  }

  updatePaymentStatus(id: string, paymentStatus: 'paid' | 'unpaid'): Promise<void> {
    return updateDoc(doc(this.db, 'orders', id), { paymentStatus });
  }
}
