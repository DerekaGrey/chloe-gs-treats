import { Injectable, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './auth.service';

// TODO (future): enforce server-side via Firebase custom tokens with short expiry
// + a Cloud Function token-refresh server. Current client-side timer can be
// bypassed via DevTools, acceptable for a single-admin bakery app.
const TIMEOUT_MS   = 30 * 60 * 1000; // 30 minutes
const WARN_BEFORE_MS = 2 * 60 * 1000; // warn 2 minutes before signing out

const ACTIVITY_EVENTS = ['mousemove', 'click', 'keydown', 'touchstart', 'scroll'] as const;

@Injectable({ providedIn: 'root' })
export class IdleTimeoutService {
  private readonly _showWarning = signal(false);
  readonly showWarning = this._showWarning.asReadonly();

  private active = false;
  private timeoutHandle?: ReturnType<typeof setTimeout>;
  private warnHandle?: ReturnType<typeof setTimeout>;
  private readonly onActivity = () => this.resetTimer();

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {
    // Auto-stop when navigating away from protected admin pages
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) {
        const onProtectedAdmin = e.url.startsWith('/admin') && !e.url.startsWith('/admin/login');
        if (!onProtectedAdmin) this.stop();
      }
    });
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    ACTIVITY_EVENTS.forEach(ev =>
      document.addEventListener(ev, this.onActivity, { passive: true }),
    );
    this.scheduleTimers();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    ACTIVITY_EVENTS.forEach(ev =>
      document.removeEventListener(ev, this.onActivity),
    );
    clearTimeout(this.timeoutHandle);
    clearTimeout(this.warnHandle);
    this._showWarning.set(false);
  }

  staySignedIn(): void {
    this._showWarning.set(false);
    this.resetTimer();
  }

  private resetTimer(): void {
    clearTimeout(this.timeoutHandle);
    clearTimeout(this.warnHandle);
    this._showWarning.set(false);
    this.scheduleTimers();
  }

  private scheduleTimers(): void {
    this.warnHandle = setTimeout(() => {
      this._showWarning.set(true);
    }, TIMEOUT_MS - WARN_BEFORE_MS);

    this.timeoutHandle = setTimeout(async () => {
      this.stop();
      await this.auth.signOut();
      await this.router.navigate(['/admin/login'], { queryParams: { reason: 'timeout' } });
    }, TIMEOUT_MS);
  }
}
