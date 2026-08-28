import { Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EventService } from '../../../../services/event.service';
import { AdminEventService } from '../../../../services/admin-event.service';
import { PopupEvent, StandMenuEntry } from '../../../../models';

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

@Component({
  selector: 'app-admin-event-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './event-form.html',
  styleUrl: './event-form.scss',
})
export class EventForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly eventService = inject(EventService);
  private readonly adminEventService = inject(AdminEventService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly saving = signal(false);
  readonly error = signal('');

  editId: string | null = null;
  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      title: ['', Validators.required],
      startsAt: ['', Validators.required],
      endsAt: ['', Validators.required],
      location: ['', Validators.required],
      description: [''],
      status: ['scheduled'],
      standMenu: this.fb.array([]),
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId = id;
      const event = this.eventService.getById(id);
      if (event) this.patchForm(event);
    }
  }

  // ── Stand menu array ──────────────────────────────────────────────────────

  get standMenuArray(): FormArray {
    return this.form.get('standMenu') as FormArray;
  }

  private newStandMenuRow(name = '', priceLabel = ''): FormGroup {
    return this.fb.group({
      name: [name, Validators.required],
      priceLabel: [priceLabel, Validators.required],
    });
  }

  addStandMenuRow(): void {
    this.standMenuArray.push(this.newStandMenuRow());
  }

  removeStandMenuRow(i: number): void {
    this.standMenuArray.removeAt(i);
  }

  // ── Patch for edit mode ───────────────────────────────────────────────────

  private patchForm(event: PopupEvent): void {
    while (this.standMenuArray.length) this.standMenuArray.removeAt(0);
    for (const entry of event.standMenu ?? []) {
      this.standMenuArray.push(this.newStandMenuRow(entry.name, entry.priceLabel));
    }

    this.form.patchValue({
      title: event.title,
      startsAt: toDatetimeLocal(event.startsAt),
      endsAt: toDatetimeLocal(event.endsAt),
      location: event.location,
      description: event.description ?? '',
      status: event.status,
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set('');

    try {
      const v = this.form.getRawValue();
      const standMenu: StandMenuEntry[] = (
        v['standMenu'] as { name: string; priceLabel: string }[]
      ).map(row => ({ name: row.name, priceLabel: row.priceLabel }));

      const data: Omit<PopupEvent, 'id'> = {
        title: v['title'],
        startsAt: new Date(v['startsAt']),
        endsAt: new Date(v['endsAt']),
        location: v['location'],
        description: v['description'] || undefined,
        status: v['status'] as 'scheduled' | 'cancelled',
        standMenu: standMenu.length ? standMenu : undefined,
        photoUrls: [],
      };

      await this.adminEventService.save(data, this.editId ?? undefined);
      await this.router.navigate(['/admin/events']);
    } catch {
      this.error.set('Failed to save. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
