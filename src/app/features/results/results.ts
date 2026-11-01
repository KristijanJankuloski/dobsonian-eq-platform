import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { PlatformInputs, PlatformResult, hemisphereNames } from '@core/calculator';
import { Clipboard } from '@shared/services/clipboard';
import { ResultRow, ResultSection, SegmentRow } from './results.models';

const mm = (v: number): string => v.toFixed(1);
const deg = (v: number): string => v.toFixed(2);
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

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

  /** Bearing and pivot names for the hemisphere (SPEC §8). */
  protected readonly names = computed(() => hemisphereNames(this.inputs()?.latitudeDeg ?? 1));

  protected readonly segmentTitle = computed(() => `${this.names().pole} circular segment`);

  protected readonly sections = computed<ResultSection[]>(() => {
    const r = this.result();
    const i = this.inputs();
    if (!r || !i) return [];
    const g = r.geometry;
    const c = r.checks;
    const pole = this.names().pole.toLowerCase();
    const pivot = this.names().equator.toLowerCase();
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
          row(`Distance from origin to ${pole} bearing`, 'H', mm(g.northDistanceMm), 'mm'),
          row(`Distance from origin to ${pivot} pivot`, 'S', mm(g.southPivotDistanceMm), 'mm'),
          row(`${cap(pivot)} pivot to ${pole} bearing`, 'T', mm(g.pivotToNorthBearingMm), 'mm'),
          row('Mount base width', 'E', mm(i.mountBaseWidthMm), 'mm'),
          row('Platform thickness', 'F', mm(i.platformThicknessMm), 'mm'),
          row('Recommended minimum top-board width', '', mm(c.minTopBoardWidthMm), 'mm'),
          row('Tracking time', '', c.trackingHours.toFixed(2), 'h'),
        ],
      },
      {
        id: 'north',
        title: `${cap(pole)} bearing`,
        rows: [
          row(`Radius of ${pole} bearing`, 'I', mm(g.northRadiusMm), 'mm'),
          row(`Angle of ${pole} segment`, 'N', deg(g.baseAngleDeg), '°'),
          row('Segment angle with travel', 'O', deg(g.segmentAngleDeg), '°'),
          row(`Chord of ${pole} segment`, 'P', mm(g.northChordMm), 'mm'),
          row('Radial height of segment', 'L', mm(g.segmentHeightMm), 'mm'),
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
    const whole = g.pieceInnerAngleDeg === 0;
    const rows: SegmentRow[] = [
      { label: 'Radius', value: mm(g.northRadiusMm), unit: 'mm' },
      { label: 'Chord length (with margin)', value: mm(g.northChordMm), unit: 'mm' },
      { label: 'Arc angle', value: deg(g.segmentAngleDeg), unit: '°' },
      { label: 'Radial height (L)', value: mm(g.segmentHeightMm), unit: 'mm' },
      { label: 'Sagitta of the chord', value: mm(c.northSagittaMm), unit: 'mm' },
      { label: 'Distance from origin', value: mm(g.northDistanceMm), unit: 'mm' },
      { label: 'Pieces to cut', value: whole ? '1' : '2 (mirrored)', unit: '' },
    ];
    if (!whole) {
      rows.push(
        {
          label: 'Unused middle',
          value: g.unusedMiddlePercent.toFixed(1),
          // The option is an upper limit: it is reduced so each piece covers the travel.
          unit:
            r.options.unusedMiddlePercent - g.unusedMiddlePercent > 0.05
              ? `% (reduced from ${r.options.unusedMiddlePercent.toFixed(1)} % to cover the travel)`
              : '%',
        },
        {
          label: 'Each piece spans',
          value: `${deg(g.pieceInnerAngleDeg)}–${deg(g.pieceOuterAngleDeg)}`,
          unit: '° from centre',
        },
      );
    }
    rows.push(
      {
        label: whole ? 'Flat edge length' : 'Piece flat edge length',
        value: mm(g.pieceWidthMm),
        unit: 'mm',
      },
      { label: 'Board depth needed', value: mm(g.pieceHeightMm), unit: 'mm' },
    );
    return rows;
  });

  protected readonly warnings = computed(() => this.result()?.checks.warnings ?? []);

  protected copySection(section: ResultSection): void {
    const lines = section.rows.map(
      (r) => `${r.label}${r.symbol ? ` (${r.symbol})` : ''}: ${r.value} ${r.unit}`,
    );
    this.copy(`${section.title}\n${lines.join('\n')}`);
  }

  protected copySegments(): void {
    const lines = this.segments().map((s) => `${s.label}: ${s.value} ${s.unit}`);
    this.copy(`${this.segmentTitle()}\n${lines.join('\n')}`);
  }

  private copy(text: string): void {
    void this.clipboard.copy(text);
  }
}
