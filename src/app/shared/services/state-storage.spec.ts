import { TestBed } from '@angular/core/testing';
import { StateStorage } from './state-storage';

const parse = (p: URLSearchParams) => (p.has('x') ? Number(p.get('x')) : null);

describe('StateStorage', () => {
  let storage: StateStorage;

  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/');
    vi.useFakeTimers();
    storage = TestBed.inject(StateStorage);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns null when nothing is saved', () => {
    expect(storage.load('k', parse)).toBeNull();
  });

  it('prefers the URL, then localStorage', () => {
    localStorage.setItem('k', 'x=2');
    expect(storage.load('k', parse)).toBe(2);
    history.replaceState(null, '', '/?x=1');
    expect(storage.load('k', parse)).toBe(1);
  });

  it('saves after a delay, keeping only the last value', () => {
    storage.save('k', new URLSearchParams('x=1'));
    storage.save('k', new URLSearchParams('x=3'));
    expect(localStorage.getItem('k')).toBeNull();
    vi.advanceTimersByTime(300);
    expect(localStorage.getItem('k')).toBe('x=3');
    expect(location.search).toBe('?x=3');
  });

  it('keeps query parameters that belong to other features', () => {
    history.replaceState(null, '', '/?other=7&x=1');
    storage.save('k', new URLSearchParams('x=2'));
    vi.advanceTimersByTime(300);
    const params = new URLSearchParams(location.search);
    expect(params.get('other')).toBe('7');
    expect(params.get('x')).toBe('2');
  });

  it('keeps working when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    storage.save('k', new URLSearchParams('x=5'));
    vi.advanceTimersByTime(300);
    expect(location.search).toBe('?x=5');
    history.replaceState(null, '', '/');
    expect(storage.load('k', parse)).toBeNull();
  });
});
