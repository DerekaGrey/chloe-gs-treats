import { Injectable, signal } from '@angular/core';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
  UserCredential,
} from 'firebase/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _auth = getAuth();
  private readonly _user = signal<User | null>(null);
  private readonly _isAdmin = signal(false);

  constructor() {
    onAuthStateChanged(this._auth, async (user) => {
      this._user.set(user);
      if (user) {
        const { claims } = await user.getIdTokenResult();
        this._isAdmin.set(claims['admin'] === true);
      } else {
        this._isAdmin.set(false);
      }
    });
  }

  get user(): User | null {
    return this._user();
  }

  get isAdmin(): boolean {
    return this._isAdmin();
  }

  signIn(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this._auth, email, password);
  }

  signOut(): Promise<void> {
    return firebaseSignOut(this._auth);
  }
}
