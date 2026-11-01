import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DEFAULT_INPUTS, DEFAULT_OPTIONS } from '@core/calculator';
import { InputsForm } from './inputs-form';

describe('InputsForm', () => {
  let fixture: ComponentFixture<InputsForm>;
  let el: HTMLElement;

  const field = (id: string) => el.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!;

  async function type(id: string, value: string) {
    const input = field(id);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [InputsForm] }).compileComponents();
    fixture = TestBed.createComponent(InputsForm);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('emits the default inputs and options', () => {
    expect(fixture.componentInstance.value()).toEqual({
      inputs: DEFAULT_INPUTS,
      options: DEFAULT_OPTIONS,
    });
  });

  it('emits updated values when a field changes', async () => {
    await type('latitude', '45');
    expect(fixture.componentInstance.value()?.inputs.latitudeDeg).toBe(45);
  });

  it('emits null for latitude outside 1–89', async () => {
    await type('latitude', '90');
    expect(fixture.componentInstance.value()).toBeNull();
    await type('latitude', '0.5');
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('accepts a negative (southern) latitude', async () => {
    await type('latitude', '-35');
    expect(fixture.componentInstance.value()?.inputs.latitudeDeg).toBe(-35);
  });

  it('emits null and shows a message when the total mass is zero', async () => {
    await type('scope-mass', '0');
    await type('mount-mass', '0');
    expect(fixture.componentInstance.value()).toBeNull();
    expect(el.querySelector('[data-testid="mass-error"]')).not.toBeNull();
  });

  it('emits null when a field is empty', async () => {
    await type('base-width', '');
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('resets to the defaults', async () => {
    await type('latitude', '45');
    field('reset').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()?.inputs.latitudeDeg).toBe(DEFAULT_INPUTS.latitudeDeg);
  });
});
