import { Component, computed, effect, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { calculateDirectDrive, calculateWormDrive } from '@core/calculator';
import { Clipboard } from '@shared/services/clipboard';
import { NumericField } from '@shared/components/numeric-field/numeric-field';
import { DriveFormValue } from './drive.models';
import { DriveStateStore } from './drive-state-store';

const positive: ValidatorFn = (c) =>
  typeof c.value === 'number' && c.value > 0 ? null : { exclusiveMin: { min: 0 } };

/** Empty is fine; a value must be positive. */
const optionalPositive: ValidatorFn = (c) =>
  c.value === null || c.value === '' ? null : positive(c);

/** Optional drive calculations: worm drive and direct-drive synchronous motor (SPEC §6). */
@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatSlideToggleModule,
    NumericField,
  ],
  selector: 'app-drive',
  styleUrl: './drive.scss',
  templateUrl: './drive.html',
})
export class Drive {
  private readonly store = inject(DriveStateStore);
  private readonly clipboard = inject(Clipboard);
  private readonly initial = this.store.load();

  /** North bearing radius I from the platform calculation, or null while inputs are invalid. */
  readonly northRadiusMm = input<number | null>(null);

  protected readonly form = new FormGroup({
    spindleDiameterMm: new FormControl<number | null>(this.initial.spindleDiameterMm, [positive]),
    motorRpm: new FormControl<number | null>(this.initial.motorRpm, [positive]),
    siderealCorrection: new FormControl(this.initial.siderealCorrection, { nonNullable: true }),
    motorRph: new FormControl<number | null>(this.initial.motorRph, [optionalPositive]),
    shaftDiameterMm: new FormControl<number | null>(this.initial.shaftDiameterMm, [
      optionalPositive,
    ]),
  });

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** The form state, or null while a field is invalid. */
  private readonly value = computed<DriveFormValue | null>(() => {
    this.formValue();
    if (!this.form.valid) return null;
    const v = this.form.getRawValue();
    return {
      spindleDiameterMm: v.spindleDiameterMm!,
      motorRpm: v.motorRpm!,
      siderealCorrection: v.siderealCorrection,
      motorRph: v.motorRph ?? null,
      shaftDiameterMm: v.shaftDiameterMm ?? null,
    };
  });

  protected readonly worm = computed(() => {
    const v = this.value();
    const radius = this.northRadiusMm();
    if (!v || radius === null) return null;
    return calculateWormDrive({
      northRadiusMm: radius,
      spindleDiameterMm: v.spindleDiameterMm,
      motorRpm: v.motorRpm,
      siderealCorrection: v.siderealCorrection,
    });
  });

  protected readonly direct = computed(() => {
    const v = this.value();
    const radius = this.northRadiusMm();
    if (!v || radius === null || v.motorRph === null || v.shaftDiameterMm === null) return null;
    return calculateDirectDrive({
      motorRph: v.motorRph,
      shaftDiameterMm: v.shaftDiameterMm,
      northRadiusMm: radius,
    });
  });

  /** True when only one of the two direct-drive fields is filled in. */
  protected readonly directIncomplete = computed(() => {
    const v = this.value();
    return !!v && (v.motorRph === null) !== (v.shaftDiameterMm === null);
  });

  constructor() {
    effect(() => {
      const v = this.value();
      if (v) this.store.save(v);
    });
  }

  protected copyWorm(): void {
    const w = this.worm();
    if (!w) return;
    void this.clipboard.copy(
      [
        'Worm drive',
        `Required spindle speed: ${w.requiredSpindleRpm.toFixed(4)} rpm`,
        `Ideal gear ratio: ${w.idealRatio.toFixed(3)}`,
        `Teeth (single-start worm): ${w.teeth}`,
      ].join('\n'),
    );
  }

  protected copyDirect(): void {
    const d = this.direct();
    if (!d) return;
    void this.clipboard.copy(
      [
        'Direct drive',
        `Required north radius: ${d.requiredNorthRadiusMm.toFixed(1)} mm`,
        `Difference from calculated radius: ${d.differenceMm.toFixed(1)} mm`,
      ].join('\n'),
    );
  }
}
