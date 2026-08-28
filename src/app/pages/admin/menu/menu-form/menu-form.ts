import { Component, OnInit, inject, signal } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { MenuService } from '../../../../services/menu.service';
import { AdminMenuService } from '../../../../services/admin-menu.service';
import { MenuCategory, MenuItem } from '../../../../models';

const CATEGORIES: { value: MenuCategory; label: string }[] = [
  { value: 'cookies', label: 'Cookies' },
  { value: 'scones', label: 'Scones' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'treats', label: 'Treats' },
  { value: 'bread', label: 'Bread' },
  { value: 'custom', label: 'Custom / Other' },
];

@Component({
  selector: 'app-admin-menu-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './menu-form.html',
  styleUrl: './menu-form.scss',
})
export class MenuForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly menuService = inject(MenuService);
  private readonly adminMenuService = inject(AdminMenuService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly categories = CATEGORIES;
  readonly saving = signal(false);
  readonly error = signal('');
  readonly uploadProgress = signal<number | null>(null);

  editId: string | null = null;
  form!: FormGroup;

  // Photo state — managed outside the form since it's a file, not a form value
  selectedFile: File | null = null;
  previewUrl: string | null = null;   // local blob URL shown immediately on selection
  currentPhotoUrl: string | null = null; // existing Storage URL from Firestore

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      category: ['cookies' as MenuCategory, Validators.required],
      ingredients: [''],
      allergens: [''],
      isCustomOrder: [false],
      available: [true],
      sortOrder: [0, [Validators.required, Validators.min(0)]],
      leadTimeDaysOverride: [null as number | null],
      packPricing: this.fb.array([this.newPackTierGroup()]),
      optionGroups: this.fb.array([]),
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId = id;
      const item = this.menuService.getById(id);
      if (item) this.patchForm(item);
    }
  }

  // ── FormArray accessors ───────────────────────────────────────────────────

  get packPricingArray(): FormArray {
    return this.form.get('packPricing') as FormArray;
  }

  get optionGroupsArray(): FormArray {
    return this.form.get('optionGroups') as FormArray;
  }

  optionsFor(groupIndex: number): FormArray {
    return this.optionGroupsArray.at(groupIndex).get('options') as FormArray;
  }

  // ── FormGroup factories ───────────────────────────────────────────────────

  private newPackTierGroup(label = '', quantity = 1, priceDollars = ''): FormGroup {
    return this.fb.group({
      label: [label, Validators.required],
      quantity: [quantity, [Validators.required, Validators.min(1)]],
      priceDollars: [priceDollars, Validators.required],
    });
  }

  private newOptionGroupGroup(name = '', required = true): FormGroup {
    return this.fb.group({
      name: [name, Validators.required],
      required: [required],
      options: this.fb.array([this.newOptionGroup()]),
    });
  }

  private newOptionGroup(label = '', priceCentsDelta = 0): FormGroup {
    return this.fb.group({
      label: [label, Validators.required],
      priceCentsDelta: [priceCentsDelta],
    });
  }

  // ── Pack pricing actions ──────────────────────────────────────────────────

  addPackTier(): void {
    this.packPricingArray.push(this.newPackTierGroup());
  }

  removePackTier(i: number): void {
    if (this.packPricingArray.length > 1) this.packPricingArray.removeAt(i);
  }

  // ── Option group actions ──────────────────────────────────────────────────

  addOptionGroup(): void {
    this.optionGroupsArray.push(this.newOptionGroupGroup());
  }

  removeOptionGroup(i: number): void {
    this.optionGroupsArray.removeAt(i);
  }

  addOption(groupIndex: number): void {
    this.optionsFor(groupIndex).push(this.newOptionGroup());
  }

  removeOption(groupIndex: number, optIndex: number): void {
    const arr = this.optionsFor(groupIndex);
    if (arr.length > 1) arr.removeAt(optIndex);
  }

  // ── Photo actions ─────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.error.set('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.error.set('Image must be under 5 MB.');
      return;
    }

    this.error.set('');
    this.selectedFile = file;
    // Revoke previous blob URL to avoid memory leaks
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = URL.createObjectURL(file);
  }

  removePhoto(): void {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
    this.selectedFile = null;
    this.currentPhotoUrl = null;
  }

  private uploadPhoto(file: File): Promise<string> {
    const storage = getStorage();
    const safeName = file.name.replace(/\s+/g, '-');
    const storageRef = ref(storage, `menu-items/${Date.now()}-${safeName}`);

    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file);
      task.on(
        'state_changed',
        snapshot => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          this.uploadProgress.set(pct);
        },
        reject,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        },
      );
    });
  }

  // ── Patch form for edit mode ──────────────────────────────────────────────

  private patchForm(item: MenuItem): void {
    this.currentPhotoUrl = item.photoUrls[0] ?? null;

    while (this.packPricingArray.length) this.packPricingArray.removeAt(0);
    for (const tier of item.packPricing) {
      this.packPricingArray.push(
        this.newPackTierGroup(tier.label, tier.quantity, (tier.priceCents / 100).toFixed(2)),
      );
    }

    while (this.optionGroupsArray.length) this.optionGroupsArray.removeAt(0);
    for (const group of item.optionGroups ?? []) {
      const groupForm = this.newOptionGroupGroup(group.name, group.required);
      const optionsArray = groupForm.get('options') as FormArray;
      while (optionsArray.length) optionsArray.removeAt(0);
      for (const opt of group.options) {
        optionsArray.push(this.newOptionGroup(opt.label, opt.priceCentsDelta));
      }
      this.optionGroupsArray.push(groupForm);
    }

    this.form.patchValue({
      name: item.name,
      description: item.description,
      category: item.category,
      ingredients: item.ingredients ?? '',
      allergens: item.allergens.join(', '),
      isCustomOrder: item.isCustomOrder,
      available: item.available,
      sortOrder: item.sortOrder,
      leadTimeDaysOverride: item.leadTimeDaysOverride ?? null,
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Please fill in the highlighted fields before saving.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    try {
      // Upload new photo if one was selected
      let photoUrls: string[] = this.currentPhotoUrl ? [this.currentPhotoUrl] : [];
      if (this.selectedFile) {
        this.uploadProgress.set(0);
        const url = await this.uploadPhoto(this.selectedFile);
        photoUrls = [url];
        this.uploadProgress.set(null);
      }

      const v = this.form.getRawValue();

      const data: Omit<MenuItem, 'id'> = {
        name: v['name'],
        description: v['description'],
        category: v['category'] as MenuCategory,
        ingredients: v['ingredients'] || undefined,
        allergens: (v['allergens'] as string)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean),
        isCustomOrder: v['isCustomOrder'],
        available: v['available'],
        sortOrder: Number(v['sortOrder']),
        leadTimeDaysOverride: v['leadTimeDaysOverride'] ? Number(v['leadTimeDaysOverride']) : undefined,
        photoUrls,
        packPricing: (v['packPricing'] as { label: string; quantity: number; priceDollars: string }[]).map(tier => ({
          label: tier.label,
          quantity: Number(tier.quantity),
          priceCents: Math.round(Number(tier.priceDollars) * 100),
        })),
        optionGroups: v['optionGroups'].length
          ? (v['optionGroups'] as { name: string; required: boolean; options: { label: string; priceCentsDelta: number }[] }[]).map(g => ({
              name: g.name,
              required: g.required,
              selectionType: 'single' as const,
              options: g.options.map(o => ({
                label: o.label,
                priceCentsDelta: Number(o.priceCentsDelta),
              })),
            }))
          : undefined,
      };

      await this.adminMenuService.save(data, this.editId ?? undefined);
      await this.router.navigate(['/admin/menu']);
    } catch (err) {
      console.error('[menu-form] Save failed:', err);
      this.uploadProgress.set(null);
      const e = err as { code?: string; message?: string };
      this.error.set(
        e?.code === 'permission-denied'
          ? 'You do not have permission to save menu items. Please sign out and back in.'
          : `Failed to save: ${e?.message ?? 'unknown error'}`,
      );
    } finally {
      this.saving.set(false);
    }
  }
}
