import { Location, ViewportScroller } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, Scroll } from '@angular/router';

/** The path of a URL without its query string or fragment. */
export function pathOf(url: string): string {
  return url.split(/[?#]/)[0];
}

type ScrollPosition = [number, number];

/**
 * Lets a "Back to Menu" / "Keep Shopping" link return the visitor to where they were.
 *
 * Two cases:
 *  - They came straight from the target page (menu -> item): go BACK in browser history,
 *    which restores the scroll position.
 *  - They took a longer route (menu -> item -> cart): history cannot get them back in one
 *    step, so we remember the scroll position of every page they leave, and when they
 *    return to the target we scroll to where they last were on it.
 */
@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly viewport = inject(ViewportScroller);

  private currentPath: string | null = null;
  private previousPath: string | null = null;

  /** Where the visitor was when they last left each page. */
  private readonly lastScroll = new Map<string, ScrollPosition>();

  /** Position to restore once the router has finished its own scrolling for a navigation. */
  private pendingRestore: { path: string; position: ScrollPosition } | null = null;

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart && this.currentPath !== null) {
        this.lastScroll.set(this.currentPath, this.viewport.getScrollPosition());
      } else if (event instanceof NavigationEnd) {
        this.previousPath = this.currentPath;
        this.currentPath = pathOf(event.urlAfterRedirects);
      } else if (event instanceof Scroll && this.pendingRestore) {
        // The router scrolls a new page to the top when it handles this same event.
        // Which of us subscribed first decides who runs first, so apply ours one tick
        // later: after the router's scrolling, whatever the order.
        const { path, position } = this.pendingRestore;
        const navigated = event.routerEvent;
        const url = navigated instanceof NavigationEnd ? navigated.urlAfterRedirects : navigated.url;
        if (pathOf(url) === path) {
          this.pendingRestore = null;
          setTimeout(() => this.viewport.scrollToPosition(position));
        }
      }
    });
  }

  /**
   * Return to `target` (e.g. the menu list), landing where the visitor last was on it.
   * Going straight back from the target uses history; any other route navigates to it
   * and restores the remembered scroll position. With no remembered position (opened
   * directly, refreshed) it simply opens the page at the top.
   */
  backTo(target: string): void {
    if (this.previousPath === target) {
      this.location.back();
      return;
    }
    const position = this.lastScroll.get(target);
    this.pendingRestore = position ? { path: target, position } : null;
    void this.router.navigateByUrl(target);
  }
}
