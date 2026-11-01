import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { NumericField } from './numeric-field';

describe('NumericField', () => {
  let fixture: ComponentFixture<NumericField>;
  let control: FormControl<number | null>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NumericField] }).compileComponents();
    control = new FormControl<number | null>(5, [Validators.required, Validators.min(1)]);
    fixture = TestBed.createComponent(NumericField);
    fixture.componentRef.setInput('control', control);
    fixture.componentRef.setInput('label', 'Latitude');
    fixture.componentRef.setInput('unit', '°');
    fixture.componentRef.setInput('testId', 'lat');
    await fixture.whenStable();
  });

  it('renders the label, unit and value', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Latitude');
    expect(el.textContent).toContain('°');
    const input = el.querySelector<HTMLInputElement>('[data-testid="lat"]')!;
    expect(input.value).toBe('5');
  });

  it('updates the control when typing and shows an error when invalid', async () => {
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector<HTMLInputElement>('[data-testid="lat"]')!;
    input.value = '0';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(control.value).toBe(0);
    expect(control.invalid).toBe(true);
    expect(el.querySelector('mat-error')?.textContent).toContain('at least 1');
  });
});
