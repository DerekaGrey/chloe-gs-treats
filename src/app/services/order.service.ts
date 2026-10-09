import { Injectable } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Order } from '../models';

/**
 * Orders hold customer PII, so the browser cannot read the orders collection.
 * The confirmation page instead asks the getOrderConfirmation Cloud Function,
 * passing the unguessable order ID that processPayment returned at checkout.
 * Orders are only ever created by that function.
 */
@Injectable({ providedIn: 'root' })
export class OrderService {
  async getConfirmation(orderId: string): Promise<Order | undefined> {
    try {
      const call = httpsCallable<{ orderId: string }, Record<string, unknown>>(
        getFunctions(),
        'getOrderConfirmation',
      );
      const { data } = await call({ orderId });
      return {
        ...data,
        pickupDate: new Date(data['pickupDate'] as string),
        createdAt: new Date(data['createdAt'] as string),
        deliveryAddress: (data['deliveryAddress'] as string | null) ?? undefined,
        deliveryUnit: (data['deliveryUnit'] as string | null) ?? undefined,
        deliveryTime: (data['deliveryTime'] as string | null) ?? undefined,
        specialRequests: (data['specialRequests'] as string | null) ?? undefined,
      } as Order;
    } catch {
      return undefined;
    }
  }
}
