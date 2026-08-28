import { Injectable } from '@angular/core';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { CartLine, CustomerInfo, Order, OrderLineItem } from '../models';
import { CartService } from './cart.service';

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
    deliveryTime: data['deliveryTime'],
    deliveryFeeCents: data['deliveryFeeCents'] ?? 0,
    taxCents: data['taxCents'] ?? 0,
    taxRatePercent: data['taxRatePercent'] ?? 0,
    tipCents: data['tipCents'] ?? 0,
    specialRequests: data['specialRequests'],
    status: data['status'],
    paymentMethod: data['paymentMethod'],
    paymentStatus: data['paymentStatus'],
    squarePaymentId: data['squarePaymentId'],
    wantsEmailConfirmation: data['wantsEmailConfirmation'] ?? false,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
  };
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private cart: CartService) {}

  private toLineItems(lines: CartLine[]): OrderLineItem[] {
    return lines.map(l => ({
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

  async createOrder(input: {
    customer: CustomerInfo;
    pickupDate: Date;
    fulfillmentType: 'pickup' | 'delivery';
    deliveryAddress?: string;
    deliveryUnit?: string;
    deliveryTime?: string;
    deliveryFeeCents: number;
    taxCents: number;
    taxRatePercent: number;
    tipCents: number;
    specialRequests?: string;
    wantsEmailConfirmation: boolean;
  }): Promise<Order> {
    const db = getFirestore();
    const lines = this.cart.lines();
    const items = this.toLineItems(lines);
    const subtotalCents = items.reduce((s, i) => s + i.lineTotalCents, 0);
    const totalCents =
      subtotalCents + input.taxCents + input.deliveryFeeCents + input.tipCents;
    const orderNumber = this.nextOrderNumber();

    await addDoc(collection(db, 'orders'), {
      orderNumber,
      customer: input.customer,
      isGuest: true,
      items,
      subtotalCents,
      totalCents,
      pickupDate: input.pickupDate,
      fulfillmentType: input.fulfillmentType,
      deliveryAddress: input.deliveryAddress ?? null,
      deliveryUnit: input.deliveryUnit ?? null,
      deliveryTime: input.deliveryTime ?? null,
      deliveryFeeCents: input.deliveryFeeCents,
      taxCents: input.taxCents,
      taxRatePercent: input.taxRatePercent,
      tipCents: input.tipCents,
      specialRequests: input.specialRequests ?? null,
      status: 'pending',
      paymentMethod: 'pay_at_pickup',
      paymentStatus: 'unpaid',
      wantsEmailConfirmation: input.wantsEmailConfirmation,
      createdAt: new Date(),
    });

    this.cart.clear();

    return {
      orderNumber,
      customer: input.customer,
      items,
      subtotalCents,
      totalCents,
      pickupDate: input.pickupDate,
      fulfillmentType: input.fulfillmentType,
      deliveryAddress: input.deliveryAddress,
      deliveryUnit: input.deliveryUnit,
      deliveryTime: input.deliveryTime,
      deliveryFeeCents: input.deliveryFeeCents,
      taxCents: input.taxCents,
      taxRatePercent: input.taxRatePercent,
      tipCents: input.tipCents,
      specialRequests: input.specialRequests,
      status: 'pending',
      paymentMethod: 'pay_at_pickup',
      paymentStatus: 'unpaid',
      wantsEmailConfirmation: input.wantsEmailConfirmation,
      createdAt: new Date(),
    };
  }

  async getByNumber(orderNumber: string): Promise<Order | undefined> {
    const db = getFirestore();
    const q = query(collection(db, 'orders'), where('orderNumber', '==', orderNumber));
    const snap = await getDocs(q);
    return snap.empty ? undefined : docToOrder(snap.docs[0]);
  }

  private nextOrderNumber(): string {
    return `CG-${Math.floor(1000 + Math.random() * 9000)}`;
  }
}
