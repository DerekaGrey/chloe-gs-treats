import { Injectable } from '@angular/core';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { MenuItem } from '../models';

@Injectable({ providedIn: 'root' })
export class AdminMenuService {
  private readonly db = getFirestore();

  async save(data: Omit<MenuItem, 'id'>, id?: string): Promise<void> {
    if (id) {
      await setDoc(doc(this.db, 'menuItems', id), data);
    } else {
      await addDoc(collection(this.db, 'menuItems'), data);
    }
  }

  updateAvailability(id: string, available: boolean): Promise<void> {
    return updateDoc(doc(this.db, 'menuItems', id), { available });
  }

  delete(id: string): Promise<void> {
    return deleteDoc(doc(this.db, 'menuItems', id));
  }
}
