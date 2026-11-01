import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Drive } from './drive';

describe('Drive', () => {
  let fixture: ComponentFixture<Drive>;
  let el: HTMLElement;

  const field = (id: string) => el.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!;

  async function type(id: string, value: string) {
    const input = field(id);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    localStorage.clear();
    history.replaceState(null, '', '/');
    await TestBed.configureTestingModule({ imports: [Drive] }).compileComponents();
    fixture = TestBed.createComponent(Drive);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('northRadiusMm', 462.744);
    await fixture.whenStable();
  });

  it('shows the worm drive result for the spreadsheet defaults (sidereal on)', () => {
    // 58.348 × 1436.07 / 1440 = 58.188 → 58 teeth.
    const text = el.querySelector('[data-testid="worm-results"]')!.textContent!;
    expect(text).toContain('58.188');
    expect(text).toContain('58');
  });

  it('matches the spreadsheet ratio with the sidereal correction off', async () => {
    el.querySelector<HTMLButtonElement>('[data-testid="sidereal"] button')!.click();
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="worm-results"]')!.textContent).toContain('58.348');
  });

  it('shows a prompt instead of results without a north radius', async () => {
    fixture.componentRef.setInput('northRadiusMm', null);
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="worm-results"]')).toBeNull();
    expect(el.querySelector('[data-testid="worm-empty"]')).not.toBeNull();
  });

  it('hides the worm results while a field is invalid', async () => {
    await type('motor-rpm', '0');
    expect(el.querySelector('[data-testid="worm-results"]')).toBeNull();
  });

  it('asks for both direct-drive fields, then shows the radius and difference', async () => {
    expect(el.querySelector('[data-testid="direct-results"]')).toBeNull();
    await type('motor-rph', '4');
    expect(el.querySelector('[data-testid="direct-incomplete"]')).not.toBeNull();
    await type('shaft-diameter', '12.7');
    const text = el.querySelector('[data-testid="direct-results"]')!.textContent!;
    expect(text).toContain('607.9 mm');
    expect(text).toContain('145.2 mm'); // 607.9 − 462.7
    expect(el.querySelector('[data-testid="direct-incomplete"]')).toBeNull();
  });

  it('saves valid drive inputs to the URL without removing other keys', async () => {
    history.replaceState(null, '', '/?lat=45');
    await type('spindle-diameter', '10');
    await vi.waitFor(() => expect(location.search).toContain('sd=10'));
    expect(location.search).toContain('lat=45');
  });

  it('starts from drive values in the URL', async () => {
    TestBed.resetTestingModule();
    history.replaceState(null, '', '/?sd=8&rpm=2&sid=0&rph=4&shaft=12.7');
    await TestBed.configureTestingModule({ imports: [Drive] }).compileComponents();
    const f = TestBed.createComponent(Drive);
    f.componentRef.setInput('northRadiusMm', 462.744);
    await f.whenStable();
    const e = f.nativeElement as HTMLElement;
    expect(e.querySelector<HTMLInputElement>('[data-testid="spindle-diameter"]')!.value).toBe('8');
    expect(e.querySelector('[data-testid="direct-results"]')).not.toBeNull();
  });
});
