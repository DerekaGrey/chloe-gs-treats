import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationHistoryService } from '../services/navigation-history.service';
import { BackLinkDirective } from './back-link.directive';

@Component({
  imports: [BackLinkDirective],
  template: `<a href="/menu" appBackTo="/menu">Back to Menu</a>`,
})
class Host {}

describe('BackLinkDirective', () => {
  const backTo = vi.fn();
  let link: HTMLAnchorElement;

  beforeEach(() => {
    backTo.mockClear();
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: NavigationHistoryService, useValue: { backTo } }],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    link = (fixture.nativeElement as HTMLElement).querySelector('a')!;
  });

  const click = (init: MouseEventInit = {}) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    link.dispatchEvent(event);
    return event;
  };

  it('keeps a real href, so the link still works without the script', () => {
    expect(link.getAttribute('href')).toBe('/menu');
  });

  it('a plain click goes back to the menu instead of following the link', () => {
    const event = click();
    expect(backTo).toHaveBeenCalledWith('/menu');
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([
    ['ctrl-click', { ctrlKey: true }],
    ['cmd-click', { metaKey: true }],
    ['shift-click', { shiftKey: true }],
    ['alt-click', { altKey: true }],
    ['middle click', { button: 1 }],
    ['right click', { button: 2 }],
  ])('leaves a %s alone, so "open in a new tab" still works', (_name, init) => {
    click(init);
    expect(backTo).not.toHaveBeenCalled();
  });
});
