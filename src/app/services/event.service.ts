import { Injectable, signal } from '@angular/core';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { PopupEvent } from '../models';

function docToEvent(d: QueryDocumentSnapshot<DocumentData>): PopupEvent {
  const data = d.data();
  return {
    id: d.id,
    title: data['title'],
    startsAt: (data['startsAt'] as Timestamp).toDate(),
    endsAt: (data['endsAt'] as Timestamp).toDate(),
    location: data['location'],
    description: data['description'],
    standMenu: data['standMenu'],
    photoUrls: data['photoUrls'] ?? [],
    status: data['status'],
  };
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly _events = signal<PopupEvent[]>([]);

  constructor() {
    const db = getFirestore();
    onSnapshot(
      query(collection(db, 'popupEvents'), orderBy('startsAt')),
      snap => this._events.set(snap.docs.map(docToEvent)),
    );
  }

  getUpcoming(): PopupEvent[] {
    const now = new Date();
    return this._events()
      .filter(e => e.status === 'scheduled' && e.endsAt >= now)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  getNext(): PopupEvent | undefined {
    return this.getUpcoming()[0];
  }
}
