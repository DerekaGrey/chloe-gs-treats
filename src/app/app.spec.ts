import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App } from './app';
import { SEED_CONFIG } from './data/seed-config';
import { CartService } from './services/cart.service';
import { ConfigService } from './services/config.service';
import { IdleTimeoutService } from './services/idle-timeout.service';
import { NavigationHistoryService } from './services/navigation-history.service';

// The real services talk to Firebase (getAuth(), a live Firestore listener),
// which does not exist in a unit test. Replace them with fakes so this spec
// covers only the app shell itself.
describe('App', () => {
  const showWarning = signal(false);
  const staySignedIn = vi.fn();
  let historyCreated = 0;

  beforeEach(async () => {
    showWarning.set(false);
    staySignedIn.mockClear();
    historyCreated = 0;

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: IdleTimeoutService, useValue: { showWarning, staySignedIn } },
        { provide: ConfigService, useValue: { config: SEED_CONFIG } },
        { provide: CartService, useValue: { itemCount: signal(0) } },
        {
          provide: NavigationHistoryService,
          useFactory: () => {
            historyCreated++;
            return { backTo: vi.fn() };
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the site shell: header, main content area and footer', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-site-header')).not.toBeNull();
    expect(el.querySelector('main.app-main')).not.toBeNull();
    expect(el.querySelector('app-site-footer')).not.toBeNull();
  });

  it('hides the idle warning by default', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('.idle-warning')).toBeNull();
  });

  it('shows the idle warning, and "Stay signed in" resets the timer', async () => {
    const fixture = TestBed.createComponent(App);
    showWarning.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.idle-warning')?.textContent).toContain('signed out');

    (el.querySelector('.idle-stay-btn') as HTMLButtonElement).click();
    expect(staySignedIn).toHaveBeenCalledTimes(1);
  });

  it('creates the navigation history service at startup, so it sees every page the visitor opens', () => {
    // If only the first page using it created it, it would miss the menu visit that
    // "Back to Menu" has to return to.
    TestBed.createComponent(App);
    expect(historyCreated).toBe(1);
  });
});
