import { Injectable } from '@angular/core';
import { PopupEvent } from '../models';
import { SEED_EVENTS } from '../data/seed-events';

/** Popup-schedule data. Local for now; Firestore later. */
@Injectable({ providedIn: 'root' })
export class EventService {
  /** Upcoming, non-cancelled events sorted by start time. */
  getUpcoming(): PopupEvent[] {
    const now = new Date();
    return SEED_EVENTS
      .filter((e) => e.status === 'scheduled' && e.endsAt >= now)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  /** The very next upcoming event, if any (for the home-page highlight). */
  getNext(): PopupEvent | undefined {
    return this.getUpcoming()[0];
  }
}
