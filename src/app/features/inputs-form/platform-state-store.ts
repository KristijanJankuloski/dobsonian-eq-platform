import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { PlatformFormValue } from './inputs-form.models';
import { defaultFormValue, fromQueryParams, toQueryParams } from './inputs-persistence';

export const STORAGE_KEY = 'dobsonian-eq-platform:inputs:v1';
const SAVE_DELAY_MS = 300;

/**
 * Saves the form state to localStorage and the URL query string, and loads it
 * back. The URL wins over localStorage so shared links open as sent. Every
 * storage access is guarded: it can be blocked or throw (private windows).
 */
@Injectable({ providedIn: 'root' })
export class PlatformStateStore {
  private readonly doc = inject(DOCUMENT);
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** URL query, then localStorage, then the defaults. */
  load(): PlatformFormValue {
    const fromUrl = fromQueryParams(new URLSearchParams(this.doc.location?.search ?? ''));
    if (fromUrl) return fromUrl;
    try {
      const stored = this.doc.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const fromStorage = fromQueryParams(new URLSearchParams(stored));
        if (fromStorage) return fromStorage;
      }
    } catch {
      // Storage unavailable: fall through to the defaults.
    }
    return defaultFormValue();
  }

  /** Saves after a short pause, so typing does not write on every key. */
  save(value: PlatformFormValue): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.write(value), SAVE_DELAY_MS);
  }

  private write(value: PlatformFormValue): void {
    const query = toQueryParams(value).toString();
    const win = this.doc.defaultView;
    try {
      win?.localStorage.setItem(STORAGE_KEY, query);
    } catch {
      // Storage unavailable or full: the URL still carries the state.
    }
    try {
      const { pathname, hash } = this.doc.location;
      win?.history.replaceState(win.history.state, '', `${pathname}?${query}${hash}`);
    } catch {
      // History unavailable: ignore.
    }
  }
}
