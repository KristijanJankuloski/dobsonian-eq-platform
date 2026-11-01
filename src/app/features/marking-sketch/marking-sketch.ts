import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { buildSegmentSketch } from './segment-sketch';

/** 2D marking-out sketch of one circular segment (radius, arc angle, chord). */
@Component({
  imports: [MatCardModule],
  selector: 'app-marking-sketch',
  styleUrl: './marking-sketch.scss',
  templateUrl: './marking-sketch.html',
})
export class MarkingSketch {
  /** Card title, for example "North segment". */
  readonly title = input.required<string>();
  readonly radiusMm = input.required<number>();
  readonly angleDeg = input.required<number>();
  /** Chord length including the margin allowance, mm (from the calculator). */
  readonly cutChordMm = input.required<number>();
  readonly testId = input<string>('');

  protected readonly sketch = computed(() => buildSegmentSketch(this.radiusMm(), this.angleDeg()));

  protected readonly description = computed(
    () =>
      `${this.title()}: radius ${this.radiusMm().toFixed(1)} mm, arc angle ${this.angleDeg().toFixed(2)} degrees, chord ${this.sketch().chordMm.toFixed(1)} mm.`,
  );
}
