import { buildSegmentSketch } from './segment-sketch';

describe('buildSegmentSketch', () => {
  it('computes the chord from radius and angle (reference north segment)', () => {
    // I = 462.744 mm, O = 61.749°: chord without the 30 mm margin is P − 30.
    const s = buildSegmentSketch(462.744, 61.749);
    expect(s.chordMm).toBeCloseTo(504.925 - 30, 2);
  });

  it('places the arc ends symmetrically at the radius from the centre', () => {
    const s = buildSegmentSketch(300, 90);
    expect(s.arcStart.x).toBeCloseTo(-s.arcEnd.x, 6);
    expect(s.arcStart.y).toBeCloseTo(s.arcEnd.y, 6);
    expect(Math.hypot(s.arcEnd.x, s.arcEnd.y)).toBeCloseTo(300, 1);
    expect(s.arcEnd.x).toBeCloseTo(300 * Math.SQRT1_2, 1);
  });

  it('emits an SVG arc path ending at the arc end', () => {
    const s = buildSegmentSketch(300, 90);
    expect(s.arcPath).toMatch(/^M -212\.13 212\.13 A 300 300 0 0 0 212\.13 212\.13$/);
  });

  it('sets the large-arc flag above 180°', () => {
    expect(buildSegmentSketch(100, 200).arcPath).toContain('A 100 100 0 1 0');
    expect(buildSegmentSketch(100, 170).arcPath).toContain('A 100 100 0 0 0');
  });

  it('gives a viewBox that contains the centre and the arc', () => {
    const s = buildSegmentSketch(462.744, 61.749);
    const [x, y, w, h] = s.viewBox.split(' ').map(Number);
    expect(x).toBeLessThan(s.arcStart.x);
    expect(x + w).toBeGreaterThan(s.arcEnd.x);
    expect(y).toBeLessThan(0);
    expect(y + h).toBeGreaterThan(462.744);
  });

  it.each([200, 300])('keeps an arc of %s° inside the viewBox', (angle) => {
    const s = buildSegmentSketch(100, angle);
    const [x, y, w, h] = s.viewBox.split(' ').map(Number);
    // Past 180° the arc ends rise above the centre; past 90° each side it bulges to ±R.
    expect(y).toBeLessThan(Math.min(s.arcStart.y, 0));
    expect(x).toBeLessThan(-100);
    expect(x + w).toBeGreaterThan(100);
    expect(y + h).toBeGreaterThan(100);
  });

  it('rejects invalid radius and angle', () => {
    expect(() => buildSegmentSketch(0, 60)).toThrow(RangeError);
    expect(() => buildSegmentSketch(100, 0)).toThrow(RangeError);
    expect(() => buildSegmentSketch(100, 360)).toThrow(RangeError);
    expect(() => buildSegmentSketch(NaN, 60)).toThrow(RangeError);
  });
});
