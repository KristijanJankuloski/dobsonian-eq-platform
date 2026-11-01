import { Injectable, inject } from '@angular/core';
import { StateStorage } from '@shared/services/state-storage';
import { PlatformFormValue } from './inputs-form.models';
import { defaultFormValue, fromQueryParams, toQueryParams } from './inputs-persistence';

export const STORAGE_KEY = 'dobsonian-eq-platform:inputs:v1';

/** Loads and saves the platform inputs (URL query, then localStorage, then defaults). */
@Injectable({ providedIn: 'root' })
export class PlatformStateStore {
  private readonly storage = inject(StateStorage);

  load(): PlatformFormValue {
    return this.storage.load(STORAGE_KEY, fromQueryParams) ?? defaultFormValue();
  }

  save(value: PlatformFormValue): void {
    this.storage.save(STORAGE_KEY, toQueryParams(value));
  }
}
