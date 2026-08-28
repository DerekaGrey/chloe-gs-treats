import { Injectable, signal } from '@angular/core';
import {
  getFirestore,
  doc,
  onSnapshot,
  DocumentSnapshot,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { AppConfig } from '../models';
import { SEED_CONFIG } from '../data/seed-config';

function docToConfig(snap: DocumentSnapshot<DocumentData>): AppConfig {
  const d = snap.data()!;
  return {
    brandName: d['brandName'] ?? SEED_CONFIG.brandName,
    defaultLeadTimeDays: d['defaultLeadTimeDays'] ?? 3,
    blackoutDates: ((d['blackoutDates'] ?? []) as Timestamp[]).map(t => t.toDate()),
    pickupLocation: d['pickupLocation'] ?? SEED_CONFIG.pickupLocation,
    contactEmail: d['contactEmail'] ?? SEED_CONFIG.contactEmail,
    taxRatePercent: d['taxRatePercent'] ?? 0,
    cottageFoodDisclaimer: d['cottageFoodDisclaimer'] ?? SEED_CONFIG.cottageFoodDisclaimer,
  };
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  // Seed config is the initial value so the UI is never blank while Firestore loads.
  private readonly _config = signal<AppConfig>(SEED_CONFIG);

  constructor() {
    const db = getFirestore();
    onSnapshot(doc(db, 'config', 'global'), snap => {
      if (snap.exists()) this._config.set(docToConfig(snap));
    });
  }

  get config(): AppConfig {
    return this._config();
  }

  isBlackout(date: Date): boolean {
    return this.config.blackoutDates.some(d => this.sameDay(d, date));
  }

  earliestPickupDate(from: Date = new Date()): Date {
    const d = this.startOfDay(from);
    d.setDate(d.getDate() + this.config.defaultLeadTimeDays);
    while (this.isBlackout(d)) d.setDate(d.getDate() + 1);
    return d;
  }

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
