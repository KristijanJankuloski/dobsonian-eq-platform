import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    history.replaceState(null, '', '/');
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows results for the default inputs', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Dobsonian EQ Platform Calculator');
    expect(el.textContent).toContain('597.7 mm');
  });

  it('shows both marking-out sketches and hides them when inputs are invalid', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="sketch-north"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sketch-south"]')).not.toBeNull();

    const lat = el.querySelector<HTMLInputElement>('[data-testid="latitude"]')!;
    lat.value = '90';
    lat.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="sketch-north"]')).toBeNull();
  });

  it('updates the results when an input changes and hides them when invalid', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const lat = el.querySelector<HTMLInputElement>('[data-testid="latitude"]')!;

    lat.value = '90';
    lat.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="empty"]')).not.toBeNull();

    lat.value = '45';
    lat.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="empty"]')).toBeNull();
    expect(el.textContent).not.toContain('597.7 mm');
  });
});
