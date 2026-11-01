import { DEFAULT_INPUTS, calculatePlatform } from '@core/calculator';
import { buildViewerModel, segmentProfile, Vec3 } from './viewer-model';

const model = (over = {}) => {
  const inputs = { ...DEFAULT_INPUTS, ...over };
  return { inputs, model: buildViewerModel(inputs, calculatePlatform(inputs)) };
};
const dot = (p: Vec3, q: Vec3) => p.x * q.x + p.y * q.y + p.z * q.z;
const dist = (p: Vec3, q: Vec3) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

describe('buildViewerModel', () => {
  it('has orthonormal axis directions', () => {
    const { model: m } = model();
    expect(Math.hypot(m.axisDir.x, m.axisDir.y, m.axisDir.z)).toBeCloseTo(1, 12);
    expect(dot(m.axisDir, m.planeUp)).toBeCloseTo(0, 12);
    expect(m.axisDir.y).toBeCloseTo(Math.sin((50.7279 * Math.PI) / 180), 12);
    expect(m.axisDir.z).toBeGreaterThan(0); // points north
  });

  it('puts each segment centre on the axis at the reference radius from its contact point', () => {
    const { model: m } = model();
    const north = m.segments.find((s) => s.id === 'north')!;
    const south = m.segments.find((s) => s.id === 'south')!;
    expect(dist(north.centre, north.contact)).toBeCloseTo(462.744, 2); // I
    expect(dist(south.centre, south.contact)).toBeCloseTo(207.275, 2); // K
    expect(north.contact.z).toBeCloseTo(597.746, 3); // H
    expect(south.contact.z).toBeCloseTo(267.746, 3); // J
    // The contact point is perpendicular to the axis from the centre.
    const toContact = {
      x: north.contact.x - north.centre.x,
      y: north.contact.y - north.centre.y,
      z: north.contact.z - north.centre.z,
    };
    expect(dot(toContact, m.axisDir)).toBeCloseTo(0, 6);
    // ...and points along −e2 (down and north), touching the ground line.
    expect(dot(toContact, m.planeUp)).toBeCloseTo(-462.744, 2);
  });

  it('places the platform plane at M = I − L from the axis (SPEC §4.3)', () => {
    const { model: m } = model();
    const north = m.segments.find((s) => s.id === 'north')!;
    // Flat edge: first two profile points, at b = −M. M = 344.262.
    expect(north.profile[0].b).toBeCloseTo(-344.262, 2);
    // A point on that edge, mapped to 3D, sits at height y = F.
    const a = north.profile[0].a;
    const b = north.profile[0].b;
    const y = north.centre.y + b * m.planeUp.y; // a runs east, so it does not change y
    expect(a).toBeLessThan(0);
    expect(y).toBeCloseTo(75, 6);
  });

  it('puts the arc between the ends at the segment angle and the radius', () => {
    const { model: m } = model();
    const north = m.segments.find((s) => s.id === 'north')!;
    const arc = north.profile.slice(2);
    for (const p of arc) expect(Math.hypot(p.a, p.b)).toBeCloseTo(462.744, 3);
    const first = arc[0];
    const last = arc[arc.length - 1];
    const angle = 2 * Math.atan2(first.a, -first.b);
    expect((angle * 180) / Math.PI).toBeCloseTo(61.749, 3);
    expect(first.a).toBeCloseTo(-last.a, 9);
  });

  it('puts the combined centre of gravity on the axis at height G + F', () => {
    const { model: m } = model();
    expect(m.cog.y).toBeCloseTo(454.238 + 75, 3);
    // Directly above the mount centre.
    expect(m.cog.z).toBeCloseTo((597.746 + 267.746) / 2, 3);
    expect(m.cog.x).toBe(0);
  });

  it('sizes the mount footprint from E and sits it on the platform plane', () => {
    const { model: m } = model();
    expect(m.mountBox.size.x).toBe(330);
    expect(m.mountBox.centre.y - m.mountBox.size.y / 2).toBeCloseTo(75, 9);
    expect(m.mountBox.size.y).toBeCloseTo(450, 9); // 2 × D
    expect(m.topBoard.size.x).toBeGreaterThanOrEqual(445.7);
  });

  it('gives a camera target inside the scene and a positive distance', () => {
    const { model: m } = model();
    expect(m.camera.distanceMm).toBeGreaterThan(m.groundBoard.size.z);
    expect(m.halfTravelDeg).toBeCloseTo(61.749 / 2, 3);
  });

  it('mirrors a southern latitude', () => {
    const north = model().model;
    const south = model({ latitudeDeg: -50.7279 }).model;
    expect(south.axisDir).toEqual(north.axisDir);
    expect(south.latitudeDeg).toBeCloseTo(50.7279, 9);
  });

  it('skips a segment that cannot be drawn instead of producing a bad shape', () => {
    // A very thick platform makes L larger than the south radius.
    const { model: m } = model({ platformThicknessMm: 300 });
    expect(m.skipped.length).toBeGreaterThan(0);
    for (const s of m.segments)
      for (const p of s.profile) expect(Number.isFinite(p.a + p.b)).toBe(true);
  });

  it('includes a north marker and a dimension label per drawn segment', () => {
    const { model: m } = model();
    const texts = m.labels.map((l) => l.text);
    expect(texts).toContain('N');
    expect(texts).toContain('I = 463 mm');
    expect(texts).toContain('K = 207 mm');
  });
});

describe('segmentProfile', () => {
  it('rejects degenerate shapes', () => {
    expect(segmentProfile(100, 0, 60)).toBeNull();
    expect(segmentProfile(100, -5, 60)).toBeNull();
    expect(segmentProfile(100, 95, 60)).toBeNull(); // arc ends above the flat edge
    expect(segmentProfile(100, 50, 0)).toBeNull();
    expect(segmentProfile(100, 50, 200)).toBeNull();
    expect(segmentProfile(0, 50, 60)).toBeNull();
  });

  it('builds a closed outline with the flat edge on top', () => {
    const p = segmentProfile(100, 60, 60)!;
    expect(p[0].a).toBeCloseTo(-50, 9);
    expect(p[0].b).toBe(-60);
    expect(p[1].a).toBeCloseTo(50, 9);
    expect(p[1].b).toBe(-60);
    expect(p.length).toBe(2 + 49);
  });
});
