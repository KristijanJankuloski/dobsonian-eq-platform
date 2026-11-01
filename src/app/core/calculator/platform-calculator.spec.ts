import {
  DEFAULT_INPUTS,
  calculateDirectDrive,
  calculateGeometry,
  calculatePlatform,
  calculateWormDrive,
  validateInputs,
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

  it('uses the absolute value of latitude', () => {
    const south = calculateGeometry({ ...DEFAULT_INPUTS, latitudeDeg: -50.7279 });
    expect(south).toEqual(calculateGeometry(DEFAULT_INPUTS));
  });

  it('honours the extra travel and chord margin options', () => {
    const g = calculateGeometry(DEFAULT_INPUTS, { extraTravelDeg: 0, chordMarginMm: 0 });
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

describe('calculatePlatform checks', () => {
  it('computes sagitta, board width and tracking time', () => {
    const { geometry, checks } = calculatePlatform(DEFAULT_INPUTS);
    expect(checks.minTopBoardWidthMm).toBeCloseTo(330 + geometry.northRadiusMm / 4, 9);
    expect(checks.trackingHours).toBeCloseTo(61.749 / 15.04, 3);
    expect(checks.northSagittaMm).toBeCloseTo(sagitta(462.744, 504.925), 2);
    expect(checks.warnings).toEqual([]);
  });

  it('warns at low latitude', () => {
    const { checks } = calculatePlatform({ ...DEFAULT_INPUTS, latitudeDeg: 5 });
    expect(checks.warnings.map((w) => w.code)).toEqual(['lowLatitude']);
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
});
