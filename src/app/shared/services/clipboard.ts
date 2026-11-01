import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Copies text to the clipboard and confirms with a snack bar. */
@Injectable({ providedIn: 'root' })
export class Clipboard {
  private readonly snackBar = inject(MatSnackBar);

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.snackBar.open('Copied to clipboard', undefined, { duration: 2000 });
    } catch {
      this.snackBar.open('Could not copy', undefined, { duration: 3000 });
    }
  }
}
