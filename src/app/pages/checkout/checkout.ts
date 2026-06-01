import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { CartService } from '../../services/cart.service';
import { ConfigService } from '../../services/config.service';
import { OrderService } from '../../services/order.service';
import { CentsPipe } from '../../shared/cents.pipe';

@Component({
  selector: 'app-checkout',
  imports: [ReactiveFormsModule, RouterLink, CentsPipe],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout implements OnInit {
  private fb = inject(FormBuilder);
  private cart = inject(CartService);
  private config = inject(ConfigService);
  private orders = inject(OrderService);
  private router = inject(Router);

  readonly lines = this.cart.lines;
  readonly subtotalCents = this.cart.subtotalCents;
  readonly cfg = this.config.config;

  /** Earliest selectable date as a yyyy-MM-dd string for the date input's `min`. */
  readonly minDate = this.toInputDate(this.config.earliestPickupDate());

  readonly form = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    pickupDate: ['', [Validators.required, this.pickupDateValidator()]],
    specialRequests: [''],
    wantsEmailConfirmation: [true],
  });

  ngOnInit(): void {
    // Can't check out an empty cart, so send them back to the menu.
    if (this.lines().length === 0) {
      this.router.navigate(['/cart']);
    }
  }

  /** Validator: the chosen date must pass the lead-time + blackout rules. */
  private pickupDateValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const date = new Date(control.value + 'T00:00:00');
      return this.config.isValidPickupDate(date) ? null : { invalidPickupDate: true };
    };
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const order = this.orders.createOrder({
      customer: { name: v.name!, email: v.email!, phone: v.phone || undefined },
      pickupDate: new Date(v.pickupDate! + 'T00:00:00'),
      specialRequests: v.specialRequests || undefined,
      wantsEmailConfirmation: !!v.wantsEmailConfirmation,
    });
    this.router.navigate(['/order', order.orderNumber]);
  }

  private toInputDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
