import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventService } from '../../../../services/event.service';
import { AdminEventService } from '../../../../services/admin-event.service';
import { PopupEvent } from '../../../../models';

@Component({
  selector: 'app-admin-event-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './event-list.html',
  styleUrl: './event-list.scss',
})
export class EventList {
  private readonly eventService = inject(EventService);
  private readonly adminEventService = inject(AdminEventService);

  readonly workingId = signal<string | null>(null);
  readonly error = signal('');

  get events(): PopupEvent[] {
    return this.eventService
      .getAll()
      .slice()
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  }

  statusLabel(event: PopupEvent): string {
    if (event.status === 'cancelled') return 'Cancelled';
    if (event.endsAt < new Date()) return 'Past';
    return 'Scheduled';
  }

  statusClass(event: PopupEvent): string {
    if (event.status === 'cancelled') return 'status-cancelled';
    if (event.endsAt < new Date()) return 'status-past';
    return 'status-scheduled';
  }

  canCancel(event: PopupEvent): boolean {
    return event.status === 'scheduled' && event.startsAt > new Date();
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  async cancelEvent(event: PopupEvent): Promise<void> {
    if (!confirm(`Cancel "${event.title}"?`)) return;
    this.workingId.set(event.id);
    try {
      await this.adminEventService.cancel(event.id);
    } catch {
      this.error.set('Failed to cancel event.');
    } finally {
      this.workingId.set(null);
    }
  }

  async deleteEvent(event: PopupEvent): Promise<void> {
    if (!confirm(`Permanently delete "${event.title}"?`)) return;
    this.workingId.set(event.id);
    try {
      await this.adminEventService.delete(event.id);
    } catch {
      this.error.set('Failed to delete event.');
    } finally {
      this.workingId.set(null);
    }
  }
}
