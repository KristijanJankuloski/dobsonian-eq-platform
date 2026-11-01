import { TestBed } from '@angular/core/testing';
import { DEFAULT_INPUTS, calculatePlatform } from '@core/calculator';
import { FileDownload } from '@shared/services/file-download';
import { Plans } from './plans';

describe('Plans', () => {
  async function setup(inputs = DEFAULT_INPUTS) {
    const save = vi.fn();
    await TestBed.configureTestingModule({
      imports: [Plans],
      providers: [{ provide: FileDownload, useValue: { save } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(Plans);
    fixture.componentRef.setInput('inputs', inputs);
    fixture.componentRef.setInput('result', calculatePlatform(inputs));
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, save };
  }

  it('shows both drawings', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('svg').length).toBe(2);
    expect(el.textContent).toContain('Two pieces');
  });

  it('downloads each drawing as an SVG file', async () => {
    const { el, save } = await setup();
    (el.querySelector('[data-testid="download-template"]') as HTMLButtonElement).click();
    (el.querySelector('[data-testid="download-plan"]') as HTMLButtonElement).click();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0][0]).toBe('north-segment-template-1to1.svg');
    expect(save.mock.calls[0][1]).toContain('<svg');
    expect(save.mock.calls[1][0]).toBe('platform-plan.svg');
  });

  it('offers no drawings when the segment cannot be built', async () => {
    const { el } = await setup({ ...DEFAULT_INPUTS, latitudeDeg: 85 });
    expect(el.querySelectorAll('svg').length).toBe(0);
    expect(el.querySelector('[data-testid="plans-unavailable"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="download-template"]')).toBeNull();
  });
});
