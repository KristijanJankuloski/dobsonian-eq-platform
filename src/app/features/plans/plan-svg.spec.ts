import { DEFAULT_INPUTS, DEFAULT_OPTIONS, calculatePlatform } from '@core/calculator';
import { BOARD_CLASS, TEMPLATE_CLASS, buildBoardTemplate, buildSegmentTemplate } from './plan-svg';
import { DRAWING_CLASS, buildPlatformDrawing } from './platform-drawing';

const split = calculatePlatform(DEFAULT_INPUTS);
const whole = calculatePlatform(DEFAULT_INPUTS, { ...DEFAULT_OPTIONS, unusedMiddlePercent: 0 });

describe('buildSegmentTemplate', () => {
  it('is a valid SVG sized in millimetres for 1:1 printing', () => {
    const t = buildSegmentTemplate(split);
    const doc = new DOMParser().parseFromString(t.svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    const svg = doc.documentElement;
    expect(svg.getAttribute('width')).toMatch(/mm$/);
    const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    expect(parseFloat(svg.getAttribute('width')!)).toBeCloseTo(w, 2);
    expect(parseFloat(svg.getAttribute('height')!)).toBeCloseTo(h, 2);
  });

  it('describes one of two mirrored pieces by default', () => {
    const t = buildSegmentTemplate(split);
    const g = split.geometry;
    expect(t.pieces).toBe(2);
    const inner = (g.pieceInnerAngleDeg * Math.PI) / 180;
    const outer = (g.pieceOuterAngleDeg * Math.PI) / 180;
    expect(t.widthMm).toBeCloseTo(g.northRadiusMm * (Math.sin(outer) - Math.sin(inner)), 1);
    expect(t.heightMm).toBeCloseTo(g.pieceHeightMm, 1);
    expect(t.widthMm).toBeCloseTo(g.pieceWidthMm, 1);
    expect(t.svg).toContain('flip the template over');
    expect(t.svg).toContain('underside of the 18 mm top board');
  });

  it('scopes its styles to its own root, so inline previews do not restyle the page', () => {
    for (const svg of [
      buildSegmentTemplate(split).svg,
      buildBoardTemplate(DEFAULT_INPUTS, split),
      buildPlatformDrawing(DEFAULT_INPUTS, split).svg,
    ]) {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const root = doc.documentElement.getAttribute('class')!;
      expect([TEMPLATE_CLASS, BOARD_CLASS, DRAWING_CLASS]).toContain(root);
      const css = doc.querySelector('style')!.textContent!;
      const selectors = css
        .split('}')
        .map((rule) => rule.split('{')[0].trim())
        .filter(Boolean);
      expect(selectors.length).toBeGreaterThan(0);
      for (const sel of selectors) expect(sel.startsWith(`.${root} `)).toBe(true);
    }
  });

  it('names the south segment in the southern hemisphere', () => {
    const t = buildSegmentTemplate(split, -35);
    expect(t.pole).toBe('South');
    expect(t.svg).toContain('South segment template');
  });

  it('is one whole segment when no middle is left out', () => {
    const t = buildSegmentTemplate(whole);
    const g = whole.geometry;
    expect(t.pieces).toBe(1);
    expect(t.widthMm).toBeCloseTo(
      2 * g.northRadiusMm * Math.sin((g.segmentAngleDeg / 2 / 180) * Math.PI),
      1,
    );
    expect(t.svg).not.toContain('flip');
  });
});

describe('buildBoardTemplate', () => {
  const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');

  it('is a 1:1 SVG of the board outline with the pivot, pieces and rollers', () => {
    const svg = buildBoardTemplate(DEFAULT_INPUTS, split);
    const doc = parse(svg);
    expect(doc.querySelector('parsererror')).toBeNull();
    const root = doc.documentElement;
    const [, , w] = root.getAttribute('viewBox')!.split(' ').map(Number);
    expect(parseFloat(root.getAttribute('width')!)).toBeCloseTo(w, 2);
    // Outline path, one pivot, two dashed piece rectangles.
    expect(doc.querySelectorAll('path.cut').length).toBe(1);
    expect(doc.querySelector('circle.pivot')).not.toBeNull();
    expect(doc.querySelectorAll('rect.dash').length).toBe(2);
    expect(svg).toContain('south pivot');
    expect(svg).toContain('Cut 2');
    expect(svg).toContain('100 mm');
  });

  it('swaps the pole and pivot names in the southern hemisphere', () => {
    const inputs = { ...DEFAULT_INPUTS, latitudeDeg: -50.7279 };
    const svg = buildBoardTemplate(inputs, calculatePlatform(inputs));
    expect(svg).toContain('north pivot');
    expect(svg).toContain('>S</text>');
  });

  it('draws one piece rectangle for a whole segment', () => {
    const doc = parse(buildBoardTemplate(DEFAULT_INPUTS, whole));
    expect(doc.querySelectorAll('rect.dash').length).toBe(1);
  });
});
