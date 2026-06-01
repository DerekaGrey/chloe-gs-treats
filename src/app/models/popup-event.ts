/**
 * A scheduled appearance of the popup stand (shown on the Schedule page).
 * Dates are plain JS Date for now; when Firebase is wired in these become
 * Firestore Timestamps.
 */
export interface PopupEvent {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location: string;
  description?: string;
  /**
   * What's offered AT THE STAND that day, with stand pricing. This is separate from
   * the online Shop menu. The stand sells small/grab-and-go (cookie 3-packs, single
   * scones/treats), while online is for larger pack orders.
   */
  standMenu?: StandMenuEntry[];
  photoUrls?: string[];
  status: 'scheduled' | 'cancelled';
}

/** One line on the stand's planned-menu poster. */
export interface StandMenuEntry {
  name: string;
  priceLabel: string; // free-form, e.g. "3 for $6" or "$3 each"
}
