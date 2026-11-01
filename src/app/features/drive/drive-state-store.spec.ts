import { TestBed } from '@angular/core/testing';
import { defaultDriveValue } from './drive-persistence';
import { DRIVE_STORAGE_KEY, DriveStateStore } from './drive-state-store';

describe('DriveStateStore', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/');
  });

  it('loads the defaults when nothing is saved', () => {
    expect(TestBed.inject(DriveStateStore).load()).toEqual(defaultDriveValue());
  });

  it('loads from localStorage', () => {
    localStorage.setItem(DRIVE_STORAGE_KEY, 'sd=9&rpm=2&sid=0&rph=&shaft=');
    const v = TestBed.inject(DriveStateStore).load();
    expect(v.spindleDiameterMm).toBe(9);
    expect(v.siderealCorrection).toBe(false);
  });
});
