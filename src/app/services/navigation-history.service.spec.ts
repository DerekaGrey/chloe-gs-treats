import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationHistoryService, pathOf } from './navigation-history.service';

@Component({ template: '' })
class Page {}

describe('pathOf', () => {
  it('drops the query string and the fragment', () => {
    expect(pathOf('/menu?category=cookies')).toBe('/menu');
    expect(pathOf('/menu#top')).toBe('/menu');
    expect(pathOf('/menu/abc?x=1#y')).toBe('/menu/abc');
    expect(pathOf('/menu')).toBe('/menu');
  });
});

describe('NavigationHistoryService.backTo', () => {
  let history: NavigationHistoryService;
  let router: Router;
  let back: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Page },
          { path: 'menu', component: Page },
          { path: 'menu/:id', component: Page },
          { path: 'cart', component: Page },
        ]),
        provideLocationMocks(),
      ],
    });
    // Created first so it sees every navigation, as it does in the real app.
    history = TestBed.inject(NavigationHistoryService);
    router = TestBed.inject(Router);
    back = vi.spyOn(TestBed.inject(Location), 'back');
  });

  it('goes back in history when the previous page was the menu (so the scroll position is restored)', async () => {
    await router.navigateByUrl('/menu');
    await router.navigateByUrl('/menu/abc');

    history.backTo('/menu');

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('recognises the menu even with a query string on it', async () => {
    await router.navigateByUrl('/menu?category=cookies');
    await router.navigateByUrl('/menu/abc');

    history.backTo('/menu');

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('navigates to the menu instead when the visitor came from somewhere else', async () => {
    await router.navigateByUrl('/');
    await router.navigateByUrl('/menu/abc');

    history.backTo('/menu');
    await new Promise((r) => setTimeout(r));

    expect(back).not.toHaveBeenCalled();
    expect(router.url).toBe('/menu');
  });

  it('navigates to the menu when the page was opened directly (no previous page)', async () => {
    await router.navigateByUrl('/menu/abc');

    history.backTo('/menu');
    await new Promise((r) => setTimeout(r));

    expect(back).not.toHaveBeenCalled();
    expect(router.url).toBe('/menu');
  });

  it('does not treat another item page as the menu', async () => {
    await router.navigateByUrl('/menu/one');
    await router.navigateByUrl('/menu/two');

    history.backTo('/menu');
    await new Promise((r) => setTimeout(r));

    expect(back).not.toHaveBeenCalled();
    expect(router.url).toBe('/menu');
  });

  it('from the cart: goes back if the cart was opened from the menu, otherwise goes to the menu', async () => {
    await router.navigateByUrl('/menu');
    await router.navigateByUrl('/cart');
    history.backTo('/menu');
    expect(back).toHaveBeenCalledTimes(1);

    back.mockClear();
    await router.navigateByUrl('/menu/abc');
    await router.navigateByUrl('/cart');
    history.backTo('/menu');
    await new Promise((r) => setTimeout(r));
    expect(back).not.toHaveBeenCalled();
    expect(router.url).toBe('/menu');
  });
});
