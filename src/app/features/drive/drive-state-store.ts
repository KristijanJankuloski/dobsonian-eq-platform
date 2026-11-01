import { Injectable, inject } from '@angular/core';
import { StateStorage } from '@shared/services/state-storage';
import { DriveFormValue } from './drive.models';
import { defaultDriveValue, fromDriveQueryParams, toDriveQueryParams } from './drive-persistence';

export const DRIVE_STORAGE_KEY = 'dobsonian-eq-platform:drive:v1';

/** Loads and saves the drive inputs (URL query, then localStorage, then defaults). */
@Injectable({ providedIn: 'root' })
export class DriveStateStore {
  private readonly storage = inject(StateStorage);

  load(): DriveFormValue {
    return this.storage.load(DRIVE_STORAGE_KEY, fromDriveQueryParams) ?? defaultDriveValue();
  }

  save(value: DriveFormValue): void {
    this.storage.save(DRIVE_STORAGE_KEY, toDriveQueryParams(value));
  }
}
