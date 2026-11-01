import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { PlatformInputs, PlatformResult } from '@core/calculator';
import { Clipboard } from '@shared/services/clipboard';
import { ResultRow, ResultSection, SegmentRow } from './results.models';

const mm = (v: number): string => v.toFixed(1);
const deg = (v: number): string => v.toFixed(2);

@Component({
  imports: [MatButtonModule, MatCardModule],
  selector: 'app-results',
  styleUrl: './results.scss',
  templateUrl: './results.html',
})
export class Results {
  private readonly clipboard = inject(Clipboard);

  readonly inputs = input<PlatformInputs | null>(null);
  readonly result = input<PlatformResult | null>(null);

  protected readonly sections = computed<ResultSection[]>(() => {
    const r = this.result();
    const i = this.inputs();
    if (!r || !i) return [];
    const g = r.geometry;
    const c = r.checks;
    const row = (label: string, symbol: string, value: string, unit: string): ResultRow => ({
      label,
      symbol,
      value,
      unit,
    });
    return [
      {
        id: 'platform',
        title: 'Platform dimensions',
        rows: [
          row('Distance from origin to north bearing', 'H', mm(g.northDistanceMm), 'mm'),
          row('Distance from origin to south bearing', 'J', mm(g.southDistanceMm), 'mm'),
          row('Mount base width', 'E', mm(i.mountBaseWidthMm), 'mm'),
          row('Platform thickness', 'F', mm(i.platformThicknessMm), 'mm'),
          row('Recommended minimum top-board width', '', mm(c.minTopBoardWidthMm), 'mm'),
          row('Tracking time', '', c.trackingHours.toFixed(2), 'h'),
        ],
      },
      {
        id: 'north',
        title: 'North pivot / north bearing',
        rows: [
          row('Radius of north bearing', 'I', mm(g.northRadiusMm), 'mm'),
          row('Angle of north segment', 'N', deg(g.baseAngleDeg), '°'),
          row('Segment angle with travel', 'O', deg(g.segmentAngleDeg), '°'),
          row('Chord of north segment', 'P', mm(g.northChordMm), 'mm'),
          row('Height of segment', 'L', mm(g.segmentHeightMm), 'mm'),
          row('Polar axis to platform', 'M', mm(g.polarAxisToPlatformMm), 'mm'),
          row('Distance from origin', 'H', mm(g.northDistanceMm), 'mm'),
        ],
      },
    ];
  });

  protected readonly segments = computed<SegmentRow[]>(() => {
    const r = this.result();
    if (!r) return [];
    const g = r.geometry;
    const c = r.checks;
    const angle = deg(g.segmentAngleDeg);
    return [
      { label: 'Radius', north: mm(g.northRadiusMm), south: mm(g.southRadiusMm), unit: 'mm' },
      { label: 'Chord length', north: mm(g.northChordMm), south: mm(g.southChordMm), unit: 'mm' },
      { label: 'Arc angle', north: angle, south: angle, unit: '°' },
      {
        label: 'Thickness',
        north: mm(g.segmentHeightMm),
        south: mm(g.segmentHeightMm),
        unit: 'mm',
      },
      {
        label: 'Sagitta (board depth)',
        north: mm(c.northSagittaMm),
        south: mm(c.southSagittaMm),
        unit: 'mm',
      },
      {
        label: 'Distance from origin',
        north: mm(g.northDistanceMm),
        south: mm(g.southDistanceMm),
        unit: 'mm',
      },
    ];
  });

  protected readonly warnings = computed(() => this.result()?.checks.warnings ?? []);

  protected copySection(section: ResultSection): void {
    const lines = section.rows.map(
      (r) => `${r.label}${r.symbol ? ` (${r.symbol})` : ''}: ${r.value} ${r.unit}`,
    );
    this.copy(`${section.title}\n${lines.join('\n')}`);
  }

  protected copySegments(): void {
    const lines = this.segments().map(
      (s) => `${s.label}: north ${s.north} ${s.unit}, south ${s.south} ${s.unit}`,
    );
    this.copy(`Circular segments\n${lines.join('\n')}`);
  }

  private copy(text: string): void {
    void this.clipboard.copy(text);
  }
}
