import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { EventService } from '../../services/event.service';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private events = inject(EventService);
  private config = inject(ConfigService);

  readonly nextEvent = computed(() => this.events.getNext());
  readonly cfg = computed(() => this.config.config);
}
