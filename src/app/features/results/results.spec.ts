import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DEFAULT_INPUTS, calculatePlatform } from '@core/calculator';
import { Results } from './results';

describe('Results', () => {
  let fixture: ComponentFixture<Results>;
  let el: HTMLElement;

  async function setup(inputs = DEFAULT_INPUTS as typeof DEFAULT_INPUTS | null) {
    await TestBed.configureTestingModule({ imports: [Results] }).compileComponents();
    fixture = TestBed.createComponent(Results);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('inputs', inputs);
    fixture.componentRef.setInput('result', inputs ? calculatePlatform(inputs) : null);
    await fixture.whenStable();
  }

  it('shows a placeholder when there is no result', async () => {
    await setup(null);
    expect(el.querySelector('[data-testid="empty"]')).not.toBeNull();
    expect(el.querySelector('mat-card')).toBeNull();
  });

  it('renders the reference values for the defaults', async () => {
    await setup();
    const text = el.textContent!;
    expect(text).toContain('597.7 mm'); // H
    expect(text).toContain('462.7 mm'); // I
    expect(text).toContain('504.9 mm'); // P
    expect(text).toContain('242.7 mm'); // Q
    expect(text).toContain('61.75 °'); // O
    expect(el.querySelector('[data-testid="card-segments"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="warning"]')).toBeNull();
  });

  it('shows the low-latitude warning', async () => {
    await setup({ ...DEFAULT_INPUTS, latitudeDeg: 5 });
    expect(el.querySelector('[data-testid="warning"]')?.textContent).toContain('Latitude');
  });

  it('copies a section to the clipboard', async () => {
    await setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const open = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    el.querySelector<HTMLButtonElement>('[data-testid="card-platform"] button')!.click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('Platform dimensions');
    expect(writeText.mock.calls[0][0]).toContain('H): 597.7 mm');
    expect(open).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
