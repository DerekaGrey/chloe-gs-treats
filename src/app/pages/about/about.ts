import { Component, computed, inject } from '@angular/core';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
  private config = inject(ConfigService);
  readonly cfg = computed(() => this.config.config);
}
