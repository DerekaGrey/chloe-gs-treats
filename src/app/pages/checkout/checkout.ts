import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { CartService } from '../../services/cart.service';
import { ConfigService } from '../../services/config.service';
import { OrderService } from '../../services/order.service';
import { CentsPipe } from '../../shared/cents.pipe';
import { environment } from '../../../environments/environment';

// Minimal types for the Google Places Autocomplete widget
declare const google: {
  maps: {
    places: {
      Autocomplete: new (input: HTMLInputElement, opts?: object) => {
        addListener(event: string, fn: () => void): void;
        getPlace(): { formatted_address?: string };
      };
    };
    LatLng: new (lat: number, lng: number) => object;
    LatLngBounds: new (sw: object, ne: object) => object;
  };
};

declare const Square: {
  payments(applicationId: string, locationId: string): Promise<{
    card(): Promise<{
      attach(selector: string): Promise<void>;
      tokenize(): Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
      destroy(): void;
    }>;
  }>;
};

const DELIVERY_FEE_CENTS = 500;

const WEEKDAY_SLOTS = [
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
];

function buildWeekendSlots(): string[] {
  const slots: string[] = [];
  for (let h = 9; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m > 0) break;
      const hour12 = h > 12 ? h - 12 : h;
      const ampm = h < 12 ? 'AM' : 'PM';
      const mins = m === 0 ? '00' : '30';
      slots.push(`${hour12}:${mins} ${ampm}`);
    }
  }
  return slots;
}

const WEEKEND_SLOTS = buildWeekendSlots();

@Component({
  selector: 'app-checkout',
  imports: [ReactiveFormsModule, RouterLink, CentsPipe],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout implements OnInit, AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly cart = inject(CartService);
  private readonly config = inject(ConfigService);
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);

  readonly DELIVERY_FEE_CENTS = DELIVERY_FEE_CENTS;
  readonly lines = this.cart.lines;
  readonly subtotalCents = this.cart.subtotalCents;
  readonly cfg = computed(() => this.config.config);
  readonly minDate = computed(() => this.toInputDate(this.config.earliestPickupDate()));
  readonly submitting = signal(false);
  readonly cardError = signal('');
  readonly fulfillmentType = signal<'pickup' | 'delivery'>('pickup');

  readonly totalCents = computed(() =>
    this.subtotalCents() + (this.fulfillmentType() === 'delivery' ? DELIVERY_FEE_CENTS : 0)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private squareCard: any;
  private placesScriptLoaded = false;

  readonly form = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
    pickupDate: ['', [Validators.required, this.pickupDateValidator()]],
    deliveryTime: [''],
    deliveryAddress: [''],
    specialRequests: [''],
    wantsEmailConfirmation: [true],
  });

  constructor() {
    effect(() => {
      if (this.fulfillmentType() === 'delivery') {
        this.loadPlacesScript().then(() => {
          // Wait one tick for Angular to render the delivery address input
          setTimeout(() => this.initPlacesAutocomplete(), 0);
        });
      }
    });
  }

  private loadPlacesScript(): Promise<void> {
    if (this.placesScriptLoaded) return Promise.resolve();
    const existing = document.getElementById('google-places-script');
    if (existing) { this.placesScriptLoaded = true; return Promise.resolve(); }
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.id = 'google-places-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googlePlacesApiKey}&libraries=places`;
      script.onload = () => { this.placesScriptLoaded = true; resolve(); };
      document.head.appendChild(script);
    });
  }

  private initPlacesAutocomplete(): void {
    const input = document.getElementById('deliveryAddress') as HTMLInputElement | null;
    if (!input || typeof google === 'undefined') return;

    const columbiaCenter = new google.maps.LatLng(38.9517, -92.3341);
    const bounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(38.88, -92.45),
      new google.maps.LatLng(39.02, -92.20),
    );

    const autocomplete = new google.maps.places.Autocomplete(input, {
      bounds,
      strictBounds: false,
      componentRestrictions: { country: 'us' },
      types: ['address'],
    });

    void columbiaCenter;

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        this.form.controls.deliveryAddress.setValue(place.formatted_address);
      }
    });
  }

  get deliveryTimeSlots(): string[] {
    const dateVal = this.form.controls.pickupDate.value;
    if (!dateVal) return WEEKDAY_SLOTS;
    const dow = new Date(dateVal + 'T00:00:00').getDay();
    return (dow === 0 || dow === 6) ? WEEKEND_SLOTS : WEEKDAY_SLOTS;
  }

  setFulfillmentType(type: 'pickup' | 'delivery'): void {
    this.fulfillmentType.set(type);
    this.form.controls.deliveryTime.setValue('');
    this.form.controls.deliveryAddress.setValue('');
  }

  onDateChange(): void {
    this.form.controls.deliveryTime.setValue('');
  }

  ngOnInit(): void {
    if (this.lines().length === 0) {
      this.router.navigate(['/cart']);
    }
  }

  async ngAfterViewInit(): Promise<void> {
    if (this.lines().length === 0) return;

    if (typeof Square === 'undefined') {
      console.error('[checkout] Square SDK script did not load — check the tag in index.html.');
      this.cardError.set('Could not load the payment form. Please refresh and try again.');
      return;
    }

    try {
      const payments = await Square.payments(
        environment.square.applicationId,
        environment.square.locationId,
      );
      this.squareCard = await payments.card();
      await this.squareCard.attach('#card-container');
    } catch (err) {
      console.error('[checkout] Square card init failed:', err);
      this.cardError.set('Could not load the payment form. Please refresh and try again.');
    }
  }

  ngOnDestroy(): void {
    this.squareCard?.destroy();
  }

  private pickupDateValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const date = new Date(control.value + 'T00:00:00');
      return this.config.isValidPickupDate(date) ? null : { invalidPickupDate: true };
    };
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const isDelivery = this.fulfillmentType() === 'delivery';

    if (isDelivery && !v.deliveryTime) {
      this.form.controls.deliveryTime.markAsTouched();
      this.cardError.set('Please select a delivery time.');
      return;
    }
    if (isDelivery && !v.deliveryAddress?.trim()) {
      this.form.controls.deliveryAddress.markAsTouched();
      this.cardError.set('Please enter your delivery address.');
      return;
    }

    this.submitting.set(true);
    this.cardError.set('');

    try {
      if (!this.squareCard) {
        console.error('[checkout] Square card form never initialised.');
        this.cardError.set('Payment form did not load. Please refresh the page and try again.');
        return;
      }

      const tokenResult = await this.squareCard.tokenize();
      if (tokenResult.status !== 'OK') {
        console.error('[checkout] Tokenize failed:', tokenResult);
        this.cardError.set(
          tokenResult.errors?.[0]?.message ?? 'Card error. Please check your details.',
        );
        return;
      }

      const processPayment = httpsCallable<unknown, { orderNumber: string }>(
        getFunctions(),
        'processPayment',
      );
      const { data } = await processPayment({
        sourceId: tokenResult.token,
        customer: { name: v.name, email: v.email, phone: v.phone },
        pickupDate: new Date(v.pickupDate! + 'T00:00:00').toISOString(),
        fulfillmentType: this.fulfillmentType(),
        deliveryAddress: isDelivery ? v.deliveryAddress : undefined,
        deliveryTime: isDelivery ? v.deliveryTime : undefined,
        deliveryFeeCents: isDelivery ? DELIVERY_FEE_CENTS : 0,
        specialRequests: v.specialRequests || undefined,
        wantsEmailConfirmation: !!v.wantsEmailConfirmation,
        cartLines: this.cart.lines().map(l => ({
          menuItemId: l.item.id,
          nameSnapshot: l.item.name,
          packLabelSnapshot: l.pack.label,
          packQuantity: l.pack.quantity,
          packPriceCentsSnapshot: l.pack.priceCents,
          packCount: l.packCount,
          selectedOptions: l.selectedOptions,
          lineTotalCents: this.cart.lineTotalCents(l),
        })),
      });

      this.cart.clear();
      await this.router.navigate(['/order', data.orderNumber]);
    } catch (err) {
      console.error('[checkout] Payment failed:', err);
      const e = err as { code?: string; message?: string };
      this.cardError.set(
        e?.message
          ? `Payment failed: ${e.message}`
          : 'Payment failed. Please try again or use a different card.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  private toInputDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
