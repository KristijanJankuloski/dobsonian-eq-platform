import { DEFAULT_INPUTS, DEFAULT_OPTIONS, calculatePlatform } from '@core/calculator';
import { buildViewerModel } from '@shared/models/platform-model';
import { DRAWING_SCALES, buildPlatformDrawing, fmt } from './platform-drawing';

const split = calculatePlatform(DEFAULT_INPUTS);
const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');
const texts = (svg: string) =>
  Array.from(parse(svg).querySelectorAll('text')).map((t) => t.textContent ?? '');

describe('fmt', () => {
  it('rounds to 0.1 mm and drops a trailing .0', () => {
    expect(fmt(504.925)).toBe('504.9');
    expect(fmt(75)).toBe('75');
    expect(fmt(-0.01)).toBe('0');
  });
});

describe('buildPlatformDrawing', () => {
  it('is a valid A3 landscape SVG sized in mm, at a standard scale', () => {
    const d = buildPlatformDrawing(DEFAULT_INPUTS, split, '2026-11-02');
    const doc = parse(d.svg);
    expect(doc.querySelector('parsererror')).toBeNull();
    const root = doc.documentElement;
    expect(root.getAttribute('width')).toBe('420mm');
    expect(root.getAttribute('height')).toBe('297mm');
    expect(root.getAttribute('viewBox')).toBe('0 0 420 297');
    expect(d.sheet).toBe('A3');
    expect(DRAWING_SCALES).toContain(d.scale);
    expect(d.scale).toBe(5);
  });

  it('has the three views, a title block and the measurement table', () => {
    const d = buildPlatformDrawing(DEFAULT_INPUTS, split, '2026-11-02');
    const all = texts(d.svg);
    expect(all.some((t) => t.startsWith('FRONT VIEW'))).toBe(true);
    expect(all.some((t) => t.startsWith('SIDE VIEW'))).toBe(true);
    expect(all.some((t) => t.startsWith('PLAN'))).toBe(true);
    for (const label of ['PROJECT', 'TITLE', 'SCALE', 'DATE', 'MEASUREMENTS (mm)']) {
      expect(all).toContain(label);
    }
    expect(all).toContain('1:5');
    expect(all).toContain('2026-11-02');
    expect(all).toContain('Platform and base, latitude 50.7° N');
  });

  it('dimensions the board outline and the platform from the calculator values', () => {
    const model = buildViewerModel(DEFAULT_INPUTS, split);
    const b = model.board;
    const all = texts(buildPlatformDrawing(DEFAULT_INPUTS, split).svg);
    // Overall length and width, the arcs, platform height F and pivot to bearing T.
    expect(all).toContain(fmt(b.lengthMm));
    expect(all).toContain(fmt(b.widthMm));
    expect(all).toContain(`R ${fmt(b.mountArc.radiusMm)}`);
    expect(all).toContain('R 60');
    expect(all).toContain('75');
    expect(all).toContain('T 536.4 (pivot to bearing contact)');
    // Pivot measured from the pole edge.
    expect(all).toContain(fmt(b.poleEdgeZ - model.pivot.z));
    // Rollers on the base.
    expect(all.some((t) => t.startsWith(`2, ${fmt(b.poleEdgeZ - model.rollers[0].z)} from`))).toBe(
      true,
    );
  });

  it('draws both segment pieces in the front and plan views, or one whole segment', () => {
    const doc = parse(buildPlatformDrawing(DEFAULT_INPUTS, split).svg);
    // 2 in front view + 1 band in the side view.
    expect(doc.querySelectorAll('path.part').length).toBe(3);
    expect(doc.querySelectorAll('rect.hidden').length).toBe(2);
    const whole = calculatePlatform(DEFAULT_INPUTS, { ...DEFAULT_OPTIONS, unusedMiddlePercent: 0 });
    const docW = parse(buildPlatformDrawing(DEFAULT_INPUTS, whole).svg);
    expect(docW.querySelectorAll('path.part').length).toBe(2);
    expect(docW.querySelectorAll('rect.hidden').length).toBe(1);
  });

  it('picks a smaller scale for a bigger platform', () => {
    const inputs = { ...DEFAULT_INPUTS, latitudeDeg: 15 };
    const d = buildPlatformDrawing(inputs, calculatePlatform(inputs));
    expect(d.scale).toBeGreaterThan(5);
    expect(parse(d.svg).querySelector('parsererror')).toBeNull();
  });

  it('names the ends for the southern hemisphere', () => {
    const inputs = { ...DEFAULT_INPUTS, latitudeDeg: -35 };
    const all = texts(buildPlatformDrawing(inputs, calculatePlatform(inputs)).svg);
    expect(all).toContain('FRONT VIEW (from the north end)');
    expect(all).toContain('North pivot');
    expect(all.some((t) => t.includes('latitude 35° S'))).toBe(true);
  });
});
