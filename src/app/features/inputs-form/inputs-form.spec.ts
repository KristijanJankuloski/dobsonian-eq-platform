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
    localStorage.clear();
    history.replaceState(null, '', '/');
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

  it('says which latitude limit was broken', async () => {
    await type('latitude', '95');
    field('latitude').dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(el.textContent).toContain('Must be at most 89');
    await type('latitude', '0.5');
    expect(el.textContent).toContain('Must be at least 1');
  });

  it('rejects an extra travel above the limit', async () => {
    await type('extra-travel', '340');
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('opens the Advanced panel when one of its fields is invalid', async () => {
    const panel = () => el.querySelector('mat-expansion-panel')!;
    expect(panel().classList).not.toContain('mat-expanded');
    await type('unused-middle', '95');
    expect(panel().classList).toContain('mat-expanded');
  });

  it('takes the free and drive roller diameters and rejects 0', async () => {
    await type('free-roller', '26');
    await type('drive-roller', '10');
    expect(fixture.componentInstance.value()?.options.freeRollerDiameterMm).toBe(26);
    expect(fixture.componentInstance.value()?.options.driveRollerDiameterMm).toBe(10);
    await type('drive-roller', '0');
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('requires the top board to be thinner than the platform', async () => {
    await type('top-board', '75');
    expect(fixture.componentInstance.value()).toBeNull();
    expect(el.querySelector('[data-testid="top-board-error"]')).not.toBeNull();
    await type('top-board', '12');
    expect(fixture.componentInstance.value()?.options.topBoardThicknessMm).toBe(12);
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

  it('starts from the values saved in the URL', async () => {
    TestBed.resetTestingModule();
    history.replaceState(null, '', '/?lat=40&a=15');
    await TestBed.configureTestingModule({ imports: [InputsForm] }).compileComponents();
    const f = TestBed.createComponent(InputsForm);
    await f.whenStable();
    expect(f.componentInstance.value()?.inputs.latitudeDeg).toBe(40);
    expect(f.componentInstance.value()?.inputs.scopeMassKg).toBe(15);
  });

  it('saves valid changes to the URL and not invalid ones', async () => {
    await type('latitude', '45');
    await vi.waitFor(() => expect(location.search).toContain('lat=45'));
    await type('latitude', '90');
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(location.search).toContain('lat=45');
    expect(location.search).not.toContain('lat=90');
  });
});
