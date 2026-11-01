import { DEFAULT_INPUTS, DEFAULT_OPTIONS, calculatePlatform } from '@core/calculator';
import { buildPlatformPlan, buildSegmentTemplate } from './plan-svg';

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
    expect(t.svg).toContain('flip the template over');
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

describe('buildPlatformPlan', () => {
  it('is valid SVG with the pivot and both pieces', () => {
    const svg = buildPlatformPlan(DEFAULT_INPUTS, split);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelectorAll('rect.cut').length).toBe(2);
    expect(doc.querySelector('circle.pivot')).not.toBeNull();
    expect(svg).toContain('pivot to north bearing 536.42 mm');
  });

  it('draws one rectangle for a whole segment', () => {
    const doc = new DOMParser().parseFromString(
      buildPlatformPlan(DEFAULT_INPUTS, whole),
      'image/svg+xml',
    );
    expect(doc.querySelectorAll('rect.cut').length).toBe(1);
  });
});
