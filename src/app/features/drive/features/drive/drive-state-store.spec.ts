import { TestBed } from '@angular/core/testing';
import { DriveStateStore } from './drive-state-store';

describe('DriveStateStore', () => {
  let service: DriveStateStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DriveStateStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
