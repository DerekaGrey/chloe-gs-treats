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

// Guard against something absurd being handed to the canvas. Anything under
// this is downscaled rather than rejected, so the limit is deliberately loose.
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const JPEG_QUALITY = 0.85;
/** Stored crop is square, matching how the menu grid and detail page display it. */
const OUTPUT_PX = 1200;
const MAX_ZOOM = 3;
/** Only used if the frame is measured before layout settles. */
const FRAME_FALLBACK_PX = 320;

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  readonly processing = signal(false);
  // Kept apart from `error` so a photo problem shows next to the photo picker
  // rather than down beside the Save button.
  readonly photoError = signal('');

  editId: string | null = null;
  form!: FormGroup;

  // Photo state — managed outside the form since it's a file, not a form value
  selectedFile: File | null = null;
  previewUrl: string | null = null;   // local blob URL shown immediately on selection
  currentPhotoUrl: string | null = null; // existing Storage URL from Firestore

  // Crop framing. The decoded original is retained so every adjustment
  // re-renders from full quality instead of compounding on the last render.
  readonly MAX_ZOOM = MAX_ZOOM;
  cropBitmap: ImageBitmap | null = null;
  readonly zoom = signal(1);
  readonly offsetX = signal(0);
  readonly offsetY = signal(0);
  readonly frameSize = signal(FRAME_FALLBACK_PX);
  private panFrom: { x: number; y: number } | null = null;

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

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.photoError.set('Please select an image file.');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      this.photoError.set(
        `That image is ${formatMb(file.size)}, which is too large to process. ` +
        'Please pick a smaller one.',
      );
      return;
    }

    this.photoError.set('');
    this.processing.set(true);
    try {
      // Keep the decoded original around: the crop is re-rendered from it on
      // every adjustment, so quality never degrades through repeated edits.
      this.cropBitmap?.close();
      this.cropBitmap = await createImageBitmap(file);

      if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = URL.createObjectURL(file);

      this.selectedFile = file;
      this.zoom.set(1);
      this.offsetX.set(0);
      this.offsetY.set(0);
    } catch (err) {
      console.error('[menu-form] Image processing failed:', err);
      this.photoError.set(
        'Could not read that image. Try exporting it as a JPEG or PNG and uploading again.',
      );
    } finally {
      this.processing.set(false);
    }
  }

  // ── Crop framing ──────────────────────────────────────────────────────────

  /** Measured from the DOM so the maths cannot drift out of sync with the CSS. */
  onCropImageLoad(el: HTMLElement): void {
    this.frameSize.set(el.clientWidth || FRAME_FALLBACK_PX);
    this.centreImage();
  }

  /** Scale that makes the image exactly cover the frame, before user zoom. */
  private coverScale(): number {
    const bmp = this.cropBitmap;
    if (!bmp) return 1;
    return Math.max(this.frameSize() / bmp.width, this.frameSize() / bmp.height);
  }

  scaledW(): number {
    return (this.cropBitmap?.width ?? 0) * this.coverScale() * this.zoom();
  }

  scaledH(): number {
    return (this.cropBitmap?.height ?? 0) * this.coverScale() * this.zoom();
  }

  private centreImage(): void {
    this.offsetX.set((this.frameSize() - this.scaledW()) / 2);
    this.offsetY.set((this.frameSize() - this.scaledH()) / 2);
  }

  /** Stop the frame from ever showing empty space beside the image. */
  private clampOffsets(): void {
    const frame = this.frameSize();
    this.offsetX.set(Math.min(0, Math.max(frame - this.scaledW(), this.offsetX())));
    this.offsetY.set(Math.min(0, Math.max(frame - this.scaledH(), this.offsetY())));
  }

  setZoom(value: string): void {
    const next = Number(value);
    if (!Number.isFinite(next)) return;

    // Zoom about the centre of the frame rather than the image origin, so the
    // part being looked at stays put.
    const frame = this.frameSize();
    const prevW = this.scaledW();
    const prevH = this.scaledH();
    const cx = (frame / 2 - this.offsetX()) / prevW;
    const cy = (frame / 2 - this.offsetY()) / prevH;

    this.zoom.set(next);

    this.offsetX.set(frame / 2 - cx * this.scaledW());
    this.offsetY.set(frame / 2 - cy * this.scaledH());
    this.clampOffsets();
  }

  onPanStart(event: PointerEvent): void {
    if (!this.cropBitmap) return;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.panFrom = { x: event.clientX, y: event.clientY };
  }

  onPanMove(event: PointerEvent): void {
    if (!this.panFrom) return;
    this.offsetX.update(v => v + (event.clientX - this.panFrom!.x));
    this.offsetY.update(v => v + (event.clientY - this.panFrom!.y));
    this.panFrom = { x: event.clientX, y: event.clientY };
    this.clampOffsets();
  }

  onPanEnd(event: PointerEvent): void {
    const el = event.target as HTMLElement;
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    this.panFrom = null;
  }

  /**
   * Render the framed square to a JPEG at upload time.
   *
   * Only the visible region is drawn, so the stored file is exactly what
   * customers see, and a multi-megapixel phone photo becomes a few hundred KB.
   * That matters because HEIC transcoding on the way into a file input inflates
   * these badly: a 3 MB HEIC commonly arrives as 8 MB of JPEG.
   */
  private async renderCrop(): Promise<File> {
    const bmp = this.cropBitmap;
    if (!bmp) throw new Error('No image loaded');

    const scale = this.coverScale() * this.zoom();
    const sx = -this.offsetX() / scale;
    const sy = -this.offsetY() / scale;
    const size = this.frameSize() / scale;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_PX;
    canvas.height = OUTPUT_PX;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(bmp, sx, sy, size, size, 0, 0, OUTPUT_PX, OUTPUT_PX);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob) throw new Error('Image encoding produced no data');

    const name = (this.selectedFile?.name ?? 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  }

  removePhoto(): void {
    this.photoError.set('');
    this.cropBitmap?.close();
    this.cropBitmap = null;
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
      if (this.cropBitmap) {
        this.uploadProgress.set(0);
        const url = await this.uploadPhoto(await this.renderCrop());
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
