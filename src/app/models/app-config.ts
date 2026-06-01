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
  /** Required Missouri cottage-food disclaimer, shown across the site. */
  cottageFoodDisclaimer: string;
}
