import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

/** The path of a URL without its query string or fragment. */
export function pathOf(url: string): string {
  return url.split(/[?#]/)[0];
}

/**
 * Remembers which page the visitor was on before the current one, so a "Back to Menu"
 * link can really go BACK (browser history, which restores the scroll position) when
 * they came from the menu, instead of loading /menu fresh at the top.
 */
@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  private currentPath: string | null = null;
  private previousPath: string | null = null;

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.previousPath = this.currentPath;
        this.currentPath = pathOf(event.urlAfterRedirects);
      }
    });
  }

  /**
   * Go back one step if the page before this one was `target` (e.g. the menu list).
   * Otherwise (opened directly, refreshed, or came from somewhere else) navigate to it.
   */
  backTo(target: string): void {
    if (this.previousPath === target) {
      this.location.back();
    } else {
      void this.router.navigateByUrl(target);
    }
  }
}
