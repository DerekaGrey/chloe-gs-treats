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

/**
 * Minimal types for the Google Places Autocomplete Data API.
 *
 * The legacy `google.maps.places.Autocomplete` widget is unavailable to Cloud
 * projects that enabled Places after 2025-03-01, so we call the newer
 * AutocompleteSuggestion API and render our own dropdown instead.
 */
interface PlacePrediction {
  text: { text: string };
  mainText?: { text: string };
  secondaryText?: { text: string };
}

interface PlacesLib {
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(request: object): Promise<{
      suggestions: { placePrediction: PlacePrediction | null }[];
    }>;
  };
}

declare const google: {
  maps: {
    places?: Partial<PlacesLib>;
    importLibrary?(name: string): Promise<unknown>;
  };
};

// Bias suggestions toward Columbia, MO (roughly a 30km radius around downtown)
const COLUMBIA_CENTER = { lat: 38.9517, lng: -92.3341 };
const COLUMBIA_RADIUS_M = 30_000;

// Cost guardrails: don't call the API on every keystroke
const ADDRESS_MIN_CHARS = 4;
const ADDRESS_DEBOUNCE_MS = 350;

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

// Tips are calculated on the subtotal only. The delivery fee already covers
// the trip, so tipping on top of it would be double-charging for the same thing.
const TIP_PERCENTS = [15, 18, 20];

// Sanity ceiling on a custom tip. Must match the cap in processPayment,
// otherwise the total shown here would not be the amount actually charged.
const MAX_TIP_CENTS = 100_000;

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
  readonly addressSuggestions = signal<string[]>([]);

  readonly TIP_PERCENTS = TIP_PERCENTS;
  /** Selected preset, or 'custom'. null means no tip. */
  readonly tipChoice = signal<number | 'custom' | null>(null);
  readonly customTipDollars = signal('');

  readonly tipCents = computed(() => {
    const choice = this.tipChoice();
    if (choice === null) return 0;
    if (choice === 'custom') {
      const dollars = parseFloat(this.customTipDollars());
      if (!isFinite(dollars) || dollars <= 0) return 0;
      return Math.min(Math.round(dollars * 100), MAX_TIP_CENTS);
    }
    return Math.round((this.subtotalCents() * choice) / 100);
  });

  readonly deliveryFeeCents = computed(() =>
    this.fulfillmentType() === 'delivery' ? DELIVERY_FEE_CENTS : 0
  );

  /**
   * Tax on the food only. processPayment recomputes this from Firestore and
   * rejects the charge if the two disagree, so this must use the same base and
   * rounding: subtotal only, excluding the delivery fee and the tip.
   */
  readonly taxCents = computed(() =>
    Math.round((this.subtotalCents() * this.cfg().taxRatePercent) / 100)
  );

  readonly totalCents = computed(() =>
    this.subtotalCents() + this.taxCents() + this.deliveryFeeCents() + this.tipCents()
  );

  /** Dollar preview shown under each preset button. */
  tipPreviewCents(percent: number): number {
    return Math.round((this.subtotalCents() * percent) / 100);
  }

  setTipChoice(choice: number | 'custom' | null): void {
    this.tipChoice.set(choice);
    if (choice !== 'custom') this.customTipDollars.set('');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private squareCard: any;
  private placesLib?: Promise<PlacesLib>;
  private addressSessionToken?: object;
  private addressDebounceId?: ReturnType<typeof setTimeout>;

  readonly form = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
    pickupDate: ['', [Validators.required, this.pickupDateValidator()]],
    deliveryTime: [''],
    deliveryAddress: [''],
    deliveryUnit: [''],
    specialRequests: [''],
    wantsEmailConfirmation: [true],
  });

  constructor() {
    // Warm the Places library as soon as delivery is picked so the first
    // keystroke doesn't wait on a script download.
    effect(() => {
      if (this.fulfillmentType() === 'delivery') {
        void this.loadPlaces().catch(err =>
          console.error('[checkout] Places library failed to load:', err),
        );
      }
    });
  }

  private loadPlaces(): Promise<PlacesLib> {
    this.placesLib ??= new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('google-places-script');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Places script failed')));
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-places-script';
      script.async = true;
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${environment.googlePlacesApiKey}` +
        `&v=weekly&libraries=places`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Places script failed'));
      document.head.appendChild(script);
    }).then(() => {
      // `libraries=places` populates google.maps.places at load time.
      // importLibrary only exists under Google's inline bootstrap loader,
      // so it is a fallback rather than the primary path.
      if (google.maps.places?.AutocompleteSuggestion) {
        return google.maps.places as PlacesLib;
      }
      if (typeof google.maps.importLibrary === 'function') {
        return google.maps.importLibrary('places') as Promise<PlacesLib>;
      }
      throw new Error('Places library unavailable: enable Places API (New) for this key');
    });

    // Don't cache a failure, otherwise the field stays broken for the rest of
    // the session even once the problem clears.
    this.placesLib.catch(() => { this.placesLib = undefined; });

    return this.placesLib;
  }

  onAddressInput(value: string): void {
    clearTimeout(this.addressDebounceId);
    if (value.trim().length < ADDRESS_MIN_CHARS) {
      this.addressSuggestions.set([]);
      return;
    }
    this.addressDebounceId = setTimeout(
      () => void this.fetchAddressSuggestions(value.trim()),
      ADDRESS_DEBOUNCE_MS,
    );
  }

  private async fetchAddressSuggestions(input: string): Promise<void> {
    try {
      const places = await this.loadPlaces();
      this.addressSessionToken ??= new places.AutocompleteSessionToken();

      const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: this.addressSessionToken,
        includedRegionCodes: ['us'],
        locationBias: { center: COLUMBIA_CENTER, radius: COLUMBIA_RADIUS_M },
      });

      this.addressSuggestions.set(
        suggestions
          .map(s => s.placePrediction?.text.text)
          .filter((t): t is string => !!t)
          .slice(0, 5),
      );
    } catch (err) {
      // A failed lookup should never block checkout: the field still accepts
      // free text, we just stop showing suggestions.
      console.error('[checkout] Address lookup failed:', err);
      this.addressSuggestions.set([]);
    }
  }

  selectAddress(address: string): void {
    this.form.controls.deliveryAddress.setValue(address);
    this.addressSuggestions.set([]);
    // A session ends at selection; the next lookup starts a fresh one.
    this.addressSessionToken = undefined;
  }

  hideAddressSuggestions(): void {
    // Delay so a click on a suggestion lands before the list is removed.
    setTimeout(() => this.addressSuggestions.set([]), 150);
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
    this.form.controls.deliveryUnit.setValue('');
    this.addressSuggestions.set([]);
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
    clearTimeout(this.addressDebounceId);
    this.squareCard?.destroy();
  }

  private pickupDateValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const date = new Date(control.value + 'T00:00:00');
      return this.config.isValidPickupDate(date) ? null : { invalidPickupDate: true };
    };
  }

  /**
   * Field errors render next to their field, but the Pay button is at the
   * bottom of a long form, so an error on an early field lands off-screen and
   * the button looks broken. Say something at the button and jump to the
   * offending field.
   */
  private reportInvalidForm(): void {
    this.form.markAllAsTouched();

    const firstInvalid = Object.keys(this.form.controls).find(
      key => this.form.get(key)?.invalid,
    );

    this.cardError.set(
      firstInvalid === 'pickupDate'
        ? 'Please choose an available date above before paying.'
        : 'Please fill in the highlighted fields above before paying.',
    );

    if (firstInvalid) {
      const el = document.getElementById(firstInvalid);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    }
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;

    if (this.form.invalid) {
      this.reportInvalidForm();
      return;
    }

    const v = this.form.getRawValue();
    const isDelivery = this.fulfillmentType() === 'delivery';

    if (isDelivery && !v.deliveryTime) {
      this.form.controls.deliveryTime.markAsTouched();
      this.cardError.set('Please select a delivery time above.');
      document.querySelector('.time-grid')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }
    if (isDelivery && !v.deliveryAddress?.trim()) {
      this.form.controls.deliveryAddress.markAsTouched();
      this.cardError.set('Please enter your delivery address above.');
      const el = document.getElementById('deliveryAddress');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
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
        deliveryUnit: isDelivery ? v.deliveryUnit?.trim() || undefined : undefined,
        deliveryTime: isDelivery ? v.deliveryTime : undefined,
        deliveryFeeCents: isDelivery ? DELIVERY_FEE_CENTS : 0,
        taxCents: this.taxCents(),
        tipCents: this.tipCents(),
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
