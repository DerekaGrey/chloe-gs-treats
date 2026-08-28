import { Injectable } from '@angular/core';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { AppConfig } from '../models';

@Injectable({ providedIn: 'root' })
export class AdminConfigService {
  private readonly db = getFirestore();

  save(config: AppConfig): Promise<void> {
    const { blackoutDates, ...rest } = config;
    return setDoc(doc(this.db, 'config', 'global'), {
      ...rest,
      blackoutDates: blackoutDates.map(d => Timestamp.fromDate(d)),
    });
  }
}
