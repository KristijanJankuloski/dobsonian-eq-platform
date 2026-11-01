import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

const SAVE_DELAY_MS = 300;

/**
 * Saves a feature's state as query parameters to localStorage and the URL, and
 * loads it back. The URL wins over localStorage so shared links open as sent.
 * Several features can share the URL: each only sets its own keys and leaves
 * the others alone. Every storage access is guarded, because storage can be
 * blocked or throw (private windows).
 *
 * Both sources are untrusted. Callers parse and limit the values themselves.
 */
@Injectable({ providedIn: 'root' })
export class StateStorage {
  private readonly doc = inject(DOCUMENT);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** The first state `parse` accepts from the URL query, then localStorage. */
  load<T>(storageKey: string, parse: (params: URLSearchParams) => T | null): T | null {
    const fromUrl = parse(new URLSearchParams(this.doc.location?.search ?? ''));
    if (fromUrl !== null) return fromUrl;
    try {
      const stored = this.doc.defaultView?.localStorage.getItem(storageKey);
      if (stored) return parse(new URLSearchParams(stored));
    } catch {
      // Storage unavailable.
    }
    return null;
  }

  /** Saves after a short pause, so typing does not write on every key. */
  save(storageKey: string, params: URLSearchParams): void {
    clearTimeout(this.timers.get(storageKey));
    this.timers.set(
      storageKey,
      setTimeout(() => this.write(storageKey, params), SAVE_DELAY_MS),
    );
  }

  private write(storageKey: string, params: URLSearchParams): void {
    this.timers.delete(storageKey);
    const win = this.doc.defaultView;
    try {
      win?.localStorage.setItem(storageKey, params.toString());
    } catch {
      // Storage unavailable or full: the URL still carries the state.
    }
    try {
      const { pathname, search, hash } = this.doc.location;
      const merged = new URLSearchParams(search);
      params.forEach((value, key) => merged.set(key, value));
      win?.history.replaceState(win.history.state, '', `${pathname}?${merged}${hash}`);
    } catch {
      // History unavailable: ignore.
    }
  }
}
