/**
 * Site-wide settings (later editable from the admin Settings screen, stored in
 * Firestore as a single `config/global` document).
 */
export interface AppConfig {
  brandName: string;
  /** Minimum days between ordering and pickup. */
  defaultLeadTimeDays: number;
  /** Admin-blocked pickup dates (vacations / sold-out). Any other day is allowed. */
  blackoutDates: Date[];
  pickupLocation: string;
  contactEmail: string;
  /**
   * Sales tax rate as a percent, e.g. 7.975 for 7.975%. The Cloud Function is the
   * authority — it re-reads this and computes the charge, so a tampered client
   * cannot change what a customer is billed. 0 disables tax.
   */
  taxRatePercent: number;
  /** Required Missouri cottage-food disclaimer, shown across the site. */
  cottageFoodDisclaimer: string;
}
