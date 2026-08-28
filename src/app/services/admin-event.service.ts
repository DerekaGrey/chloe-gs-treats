import { Injectable } from '@angular/core';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { PopupEvent } from '../models';

type EventPayload = Omit<PopupEvent, 'id' | 'startsAt' | 'endsAt'> & {
  startsAt: Timestamp;
  endsAt: Timestamp;
};

@Injectable({ providedIn: 'root' })
export class AdminEventService {
  private readonly db = getFirestore();

  async save(event: Omit<PopupEvent, 'id'>, id?: string): Promise<void> {
    const payload: EventPayload = {
      ...event,
      startsAt: Timestamp.fromDate(event.startsAt),
      endsAt: Timestamp.fromDate(event.endsAt),
    };
    if (id) {
      await setDoc(doc(this.db, 'popupEvents', id), payload);
    } else {
      await addDoc(collection(this.db, 'popupEvents'), payload);
    }
  }

  cancel(id: string): Promise<void> {
    return updateDoc(doc(this.db, 'popupEvents', id), { status: 'cancelled' });
  }

  delete(id: string): Promise<void> {
    return deleteDoc(doc(this.db, 'popupEvents', id));
  }
}
