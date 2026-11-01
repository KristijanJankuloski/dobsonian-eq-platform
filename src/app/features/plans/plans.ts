import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PlatformInputs, PlatformResult } from '@core/calculator';
import { FileDownload } from '@shared/services/file-download';
import { buildPlatformPlan, buildSegmentTemplate } from './plan-svg';

/** Previews of the platform plan and the 1:1 segment template, with SVG downloads. */
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
  protected readonly plan = computed(() => buildPlatformPlan(this.inputs(), this.result()));

  // The SVG is built by this app from numbers only, so it is safe to inline.
  protected readonly templateHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.template().svg),
  );
  protected readonly planHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.plan()),
  );

  protected saveTemplate(): void {
    this.download.save(this.templateFile(), this.template().svg);
  }

  protected savePlan(): void {
    this.download.save('platform-plan.svg', this.plan());
  }
}
