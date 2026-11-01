import { Component, computed, signal } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { calculatePlatform } from '@core/calculator';
import { Drive } from './features/drive/drive';
import { InputsForm } from './features/inputs-form/inputs-form';
import { PlatformFormValue } from './features/inputs-form/inputs-form.models';
import { Viewer } from './features/viewer/viewer';
import { MarkingSketch } from './features/marking-sketch/marking-sketch';
import { Results } from './features/results/results';

@Component({
  imports: [MatToolbarModule, InputsForm, Results, Drive, MarkingSketch, Viewer],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  /** Moves focus to the main content. A plain #main link would resolve against <base href>. */
  protected skipToMain(event: Event): void {
    event.preventDefault();
    document.getElementById('main')?.focus();
  }

  protected readonly formValue = signal<PlatformFormValue | null>(null);

  protected readonly inputs = computed(() => this.formValue()?.inputs ?? null);

  protected readonly northRadiusMm = computed(() => this.result()?.geometry.northRadiusMm ?? null);

  protected readonly result = computed(() => {
    const v = this.formValue();
    return v ? calculatePlatform(v.inputs, v.options) : null;
  });
}
