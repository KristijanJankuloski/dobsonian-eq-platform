import { DEFAULT_INPUTS, DEFAULT_OPTIONS, calculatePlatform } from '@core/calculator';
import { buildViewerModel, pieceProfile, segmentProfile, Vec3 } from './platform-model';

// One whole segment unless a test asks for the split.
const WHOLE = { ...DEFAULT_OPTIONS, unusedMiddlePercent: 0 };
const model = (over = {}, options = WHOLE) => {
  const inputs = { ...DEFAULT_INPUTS, ...over };
  return { inputs, model: buildViewerModel(inputs, calculatePlatform(inputs, options)) };
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

  it('puts the segment centre on the axis at the reference radius from its contact point', () => {
    const { model: m } = model();
    const north = m.segments.find((s) => s.id === 'whole')!;
    expect(m.segments.length).toBe(1);
    // The lowest point of the arc, (a, b) = (0, −I), mapped to 3D.
    const contact = {
      x: north.centre.x - 462.744 * m.planeUp.x,
      y: north.centre.y - 462.744 * m.planeUp.y,
      z: north.centre.z - 462.744 * m.planeUp.z,
    };
    expect(dist(north.centre, contact)).toBeCloseTo(462.744, 2); // I
    expect(contact.y).toBeCloseTo(0, 2); // on the ground
    expect(contact.z).toBeCloseTo(597.746, 2); // H
    // The contact point is perpendicular to the axis from the centre.
    const toContact = {
      x: contact.x - north.centre.x,
      y: contact.y - north.centre.y,
      z: contact.z - north.centre.z,
    };
    expect(dot(toContact, m.axisDir)).toBeCloseTo(0, 6);
    // ...and points along −e2 (down and north), touching the ground line.
    expect(dot(toContact, m.planeUp)).toBeCloseTo(-462.744, 2);
  });

  it('builds two mirrored end pieces around the unused middle by default', () => {
    const { model: m } = model({}, DEFAULT_OPTIONS);
    expect(m.segments.map((s) => s.id)).toEqual(['piece-east', 'piece-west']);
    // +x is west in the northern hemisphere, so the west piece is on +a.
    const [east, west] = m.segments;
    const g = calculatePlatform(DEFAULT_INPUTS).geometry;
    const inner = (g.pieceInnerAngleDeg * Math.PI) / 180;
    for (const p of west.profile.slice(0, 1)) {
      expect(p.a).toBeCloseTo(g.northRadiusMm * Math.sin(inner), 6);
    }
    // The west piece is the east piece mirrored across the centre line.
    east.profile.forEach((p, i) => {
      expect(west.profile[i].a).toBeCloseTo(-p.a, 9);
      expect(west.profile[i].b).toBeCloseTo(p.b, 9);
    });
    // Every point stays east or west of the unused middle.
    for (const p of west.profile)
      expect(p.a).toBeGreaterThanOrEqual(g.northRadiusMm * Math.sin(inner) - 1e-6);
  });

  it('puts the south pivot on the polar axis in the platform plane', () => {
    const { model: m } = model();
    expect(m.pivot.y).toBeCloseTo(75, 9); // F
    expect(m.pivot.z).toBeCloseTo(61.3, 1);
    // On the axis through the origin: pivot ∥ axisDir.
    expect(m.pivot.y / m.axisDir.y).toBeCloseTo(m.pivot.z / m.axisDir.z, 9);
  });

  it('puts the flat edge against the underside of the top board', () => {
    const { model: m } = model();
    const north = m.segments.find((s) => s.id === 'whole')!;
    const t = DEFAULT_OPTIONS.topBoardThicknessMm;
    const cosA = Math.cos((50.7279 * Math.PI) / 180);
    // Flat edge: first two profile points, at b = −(M + t / cos α). M = 344.262.
    expect(north.profile[0].b).toBeCloseTo(-(344.262 + t / cosA), 2);
    // A point on that edge, mapped to 3D, sits at the board's underside y = F − t.
    const a = north.profile[0].a;
    const b = north.profile[0].b;
    const y = north.centre.y + b * m.planeUp.y; // a runs along x, so it does not change y
    expect(a).toBeLessThan(0);
    expect(y).toBeCloseTo(75 - t, 6);
    expect(m.topBoard.centre.y - m.topBoard.size.y / 2).toBeCloseTo(75 - t, 9);
  });

  it('puts the flat edge on the platform top with no top board (M = I − L)', () => {
    const { model: m } = model({}, { ...WHOLE, topBoardThicknessMm: 0 });
    expect(m.segments[0].profile[0].b).toBeCloseTo(-344.262, 2);
  });

  it('puts the arc between the ends at the segment angle and the radius', () => {
    const { model: m } = model();
    const north = m.segments.find((s) => s.id === 'whole')!;
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
    // At least the chord P, which is wider than E + I/4 here.
    expect(m.topBoard.size.x).toBeCloseTo(504.925, 3);
  });

  it('gives a camera target inside the scene and a positive distance', () => {
    const { model: m } = model();
    expect(m.camera.distanceMm).toBeGreaterThan(m.groundBoard.size.z);
  });

  it('turns through half the extra travel either side, against the Earth', () => {
    const { model: m } = model();
    expect(m.halfTravelDeg).toBeCloseTo(22.5 / 2, 9);
    expect(m.trackingDirection).toBe(-1);
    expect(model({ latitudeDeg: -40 }).model.trackingDirection).toBe(1);
  });

  it('forms a right-handed frame with z towards the pole', () => {
    // x = y × z: (0,1,0) × (0,0,1) = (1,0,0), which is west when z is north.
    // The east piece is therefore on −x in the north and +x in the south.
    const north = model({}, DEFAULT_OPTIONS).model;
    const east = north.segments.find((s) => s.id === 'piece-east')!;
    expect(east.profile[1].a).toBeLessThan(0);
    const south = model({ latitudeDeg: -50.7279 }, DEFAULT_OPTIONS).model;
    expect(south.segments.find((s) => s.id === 'piece-east')!.profile[1].a).toBeGreaterThan(0);
  });

  it('mirrors a southern latitude', () => {
    const north = model().model;
    const south = model({ latitudeDeg: -50.7279 }).model;
    expect(south.axisDir).toEqual(north.axisDir);
    expect(south.latitudeDeg).toBeCloseTo(50.7279, 9);
    const texts = south.labels.map((l) => l.text);
    expect(texts).toContain('S');
    expect(texts).toContain('N pivot');
    expect(south.labels.find((l) => l.pole)?.text).toBe('S');
  });

  it('skips a segment that cannot be drawn instead of producing a bad shape', () => {
    // A very thick platform makes L larger than the radius.
    const { model: m } = model({ platformThicknessMm: 500 });
    expect(m.skipped.length).toBe(1);
    expect(m.segments).toEqual([]);
  });

  it('skips the segment at a very high latitude, where M is negative', () => {
    const { model: m } = model({ latitudeDeg: 85 }, DEFAULT_OPTIONS);
    expect(m.skipped.length).toBe(1);
    expect(m.segments).toEqual([]);
  });

  it('includes a north marker and a pivot label', () => {
    const { model: m } = model();
    const texts = m.labels.map((l) => l.text);
    expect(texts).toContain('N');
    expect(texts).toContain('S pivot');
  });

  it('shows every lettered result measurement with its value', () => {
    const { model: m } = model();
    const texts = m.dimensions.map((d) => d.text);
    for (const t of [
      'E 330 mm',
      'F 75 mm',
      'G 454.2 mm',
      'H 597.7 mm',
      'I 462.7 mm',
      'L 118.5 mm',
      'M 344.3 mm',
      'N 39.2°',
      'O 61.7°',
      'P 504.9 mm',
      'S 61.3 mm',
      'T 536.4 mm',
    ]) {
      expect(texts).toContain(t);
    }
    const byLetter = (l: string) => m.dimensions.find((d) => d.letter === l)!;
    // Each straight measurement's line is as long as its value.
    const len = (l: string) => {
      const [p, q] = byLetter(l).points;
      return dist(p, q);
    };
    expect(len('H')).toBeCloseTo(597.746, 3);
    expect(len('S')).toBeCloseTo(61.326, 3);
    expect(len('T')).toBeCloseTo(536.42, 3);
    expect(len('I')).toBeCloseTo(462.744, 3);
    expect(len('M')).toBeCloseTo(344.262, 3);
    expect(len('L')).toBeCloseTo(118.483, 3);
    expect(len('G')).toBeCloseTo(454.238, 3);
    // M ends on the platform plane, L on the ground.
    expect(byLetter('M').points[1].y).toBeCloseTo(75, 6);
    expect(byLetter('L').points[1].y).toBeCloseTo(0, 6);
  });

  it('leaves out the segment measurements when the segment cannot be built', () => {
    const { model: m } = model({ platformThicknessMm: 500 });
    const letters = m.dimensions.map((d) => d.letter);
    expect(letters).toContain('H');
    expect(letters).not.toContain('I');
  });
});

describe('board shape', () => {
  it('has a straight pole edge as wide as P, an arc round the mount and a nose round the pivot', () => {
    const { model: m } = model();
    const b = m.board;
    expect(b.poleEdgeWidthMm).toBeCloseTo(504.925, 3);
    expect(b.widthMm).toBeCloseTo(504.925, 3);
    // Arc diameter: E + I/4, centred under the mount.
    expect(b.mountArc.radiusMm).toBeCloseTo((330 + 462.744 / 4) / 2, 3);
    expect(b.mountArc.z).toBeCloseTo(597.746 - 165, 3);
    expect(b.pivotArc.z).toBeCloseTo(m.pivot.z, 9);
    expect(b.lengthMm).toBeCloseTo(b.poleEdgeZ - b.equatorEdgeZ, 9);
    // The pole edge is past the bearing contact and the pivot nose before the pivot.
    expect(b.poleEdgeZ).toBeGreaterThan(597.746);
    expect(b.equatorEdgeZ).toBeLessThanOrEqual(m.pivot.z - 60);
    // Symmetric about the centre line and convex.
    const xs = b.outline.map((p) => p.x);
    expect(Math.max(...xs)).toBeCloseTo(-Math.min(...xs), 6);
    const n = b.outline.length;
    for (let i = 0; i < n; i++) {
      const [o, p, q] = [b.outline[i], b.outline[(i + 1) % n], b.outline[(i + 2) % n]];
      expect((p.x - o.x) * (q.z - o.z) - (p.z - o.z) * (q.x - o.x)).toBeGreaterThan(0);
    }
  });

  it('covers the rollers, the pivot and the mount base', () => {
    const { model: m } = model();
    const inside = (x: number, z: number) => {
      const o = m.board.outline;
      for (let i = 0; i < o.length; i++) {
        const p = o[i];
        const q = o[(i + 1) % o.length];
        if ((q.x - p.x) * (z - p.z) - (q.z - p.z) * (x - p.x) < 0) return false;
      }
      return true;
    };
    for (const r of m.rollers) expect(inside(r.x, r.z)).toBe(true);
    expect(inside(0, m.pivot.z)).toBe(true);
    const mountZ = 597.746 - 165;
    for (const [x, z] of [
      [165, mountZ],
      [-165, mountZ],
      [0, mountZ + 165],
      [0, mountZ - 165],
    ]) {
      expect(inside(x, z)).toBe(true);
    }
  });

  it('puts each roller axle one radius outside the arc, from the free and drive diameters', () => {
    const { model: m } = model();
    const seg = m.segments[0];
    const [free, drive] = m.rollerAxles;
    expect(free.kind).toBe('free');
    expect(drive.kind).toBe('drive');
    expect(free.diameterMm).toBe(22);
    expect(drive.diameterMm).toBe(12.5);
    // Northern hemisphere: +x is west, so the free roller is west and the drive east.
    expect(free.side).toBe('west');
    expect(drive.side).toBe('east');
    for (const r of m.rollerAxles) {
      // I + r from the circle centre, through the contact point.
      expect(dist(r.axle, seg.centre)).toBeCloseTo(462.744 + r.diameterMm / 2, 3);
      expect(dist(r.axle, r.contact)).toBeCloseTo(r.diameterMm / 2, 9);
      // Square to the polar axis: the axle runs along it.
      expect(dot(r.normal, m.axisDir)).toBeCloseTo(0, 9);
      expect(r.axle.y).toBeLessThan(r.contact.y);
      expect(r.clearanceMm).toBeCloseTo(r.axle.y - (r.diameterMm / 2) * m.planeUp.y, 9);
      expect(r.clearanceMm).toBeGreaterThan(0);
    }
    // Free roller (11 mm): 17 − 11·cos(N/2)·cos α ≈ 10.5 mm.
    expect(free.axle.y).toBeCloseTo(10.5, 1);
    expect(drive.axle.y).toBeCloseTo(13.3, 1);
  });

  it('swaps the roller sides in the southern hemisphere', () => {
    const { model: m } = model({ latitudeDeg: -50.7279 });
    expect(m.rollerAxles.map((r) => `${r.kind}-${r.side}`)).toEqual(['free-east', 'drive-west']);
  });

  it('reports a negative clearance when a big roller would dig into the ground board', () => {
    const inputs = { ...DEFAULT_INPUTS };
    const m = buildViewerModel(
      inputs,
      calculatePlatform(inputs, { ...WHOLE, freeRollerDiameterMm: 80 }),
    );
    expect(m.rollerAxles[0].clearanceMm).toBeLessThan(0);
  });

  it('puts the rollers on the arc at ±N/2, under the mount base edges', () => {
    const { model: m } = model();
    const seg = m.segments[0];
    const half = (39.249 / 2 / 180) * Math.PI;
    for (const r of m.rollers) {
      expect(dist(r, seg.centre)).toBeCloseTo(462.744, 3);
      expect(Math.abs(r.x)).toBeCloseTo(462.744 * Math.sin(half), 2);
      // Contact height above the ground board: I cos α (1 − cos(N/2)).
      const cosA = Math.cos((50.7279 * Math.PI) / 180);
      expect(r.y).toBeCloseTo(462.744 * cosA * (1 - Math.cos(half)), 2);
    }
  });
});

describe('pieceProfile', () => {
  it('returns null for degenerate pieces', () => {
    expect(pieceProfile(100, 0, 10, 30, 1)).toBeNull();
    expect(pieceProfile(100, 50, 30, 10, 1)).toBeNull();
    expect(pieceProfile(100, 95, 10, 30, 1)).toBeNull();
    expect(pieceProfile(0, 50, 10, 30, 1)).toBeNull();
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
