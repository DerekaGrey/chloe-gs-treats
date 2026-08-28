import { Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfigService } from '../../../../services/config.service';
import { AdminConfigService } from '../../../../services/admin-config.service';

@Component({
  selector: 'app-config-editor',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './config-editor.html',
  styleUrl: './config-editor.scss',
})
export class ConfigEditor implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly configService = inject(ConfigService);
  private readonly adminConfigService = inject(AdminConfigService);

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');

  form!: FormGroup;
  blackoutDates: Date[] = [];
  newBlackoutDate = '';

  ngOnInit(): void {
    this.form = this.fb.group({
      contactEmail: ['', [Validators.required, Validators.email]],
      pickupLocation: ['', Validators.required],
      defaultLeadTimeDays: [3, [Validators.required, Validators.min(1), Validators.max(30)]],
      cottageFoodDisclaimer: ['', Validators.required],
      taxRatePercent: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    });

    const config = this.configService.config;
    this.blackoutDates = [...config.blackoutDates].sort((a, b) => a.getTime() - b.getTime());
    this.form.patchValue({
      contactEmail: config.contactEmail,
      pickupLocation: config.pickupLocation,
      defaultLeadTimeDays: config.defaultLeadTimeDays,
      cottageFoodDisclaimer: config.cottageFoodDisclaimer,
      taxRatePercent: config.taxRatePercent,
    });
  }

  // ── Blackout dates ────────────────────────────────────────────────────────

  addBlackoutDate(): void {
    if (!this.newBlackoutDate) return;
    // Parse at noon local time to avoid UTC-offset date shifts
    const date = new Date(`${this.newBlackoutDate}T12:00:00`);
    if (isNaN(date.getTime())) return;
    const alreadyAdded = this.blackoutDates.some(d => this.sameDay(d, date));
    if (!alreadyAdded) {
      this.blackoutDates = [...this.blackoutDates, date].sort((a, b) => a.getTime() - b.getTime());
    }
    this.newBlackoutDate = '';
  }

  removeBlackoutDate(index: number): void {
    this.blackoutDates = this.blackoutDates.filter((_, i) => i !== index);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  private sameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saved.set(false);
    this.error.set('');

    try {
      const v = this.form.getRawValue();
      await this.adminConfigService.save({
        brandName: this.configService.config.brandName,
        contactEmail: v['contactEmail'],
        pickupLocation: v['pickupLocation'],
        defaultLeadTimeDays: Number(v['defaultLeadTimeDays']),
        cottageFoodDisclaimer: v['cottageFoodDisclaimer'],
        taxRatePercent: Number(v['taxRatePercent']),
        blackoutDates: this.blackoutDates,
      });
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 3000);
    } catch {
      this.error.set('Failed to save settings. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
