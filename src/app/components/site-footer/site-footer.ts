import { Component, inject } from '@angular/core';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-site-footer',
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
})
export class SiteFooter {
  private config = inject(ConfigService);
  readonly cfg = this.config.config;
  readonly year = new Date().getFullYear();
}
