import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DEFAULT_INPUTS, calculatePlatform } from '@core/calculator';
import { Viewer } from './viewer';
import { VIEWER_RENDERER_FACTORY, ViewerRenderer } from './viewer-renderer';

/** A renderer that records calls instead of using WebGL (jsdom has none). */
function fakeRenderer() {
  const renderer = {
    domElement: document.createElement('canvas'),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    setClearColor: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
  };
  return renderer satisfies ViewerRenderer;
}

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

describe('Viewer', () => {
  let renderer: ReturnType<typeof fakeRenderer>;
  let fixture: ComponentFixture<Viewer>;
  let el: HTMLElement;

  async function setup(options: { webgl?: boolean; withResult?: boolean } = {}) {
    const { webgl = true, withResult = true } = options;
    renderer = fakeRenderer();
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    await TestBed.configureTestingModule({
      imports: [Viewer],
      providers: [
        {
          provide: VIEWER_RENDERER_FACTORY,
          useValue: () => {
            if (!webgl) throw new Error('no WebGL');
            return renderer;
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Viewer);
    el = fixture.nativeElement;
    if (withResult) {
      fixture.componentRef.setInput('inputs', DEFAULT_INPUTS);
      fixture.componentRef.setInput('result', calculatePlatform(DEFAULT_INPUTS));
    }
    await fixture.whenStable();
  }

  afterEach(() => vi.unstubAllGlobals());

  it('creates its scene, sizes the canvas and renders', async () => {
    await setup();
    expect(el.querySelector('canvas')).toBe(renderer.domElement);
    expect(renderer.setSize).toHaveBeenCalled();
    expect(renderer.setPixelRatio).toHaveBeenCalled();
    await vi.waitFor(() => expect(renderer.render).toHaveBeenCalled());
  });

  it('disposes the renderer and removes the canvas on destroy', async () => {
    await setup();
    fixture.destroy();
    expect(renderer.dispose).toHaveBeenCalled();
    expect(renderer.forceContextLoss).toHaveBeenCalled();
    expect(renderer.domElement.isConnected).toBe(false);
  });

  it('shows a message and no controls when WebGL is unavailable', async () => {
    await setup({ webgl: false });
    expect(el.querySelector('[data-testid="viewer-unavailable"]')?.textContent).toContain('WebGL');
    expect(el.querySelector('[data-testid="reset-view"]')).toBeNull();
    expect(() => fixture.destroy()).not.toThrow();
  });

  it('shows a prompt and draws nothing while the inputs are invalid', async () => {
    await setup({ withResult: false });
    expect(el.querySelector('[data-testid="viewer-empty"]')).not.toBeNull();
    expect(() => fixture.destroy()).not.toThrow();
  });

  it('re-renders after a debounced rebuild when the result changes', async () => {
    await setup();
    await vi.waitFor(() => expect(renderer.render).toHaveBeenCalled());
    const before = renderer.render.mock.calls.length;
    const inputs = { ...DEFAULT_INPUTS, latitudeDeg: 40 };
    fixture.componentRef.setInput('inputs', inputs);
    fixture.componentRef.setInput('result', calculatePlatform(inputs));
    await fixture.whenStable();
    await vi.waitFor(() => expect(renderer.render.mock.calls.length).toBeGreaterThan(before));
  });

  it('notes a segment that cannot be drawn', async () => {
    await setup();
    const inputs = { ...DEFAULT_INPUTS, platformThicknessMm: 500 };
    fixture.componentRef.setInput('inputs', inputs);
    fixture.componentRef.setInput('result', calculatePlatform(inputs));
    await fixture.whenStable();
    await vi.waitFor(() => expect(el.querySelector('[data-testid="viewer-note"]')).not.toBeNull());
  });

  it('renders again when a view toggle changes', async () => {
    await setup();
    await vi.waitFor(() => expect(renderer.render).toHaveBeenCalled());
    const before = renderer.render.mock.calls.length;
    el.querySelector<HTMLButtonElement>('[data-testid="toggle-wireframe"] button')!.click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(renderer.render.mock.calls.length).toBeGreaterThan(before));
  });

  it('limits the tracking slider to half the extra travel either side', async () => {
    await setup();
    const thumb = el.querySelector<HTMLInputElement>('[data-testid="angle-slider"]')!;
    expect(Number(thumb.min)).toBeCloseTo(-11.25, 6);
    expect(Number(thumb.max)).toBeCloseTo(11.25, 6);
  });

  it('sizes the canvas to its host with CSS, whatever the pixel ratio', async () => {
    await setup();
    const style = getComputedStyle(renderer.domElement);
    expect(style.width).toBe('100%');
    expect(style.height).toBe('100%');
  });

  it('plays the tracking animation and stops on pause', async () => {
    await setup();
    const play = el.querySelector<HTMLButtonElement>('[data-testid="play"]')!;
    play.click();
    await fixture.whenStable();
    expect(play.textContent).toContain('Pause');
    await vi.waitFor(() =>
      expect(el.querySelector('[data-testid="angle-readout"]')!.textContent).not.toContain('0.0°'),
    );
    play.click();
    await fixture.whenStable();
    expect(play.textContent).toContain('Play');
    expect(() => fixture.destroy()).not.toThrow();
  });

  it('makes the canvas area focusable with an accessible name and keyboard panning', async () => {
    await setup();
    const host = el.querySelector<HTMLElement>('[data-testid="viewer-host"]')!;
    expect(host.getAttribute('tabindex')).toBe('0');
    expect(host.getAttribute('aria-label')).toContain('arrow keys');
    expect(el.querySelector('h2')?.textContent).toContain('3D view');
    expect(
      el.querySelector('input[aria-label="Tracking angle"]')?.getAttribute('aria-valuetext'),
    ).toContain('degrees');
  });
});
