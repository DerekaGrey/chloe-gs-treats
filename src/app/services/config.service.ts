import { Injectable } from '@angular/core';
import { AppConfig } from '../models';
import { SEED_CONFIG } from '../data/seed-config';

/** Site settings + pickup-date rules. Local for now; Firestore later. */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  get config(): AppConfig {
    return SEED_CONFIG;
  }

  /** Is the given date one the admin has blocked off? (date-only comparison) */
  isBlackout(date: Date): boolean {
    return this.config.blackoutDates.some((d) => this.sameDay(d, date));
  }

  /** Earliest valid pickup date = today + lead time, skipping blocked days. */
  earliestPickupDate(from: Date = new Date()): Date {
    const d = this.startOfDay(from);
    d.setDate(d.getDate() + this.config.defaultLeadTimeDays);
    while (this.isBlackout(d)) d.setDate(d.getDate() + 1);
    return d;
  }

  /** Validates a chosen pickup date against lead time + blocked days. */
  isValidPickupDate(date: Date): boolean {
    const chosen = this.startOfDay(date);
    if (chosen < this.earliestPickupDate()) return false;
    if (this.isBlackout(chosen)) return false;
    return true;
  }

  private sameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private startOfDay(d: Date): Date {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }
}
