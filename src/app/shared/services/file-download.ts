import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Saves generated text as a file through the browser's download. */
@Injectable({ providedIn: 'root' })
export class FileDownload {
  private readonly document = inject(DOCUMENT);

  save(filename: string, content: string, mimeType = 'image/svg+xml'): void {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}
