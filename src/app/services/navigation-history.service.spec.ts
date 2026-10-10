import { Location, ViewportScroller } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Event, NavigationEnd, Router, Scroll, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
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

// In the real app the router's scroller emits a Scroll event shortly after every
// navigation and then scrolls the new page to the top. TestBed never starts that scroller,
// so these tests do both parts themselves, and run the two possible subscription orders
// (the router's scroller before or after the service) because the result must not depend on it.
describe.each([
  ['router scroller subscribed BEFORE the service', true],
  ['router scroller subscribed AFTER the service', false],
])('NavigationHistoryService.backTo (%s)', (_name, routerScrollerFirst) => {
  let history: NavigationHistoryService;
  let router: Router;
  let back: ReturnType<typeof vi.spyOn>;
  let scrollY = 0; // the page's current vertical scroll, moved by the tests like a visitor would
  let lastNavigationEnd: NavigationEnd;
  const scrollToPosition = vi.fn();

  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  /** What the router's scroller does shortly after a navigation finishes. */
  const emitScroll = () =>
    (router.events as unknown as Subject<Event>).next(new Scroll(lastNavigationEnd, null, null));

  /** Navigate (as a link click would), then let the router's scroller run. */
  const go = async (url: string) => {
    await router.navigateByUrl(url);
    emitScroll();
  };

  /** Click "Back to Menu" / "Keep Shopping": the service navigates, then the scroller runs. */
  const clickBackToMenu = async () => {
    history.backTo('/menu');
    await settle(); // the navigation finishes
    emitScroll();
    await settle(); // the deferred restore runs
  };

  const startRouterScroller = () =>
    router.events.subscribe((event) => {
      if (event instanceof Scroll) scrollToPosition([0, 0]);
    });

  beforeEach(() => {
    scrollY = 0;
    scrollToPosition.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Page },
          { path: 'menu', component: Page },
          { path: 'menu/:id', component: Page },
          { path: 'cart', component: Page },
        ]),
        provideLocationMocks(),
        {
          provide: ViewportScroller,
          useValue: {
            getScrollPosition: () => [0, scrollY],
            scrollToPosition,
            setHistoryScrollRestoration: vi.fn(),
            setOffset: vi.fn(),
            scrollToAnchor: vi.fn(),
          },
        },
      ],
    });
    router = TestBed.inject(Router);
    router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) lastNavigationEnd = event;
    });
    if (routerScrollerFirst) startRouterScroller();
    history = TestBed.inject(NavigationHistoryService); // created before any navigation, as App does
    if (!routerScrollerFirst) startRouterScroller();
    back = vi.spyOn(TestBed.inject(Location), 'back');
  });

  describe('straight back from the target (menu -> item)', () => {
    it('goes back in history, which restores the scroll position', async () => {
      await go('/menu');
      await go('/menu/abc');

      history.backTo('/menu');

      expect(back).toHaveBeenCalledTimes(1);
    });

    it('recognises the menu even with a query string on it', async () => {
      await go('/menu?category=cookies');
      await go('/menu/abc');

      history.backTo('/menu');

      expect(back).toHaveBeenCalledTimes(1);
    });
  });

  describe('a longer route (menu -> item -> cart -> Keep Shopping)', () => {
    it('opens the menu and scrolls to where the visitor was on it', async () => {
      scrollY = 640; // scrolled down the menu
      await go('/menu');
      await go('/menu/abc'); // leaving the menu at 640
      scrollY = 50; // a little way down the item page
      await go('/cart'); // "Add to cart" lands here
      scrollY = 0;

      await clickBackToMenu(); // "Keep Shopping"

      expect(back).not.toHaveBeenCalled(); // history cannot do this in one step
      expect(router.url).toBe('/menu');
      expect(scrollToPosition).toHaveBeenLastCalledWith([0, 640]);
    });

    it('restores the position from the menu, not from the item page in between', async () => {
      scrollY = 900;
      await go('/menu');
      await go('/menu/abc');
      scrollY = 120;
      await go('/cart');

      await clickBackToMenu();

      expect(scrollToPosition).toHaveBeenLastCalledWith([0, 900]);
      expect(scrollToPosition).not.toHaveBeenLastCalledWith([0, 120]);
    });

    it('works from the item page too when the visitor did not come straight from the menu', async () => {
      scrollY = 700;
      await go('/menu');
      await go('/cart');
      scrollY = 0;
      await go('/menu/abc');

      await clickBackToMenu();

      expect(back).not.toHaveBeenCalled();
      expect(scrollToPosition).toHaveBeenLastCalledWith([0, 700]);
    });

    it('uses the position from the most recent visit to the menu', async () => {
      scrollY = 300;
      await go('/menu');
      await go('/menu/abc'); // leaving the menu at 300
      await go('/cart');
      await clickBackToMenu();
      expect(scrollToPosition).toHaveBeenLastCalledWith([0, 300]);

      scrollY = 1200; // scrolled further down on the second visit
      await go('/menu/abc'); // leaving the menu at 1200
      await go('/cart');
      await clickBackToMenu();

      expect(scrollToPosition).toHaveBeenLastCalledWith([0, 1200]);
    });
  });

  describe('with nothing to restore', () => {
    it('opens the menu at the top when the page was opened directly', async () => {
      scrollY = 400;
      await go('/menu/abc');

      await clickBackToMenu();

      expect(back).not.toHaveBeenCalled();
      expect(router.url).toBe('/menu');
      expect(scrollToPosition).not.toHaveBeenCalledWith([0, 400]);
      expect(scrollToPosition).toHaveBeenLastCalledWith([0, 0]);
    });

    it('does not carry a used position over to an unrelated later visit to the menu', async () => {
      scrollY = 640;
      await go('/menu');
      await go('/cart');
      await clickBackToMenu(); // restore consumed

      scrollToPosition.mockClear();
      scrollY = 0;
      await go('/');
      await go('/menu'); // back to the menu through a plain link
      await settle();

      expect(scrollToPosition).not.toHaveBeenCalledWith([0, 640]);
    });

    it('does not treat another item page as the menu', async () => {
      await go('/menu/one');
      await go('/menu/two');

      await clickBackToMenu();

      expect(back).not.toHaveBeenCalled();
      expect(router.url).toBe('/menu');
    });
  });
});

describe('NavigationHistoryService created late (the bug this guards against)', () => {
  it('cannot remember a menu visit that happened before it existed', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'menu', component: Page },
          { path: 'menu/:id', component: Page },
        ]),
        provideLocationMocks(),
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/menu');
    await router.navigateByUrl('/menu/abc'); // the item page is the first to create it
    const history = TestBed.inject(NavigationHistoryService);
    const back = vi.spyOn(TestBed.inject(Location), 'back');

    history.backTo('/menu');

    // It never saw /menu, so it could not go back to it. This is why App creates it at startup.
    expect(back).not.toHaveBeenCalled();
  });
});
