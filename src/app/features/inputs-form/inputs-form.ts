import { Component, effect, inject, model } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import {
  DEFAULT_INPUTS,
  DEFAULT_OPTIONS,
  MAX_LATITUDE_DEG,
  MIN_LATITUDE_DEG,
  MAX_UNUSED_MIDDLE_PERCENT,
} from '@core/calculator';
import { NumericField } from '@shared/components/numeric-field/numeric-field';
import { PlatformFormValue } from './inputs-form.models';
import { PlatformStateStore } from './platform-state-store';

/** Validators that reject empty and non-finite values. */
const finite: ValidatorFn = (c) =>
  typeof c.value === 'number' && Number.isFinite(c.value) ? null : { numeric: true };

/** The combined mass of scope and mount must be above zero. */
const totalMass: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const scope = Number(group.get('scopeMassKg')?.value);
  const mount = Number(group.get('mountMassKg')?.value);
  return scope + mount > 0 ? null : { totalMass: true };
};

const positive: ValidatorFn = (c) =>
  typeof c.value === 'number' && c.value > 0 ? null : { exclusiveMin: { min: 0 } };

@Component({
  imports: [ReactiveFormsModule, MatButtonModule, MatExpansionModule, NumericField],
  selector: 'app-inputs-form',
  styleUrl: './inputs-form.scss',
  templateUrl: './inputs-form.html',
})
export class InputsForm {
  private readonly store = inject(PlatformStateStore);
  /** Saved state from the URL or localStorage, or the defaults. */
  private readonly initial = this.store.load();

  protected readonly minLatitude = MIN_LATITUDE_DEG;
  protected readonly maxLatitude = MAX_LATITUDE_DEG;

  /** The current form state, or null while the form is invalid. */
  readonly value = model<PlatformFormValue | null>(null);

  protected readonly form = new FormGroup(
    {
      // Absolute value is used, so a negative (southern) latitude is allowed.
      latitudeDeg: this.numberControl(this.initial.inputs.latitudeDeg, [
        finite,
        (c) => {
          const v = Math.abs(Number(c.value));
          return v >= MIN_LATITUDE_DEG && v <= MAX_LATITUDE_DEG
            ? null
            : { min: { min: MIN_LATITUDE_DEG } };
        },
      ]),
      scopeMassKg: this.numberControl(this.initial.inputs.scopeMassKg, [finite, Validators.min(0)]),
      scopeCogHeightMm: this.numberControl(this.initial.inputs.scopeCogHeightMm, [
        finite,
        Validators.min(0),
      ]),
      mountMassKg: this.numberControl(this.initial.inputs.mountMassKg, [finite, Validators.min(0)]),
      mountCogHeightMm: this.numberControl(this.initial.inputs.mountCogHeightMm, [
        finite,
        Validators.min(0),
      ]),
      mountBaseWidthMm: this.numberControl(this.initial.inputs.mountBaseWidthMm, [
        finite,
        positive,
      ]),
      platformThicknessMm: this.numberControl(this.initial.inputs.platformThicknessMm, [
        finite,
        positive,
      ]),
      extraTravelDeg: this.numberControl(this.initial.options.extraTravelDeg, [
        finite,
        Validators.min(0),
      ]),
      chordMarginMm: this.numberControl(this.initial.options.chordMarginMm, [
        finite,
        Validators.min(0),
      ]),
      unusedMiddlePercent: this.numberControl(this.initial.options.unusedMiddlePercent, [
        finite,
        Validators.min(0),
        Validators.max(MAX_UNUSED_MIDDLE_PERCENT),
      ]),
    },
    { validators: totalMass },
  );

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  constructor() {
    effect(() => {
      this.formValue();
      const value = this.form.valid ? this.toFormValue() : null;
      this.value.set(value);
      if (value) this.store.save(value);
    });
  }

  protected reset(): void {
    this.form.reset({ ...DEFAULT_INPUTS, ...DEFAULT_OPTIONS });
  }

  private numberControl(value: number, validators: ValidatorFn[]) {
    return new FormControl<number | null>(value, validators);
  }

  private toFormValue(): PlatformFormValue {
    const v = this.form.getRawValue();
    return {
      inputs: {
        latitudeDeg: v.latitudeDeg!,
        scopeMassKg: v.scopeMassKg!,
        scopeCogHeightMm: v.scopeCogHeightMm!,
        mountMassKg: v.mountMassKg!,
        mountCogHeightMm: v.mountCogHeightMm!,
        mountBaseWidthMm: v.mountBaseWidthMm!,
        platformThicknessMm: v.platformThicknessMm!,
      },
      options: {
        extraTravelDeg: v.extraTravelDeg!,
        chordMarginMm: v.chordMarginMm!,
        unusedMiddlePercent: v.unusedMiddlePercent!,
      },
    };
  }
}
