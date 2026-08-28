/**
 * A customer order. Line items SNAPSHOT the name/price/options at purchase time
 * so editing the menu later never changes past orders.
 */
export interface Order {
  id?: string;
  orderNumber: string;            // human-friendly, e.g. "CG-1042"
  customer: CustomerInfo;
  items: OrderLineItem[];
  subtotalCents: number;
  totalCents: number;
  pickupDate: Date;
  fulfillmentType: 'pickup' | 'delivery';
  deliveryAddress?: string;
  deliveryUnit?: string;          // apt/suite/unit, kept separate so it can be
                                  // shown on its own line for the driver
  deliveryTime?: string;          // e.g. "11:30 AM"
  deliveryFeeCents: number;
  taxCents: number;               // on the subtotal only, never the fee or tip
  taxRatePercent: number;         // snapshotted so a later rate change cannot
                                  // rewrite what a past order was charged
  tipCents: number;               // calculated on the subtotal, not the fee
  specialRequests?: string;
  status: OrderStatus;
  paymentMethod: 'pay_at_pickup' | 'square';
  paymentStatus: 'unpaid' | 'paid';
  squarePaymentId?: string;       // set by the processPayment Cloud Function
  wantsEmailConfirmation: boolean;
  createdAt: Date;
}

export interface CustomerInfo {
  name: string;
  email: string;
  phone?: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'baking'
  | 'ready'
  | 'pickedup'
  | 'cancelled';

export interface OrderLineItem {
  menuItemId: string;
  nameSnapshot: string;
  packLabelSnapshot: string;     // "6"
  packQuantity: number;          // 6
  packPriceCentsSnapshot: number;// price of one pack at purchase time
  packCount: number;             // how many packs ordered
  selectedOptions: SelectedOption[];
  lineTotalCents: number;
}

export interface SelectedOption {
  groupName: string;     // "Icing"
  optionLabel: string;   // "Cream Cheese Icing"
  priceCentsDelta: number;
}
