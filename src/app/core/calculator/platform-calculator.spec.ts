import {
  DEFAULT_INPUTS,
  DEFAULT_OPTIONS,
  calculateDirectDrive,
  calculateGeometry,
  calculatePlatform,
  calculateWormDrive,
  hemisphereNames,
  validateInputs,
  validateOptions,
} from './platform-calculator';
import { sagitta } from '../util/math';

describe('calculateGeometry', () => {
  it('reproduces the spreadsheet reference values (SPEC §4.3)', () => {
    const g = calculateGeometry(DEFAULT_INPUTS);
    expect(g.cogHeightMm).toBeCloseTo(454.238, 3);
    expect(g.northDistanceMm).toBeCloseTo(597.746, 3);
    expect(g.northRadiusMm).toBeCloseTo(462.744, 3);
    expect(g.segmentHeightMm).toBeCloseTo(118.483, 3);
    expect(g.polarAxisToPlatformMm).toBeCloseTo(344.262, 3);
    expect(g.baseAngleDeg).toBeCloseTo(39.249, 3);
    expect(g.segmentAngleDeg).toBeCloseTo(61.749, 3);
    expect(g.northChordMm).toBeCloseTo(504.925, 3);
    expect(g.southPivotDistanceMm).toBeCloseTo(61.3, 1);
    expect(g.pivotToNorthBearingMm).toBeCloseTo(536.4, 1);
  });

  it('splits the segment into two end pieces around an unused middle', () => {
    const g = calculateGeometry(DEFAULT_INPUTS); // default: a quarter unused
    expect(g.pieceOuterAngleDeg).toBeCloseTo(g.segmentAngleDeg / 2, 9);
    expect(g.pieceInnerAngleDeg).toBeCloseTo(g.segmentAngleDeg / 8, 9);
    expect(g.unusedMiddlePercent).toBeCloseTo(25, 9);
    const half = (g.segmentAngleDeg / 2) * (Math.PI / 180);
    const inner = (g.pieceInnerAngleDeg * Math.PI) / 180;
    const alpha = (50.7279 * Math.PI) / 180;
    expect(g.segmentFlatEdgeMm).toBeCloseTo(g.polarAxisToPlatformMm + 18 / Math.cos(alpha), 9);
    // The template outline: no chord margin on the flat edge.
    expect(g.pieceWidthMm).toBeCloseTo(g.northRadiusMm * (Math.sin(half) - Math.sin(inner)), 6);
    expect(g.pieceHeightMm).toBeCloseTo(g.northRadiusMm * Math.cos(inner) - g.segmentFlatEdgeMm, 6);
  });

  // A roller under each end of the mount base sits at ±N/2 and rolls over the
  // travel, so each piece must span at least the extra travel.
  it.each([0, 10, 25, 33.3, 50, 80])(
    'keeps each piece at least as long as the travel with %s %% unused',
    (percent) => {
      for (const lat of [10, 30, 50.7279, 70]) {
        for (const travel of [0, 15, 22.5, 45, 60]) {
          const g = calculateGeometry(
            { ...DEFAULT_INPUTS, latitudeDeg: lat },
            { ...DEFAULT_OPTIONS, unusedMiddlePercent: percent, extraTravelDeg: travel },
          );
          // The roller at N/2 stays on the piece over ±travel/2. A whole
          // segment (inner 0) spans −O/2 to O/2, which always covers it.
          if (g.pieceInnerAngleDeg > 0) {
            const span = g.pieceOuterAngleDeg - g.pieceInnerAngleDeg;
            expect(span).toBeGreaterThanOrEqual(travel - 1e-9);
            expect(g.pieceInnerAngleDeg).toBeLessThanOrEqual(
              g.baseAngleDeg / 2 - travel / 2 + 1e-9,
            );
          }
          expect(g.pieceOuterAngleDeg).toBeCloseTo(g.baseAngleDeg / 2 + travel / 2, 9);
        }
      }
    },
  );

  it('reduces a too-large unused middle (the old one-third default)', () => {
    const g = calculateGeometry(DEFAULT_INPUTS, {
      ...DEFAULT_OPTIONS,
      unusedMiddlePercent: 100 / 3,
    });
    // (N − travel) / O = (39.249 − 22.5) / 61.749 = 27.12 %.
    expect(g.unusedMiddlePercent).toBeCloseTo(((39.249 - 22.5) / 61.749) * 100, 2);
    expect(g.pieceOuterAngleDeg - g.pieceInnerAngleDeg).toBeCloseTo(22.5, 9);
  });

  it('keeps one whole segment when the travel is larger than N', () => {
    const g = calculateGeometry(DEFAULT_INPUTS, { ...DEFAULT_OPTIONS, extraTravelDeg: 45 });
    expect(g.pieceInnerAngleDeg).toBe(0);
    expect(g.pieceWidthMm).toBeCloseTo(
      2 * g.northRadiusMm * Math.sin((g.segmentAngleDeg * Math.PI) / 360),
      9,
    );
  });

  it('keeps one whole segment with 0 % unused', () => {
    const whole = calculateGeometry(DEFAULT_INPUTS, { ...DEFAULT_OPTIONS, unusedMiddlePercent: 0 });
    expect(whole.pieceInnerAngleDeg).toBe(0);
  });

  it('uses the absolute value of latitude', () => {
    const south = calculateGeometry({ ...DEFAULT_INPUTS, latitudeDeg: -50.7279 });
    expect(south).toEqual(calculateGeometry(DEFAULT_INPUTS));
  });

  it('honours the extra travel and chord margin options', () => {
    const g = calculateGeometry(DEFAULT_INPUTS, {
      ...DEFAULT_OPTIONS,
      extraTravelDeg: 0,
      chordMarginMm: 0,
      unusedMiddlePercent: 0,
    });
    expect(g.segmentAngleDeg).toBeCloseTo(g.baseAngleDeg, 9);
    expect(g.northChordMm).toBeCloseTo(
      2 * g.northRadiusMm * Math.sin((g.baseAngleDeg * Math.PI) / 360),
      9,
    );
  });

  it('rejects latitude 0.5 as out of range', () => {
    expect(() => calculateGeometry({ ...DEFAULT_INPUTS, latitudeDeg: 0.5 })).toThrow(RangeError);
  });

  it.each([1, 45, 89])('is finite at latitude %s', (lat) => {
    const g = calculateGeometry({ ...DEFAULT_INPUTS, latitudeDeg: lat });
    for (const v of Object.values(g)) expect(Number.isFinite(v)).toBe(true);
  });

  it('guards degenerate inputs', () => {
    expect(() => calculateGeometry({ ...DEFAULT_INPUTS, mountBaseWidthMm: 0 })).toThrow(RangeError);
    expect(() => calculateGeometry({ ...DEFAULT_INPUTS, scopeMassKg: 0, mountMassKg: 0 })).toThrow(
      RangeError,
    );
    expect(() => calculateGeometry({ ...DEFAULT_INPUTS, latitudeDeg: NaN })).toThrow(RangeError);
  });
});

describe('validateInputs', () => {
  it('accepts the defaults', () => {
    expect(validateInputs(DEFAULT_INPUTS)).toEqual([]);
  });
  it('rejects latitude outside 1–89', () => {
    expect(validateInputs({ ...DEFAULT_INPUTS, latitudeDeg: 90 }).length).toBe(1);
  });
});

describe('validateOptions', () => {
  it('accepts the defaults', () => {
    expect(validateOptions(DEFAULT_OPTIONS, DEFAULT_INPUTS)).toEqual([]);
  });

  it.each([
    ['extraTravelDeg', NaN],
    ['extraTravelDeg', -1],
    ['extraTravelDeg', 61],
    ['chordMarginMm', -1],
    ['unusedMiddlePercent', 81],
    ['unusedMiddlePercent', -1],
    ['topBoardThicknessMm', -1],
    ['topBoardThicknessMm', 75],
  ])('rejects %s = %s', (key, value) => {
    const options = { ...DEFAULT_OPTIONS, [key]: value };
    expect(validateOptions(options, DEFAULT_INPUTS).length).toBe(1);
    expect(() => calculateGeometry(DEFAULT_INPUTS, options)).toThrow(RangeError);
  });
});

describe('hemisphereNames', () => {
  it('names the pole-side bearing for each hemisphere', () => {
    expect(hemisphereNames(50).pole).toBe('North');
    expect(hemisphereNames(-35)).toEqual({
      pole: 'South',
      equator: 'North',
      poleLetter: 'S',
      equatorLetter: 'N',
    });
  });
});

describe('calculatePlatform checks', () => {
  it('computes sagitta, board width and tracking time', () => {
    const { geometry, checks } = calculatePlatform(DEFAULT_INPUTS);
    // The chord P (504.9) is wider than E + I/4 (445.7).
    expect(checks.minTopBoardWidthMm).toBeCloseTo(geometry.northChordMm, 9);
    expect(checks.minTopBoardWidthMm).toBeGreaterThan(330 + geometry.northRadiusMm / 4);
    // 22.5° of travel at 15.04°/h is about 1.5 h.
    expect(checks.trackingHours).toBeCloseTo(22.5 / 15.04, 9);
    expect(checks.northSagittaMm).toBeCloseTo(sagitta(462.744, 504.925), 2);
    expect(checks.segmentFits).toBe(true);
    expect(checks.warnings).toEqual([]);
  });

  it('uses E + I/4 when that is wider than the chord', () => {
    const { geometry, checks } = calculatePlatform({ ...DEFAULT_INPUTS, mountBaseWidthMm: 800 });
    expect(checks.minTopBoardWidthMm).toBeCloseTo(800 + geometry.northRadiusMm / 4, 9);
  });

  it.each([85, 89])('flags a segment that cannot be built at latitude %s', (lat) => {
    const { geometry, checks } = calculatePlatform({ ...DEFAULT_INPUTS, latitudeDeg: lat });
    expect(geometry.polarAxisToPlatformMm).toBeLessThan(0);
    expect(checks.segmentFits).toBe(false);
    expect(checks.warnings.map((w) => w.code)).toContain('segmentDoesNotFit');
  });

  it('flags a platform too thick for the radius', () => {
    const { checks } = calculatePlatform({ ...DEFAULT_INPUTS, platformThicknessMm: 500 });
    expect(checks.segmentFits).toBe(false);
  });

  it('returns the options it used', () => {
    expect(calculatePlatform(DEFAULT_INPUTS).options).toEqual(DEFAULT_OPTIONS);
  });

  it('warns at low latitude', () => {
    const { checks } = calculatePlatform({ ...DEFAULT_INPUTS, latitudeDeg: 5 });
    expect(checks.warnings.map((w) => w.code)).toContain('lowLatitude');
  });
});

describe('calculateWormDrive', () => {
  const base = { northRadiusMm: 462.744, spindleDiameterMm: 12.5, motorRpm: 3 };

  it('matches the spreadsheet with a 24 h day', () => {
    const r = calculateWormDrive({ ...base, siderealCorrection: false });
    expect(r.idealRatio).toBeCloseTo(58.348, 3);
    expect(r.teeth).toBe(58);
  });

  it('applies the sidereal correction', () => {
    const solar = calculateWormDrive({ ...base, siderealCorrection: false });
    const sidereal = calculateWormDrive({ ...base, siderealCorrection: true });
    expect(sidereal.idealRatio).toBeCloseTo((solar.idealRatio * 1436.07) / 1440, 9);
  });

  it('rejects non-positive inputs', () => {
    expect(() => calculateWormDrive({ ...base, motorRpm: 0, siderealCorrection: true })).toThrow(
      RangeError,
    );
  });
});

describe('calculateDirectDrive', () => {
  it('matches the Optical Ed example (4 rph, 12.7 mm)', () => {
    const r = calculateDirectDrive({ motorRph: 4, shaftDiameterMm: 12.7, northRadiusMm: 462.744 });
    expect(r.requiredNorthRadiusMm).toBeCloseTo(607.9, 1);
    expect(r.differenceMm).toBeCloseTo(607.9 - 462.744, 1);
  });

  it('uses a 24 h day without the sidereal correction', () => {
    const r = calculateDirectDrive({
      motorRph: 4,
      shaftDiameterMm: 12.7,
      northRadiusMm: 462.744,
      siderealCorrection: false,
    });
    expect(r.requiredNorthRadiusMm).toBeCloseTo(((1440 / 15) * 12.7) / 2, 9);
  });
});
