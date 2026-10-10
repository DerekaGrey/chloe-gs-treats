import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteHeader } from './components/site-header/site-header';
import { SiteFooter } from './components/site-footer/site-footer';
import { IdleTimeoutService } from './services/idle-timeout.service';
import { NavigationHistoryService } from './services/navigation-history.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeader, SiteFooter],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly idle = inject(IdleTimeoutService);

  // Created here, at startup, so it sees every navigation from the first page. If it were
  // only created by the first page that uses it, it would never have seen the menu visit
  // that "Back to Menu" needs to return to.
  private readonly navigationHistory = inject(NavigationHistoryService);
}
