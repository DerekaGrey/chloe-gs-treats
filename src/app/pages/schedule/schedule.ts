import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EventService } from '../../services/event.service';

@Component({
  selector: 'app-schedule',
  imports: [DatePipe, RouterLink],
  templateUrl: './schedule.html',
  styleUrl: './schedule.scss',
})
export class Schedule {
  private events = inject(EventService);
  readonly upcoming = computed(() => this.events.getUpcoming());
}
