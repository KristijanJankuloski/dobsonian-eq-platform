import { Component, computed, signal } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { calculatePlatform } from '@core/calculator';
import { InputsForm } from './features/inputs-form/inputs-form';
import { PlatformFormValue } from './features/inputs-form/inputs-form.models';
import { Results } from './features/results/results';

@Component({
  imports: [MatToolbarModule, InputsForm, Results],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly formValue = signal<PlatformFormValue | null>(null);

  protected readonly inputs = computed(() => this.formValue()?.inputs ?? null);

  protected readonly result = computed(() => {
    const v = this.formValue();
    return v ? calculatePlatform(v.inputs, v.options) : null;
  });
}
