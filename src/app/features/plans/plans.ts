import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PlatformInputs, PlatformResult } from '@core/calculator';
import { FileDownload } from '@shared/services/file-download';
import { buildBoardTemplate, buildSegmentTemplate } from './plan-svg';
import { buildPlatformDrawing } from './platform-drawing';

/**
 * Previews of the dimensioned platform drawing and the 1:1 segment template,
 * with SVG downloads (plus the 1:1 board template).
 */
@Component({
  imports: [MatButtonModule, MatCardModule],
  selector: 'app-plans',
  styleUrl: './plans.scss',
  templateUrl: './plans.html',
})
export class Plans {
  private readonly download = inject(FileDownload);
  private readonly sanitizer = inject(DomSanitizer);

  readonly inputs = input.required<PlatformInputs>();
  readonly result = input.required<PlatformResult>();

  /** False when the segment cannot be built; the drawings are not offered then. */
  protected readonly fits = computed(() => this.result().checks.segmentFits);
  protected readonly template = computed(() =>
    buildSegmentTemplate(this.result(), this.inputs().latitudeDeg),
  );
  protected readonly templateFile = computed(
    () => `${this.template().pole.toLowerCase()}-segment-template-1to1.svg`,
  );
  /** Today's date for the title block, as YYYY-MM-DD. */
  private readonly today = new Date().toISOString().slice(0, 10);
  protected readonly drawing = computed(() =>
    buildPlatformDrawing(this.inputs(), this.result(), this.today),
  );
  protected readonly board = computed(() => buildBoardTemplate(this.inputs(), this.result()));

  // The SVG is built by this app from numbers only, so it is safe to inline.
  protected readonly templateHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.template().svg),
  );
  protected readonly drawingHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.drawing().svg),
  );

  protected saveTemplate(): void {
    this.download.save(this.templateFile(), this.template().svg);
  }

  protected saveDrawing(): void {
    this.download.save('platform-drawing.svg', this.drawing().svg);
  }

  protected saveBoard(): void {
    this.download.save('board-template-1to1.svg', this.board());
  }
}
