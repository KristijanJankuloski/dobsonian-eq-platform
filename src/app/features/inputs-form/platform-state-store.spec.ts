import { TestBed } from '@angular/core/testing';
import { DEFAULT_INPUTS } from '@core/calculator';
import { defaultFormValue } from './inputs-persistence';
import { PlatformStateStore, STORAGE_KEY } from './platform-state-store';

describe('PlatformStateStore', () => {
  let store: PlatformStateStore;

  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/');
    vi.useFakeTimers();
    store = TestBed.inject(PlatformStateStore);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads the defaults when nothing is saved', () => {
    expect(store.load()).toEqual(defaultFormValue());
  });

  it('loads from the URL query', () => {
    history.replaceState(null, '', '/?lat=40&a=15');
    const v = store.load();
    expect(v.inputs.latitudeDeg).toBe(40);
    expect(v.inputs.scopeMassKg).toBe(15);
  });

  it('prefers the URL over localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'lat=30');
    history.replaceState(null, '', '/?lat=40');
    expect(store.load().inputs.latitudeDeg).toBe(40);
  });

  it('falls back to localStorage when the URL has no known keys', () => {
    localStorage.setItem(STORAGE_KEY, 'lat=30');
    history.replaceState(null, '', '/?utm=1');
    expect(store.load().inputs.latitudeDeg).toBe(30);
  });

  it('ignores corrupt stored data', () => {
    localStorage.setItem(STORAGE_KEY, 'lat=<script>&a=-1e99');
    expect(store.load().inputs.latitudeDeg).toBe(DEFAULT_INPUTS.latitudeDeg);
  });

  it('saves to localStorage and the URL after a short delay', () => {
    const value = defaultFormValue();
    value.inputs.latitudeDeg = 45;
    store.save(value);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(300);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('lat=45');
    expect(location.search).toContain('lat=45');
    expect(store.load().inputs.latitudeDeg).toBe(45);
  });

  it('writes only the last value when saves come in quickly', () => {
    const a = defaultFormValue();
    a.inputs.latitudeDeg = 10;
    const b = defaultFormValue();
    b.inputs.latitudeDeg = 20;
    store.save(a);
    store.save(b);
    vi.advanceTimersByTime(300);
    expect(location.search).toContain('lat=20');
    expect(location.search).not.toContain('lat=10');
  });

  it('keeps working when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const value = defaultFormValue();
    value.inputs.latitudeDeg = 33;
    store.save(value);
    vi.advanceTimersByTime(300);
    expect(location.search).toContain('lat=33');
    history.replaceState(null, '', '/');
    expect(store.load()).toEqual(defaultFormValue());
  });
});
