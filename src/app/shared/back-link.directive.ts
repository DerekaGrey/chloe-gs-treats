import { Directive, HostListener, inject, input } from '@angular/core';
import { NavigationHistoryService } from '../services/navigation-history.service';

/**
 * Put on a plain link: <a href="/menu" appBackTo="/menu">Back to Menu</a>
 *
 * A normal click goes back in history when the previous page was the target (so the
 * visitor lands where they were, scroll position included), and otherwise navigates
 * to it. The href stays, and clicks that mean something else (ctrl/cmd/shift-click,
 * middle click) are left alone so "open in new tab" still works.
 *
 * Do NOT also put routerLink on the same element: RouterLink handles the click too,
 * so the click would both go back and navigate to the target.
 */
@Directive({ selector: 'a[appBackTo]' })
export class BackLinkDirective {
  private readonly history = inject(NavigationHistoryService);

  readonly appBackTo = input.required<string>();

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    this.history.backTo(this.appBackTo());
  }
}
