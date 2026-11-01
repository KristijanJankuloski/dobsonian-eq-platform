import {
  DirectDriveInputs,
  DirectDriveResult,
  PlatformChecks,
  PlatformGeometry,
  PlatformInputs,
  PlatformOptions,
  PlatformResult,
  PlatformWarning,
  WormDriveInputs,
  WormDriveResult,
} from './models';
import { sagitta, toDeg, toRad } from '../util/math';

export const DEFAULT_INPUTS: PlatformInputs = {
  latitudeDeg: 50.7279,
  scopeMassKg: 11.6,
  scopeCogHeightMm: 640,
  mountMassKg: 9.4,
  mountCogHeightMm: 225,
  mountBaseWidthMm: 330,
  platformThicknessMm: 75,
};

export const DEFAULT_OPTIONS: PlatformOptions = {
  extraTravelDeg: 22.5,
  chordMarginMm: 30,
  unusedMiddlePercent: 25,
  topBoardThicknessMm: 18,
};

export const MAX_UNUSED_MIDDLE_PERCENT = 80;
/** Largest extra tracking travel accepted, degrees (4 h of sidereal motion). */
export const MAX_EXTRA_TRAVEL_DEG = 60;

export const MIN_LATITUDE_DEG = 1;
export const MAX_LATITUDE_DEG = 89;
/** Latitude below which a warning is shown (SPEC §4.4). */
export const LOW_LATITUDE_WARNING_DEG = 10;
/** Sidereal rotation rate, degrees per hour. */
export const SIDEREAL_DEG_PER_HOUR = 15.04;
/** Length of a sidereal day in minutes. */
export const SIDEREAL_DAY_MIN = 1436.07;
export const SOLAR_DAY_MIN = 1440;

/** Returns a list of problems with the inputs. Empty when valid. */
export function validateInputs(inputs: PlatformInputs): string[] {
  const errors: string[] = [];
  const lat = Math.abs(inputs.latitudeDeg);
  for (const [key, value] of Object.entries(inputs)) {
    if (!Number.isFinite(value)) errors.push(`${key} must be a finite number`);
  }
  if (errors.length) return errors;
  if (lat < MIN_LATITUDE_DEG || lat > MAX_LATITUDE_DEG) {
    errors.push(`latitudeDeg must be between ${MIN_LATITUDE_DEG} and ${MAX_LATITUDE_DEG}`);
  }
  if (inputs.scopeMassKg < 0 || inputs.mountMassKg < 0) errors.push('masses must not be negative');
  if (inputs.scopeMassKg + inputs.mountMassKg <= 0) {
    errors.push('scopeMassKg + mountMassKg must be greater than 0');
  }
  if (inputs.mountBaseWidthMm <= 0) errors.push('mountBaseWidthMm must be greater than 0');
  if (inputs.platformThicknessMm <= 0) errors.push('platformThicknessMm must be greater than 0');
  if (inputs.scopeCogHeightMm < 0 || inputs.mountCogHeightMm < 0) {
    errors.push('centre of gravity heights must not be negative');
  }
  return errors;
}

/** Returns a list of problems with the options. Empty when valid. */
export function validateOptions(options: PlatformOptions, inputs?: PlatformInputs): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(options)) {
    if (!Number.isFinite(value)) errors.push(`${key} must be a finite number`);
  }
  if (errors.length) return errors;
  if (options.extraTravelDeg < 0 || options.extraTravelDeg > MAX_EXTRA_TRAVEL_DEG) {
    errors.push(`extraTravelDeg must be between 0 and ${MAX_EXTRA_TRAVEL_DEG}`);
  }
  if (options.chordMarginMm < 0) errors.push('chordMarginMm must not be negative');
  if (options.unusedMiddlePercent < 0 || options.unusedMiddlePercent > MAX_UNUSED_MIDDLE_PERCENT) {
    errors.push(`unusedMiddlePercent must be between 0 and ${MAX_UNUSED_MIDDLE_PERCENT}`);
  }
  if (options.topBoardThicknessMm < 0) errors.push('topBoardThicknessMm must not be negative');
  if (inputs && options.topBoardThicknessMm >= inputs.platformThicknessMm) {
    errors.push('topBoardThicknessMm must be less than platformThicknessMm');
  }
  return errors;
}

/** Names of the bearing ends for the hemisphere of a signed latitude (SPEC §8). */
export interface HemisphereNames {
  /** The end that points at the visible celestial pole: 'North' or 'South'. */
  pole: 'North' | 'South';
  /** The other end, where the pivot is. */
  equator: 'North' | 'South';
  poleLetter: 'N' | 'S';
  equatorLetter: 'N' | 'S';
}

export function hemisphereNames(latitudeDeg: number): HemisphereNames {
  return latitudeDeg < 0
    ? { pole: 'South', equator: 'North', poleLetter: 'S', equatorLetter: 'N' }
    : { pole: 'North', equator: 'South', poleLetter: 'N', equatorLetter: 'S' };
}

/** Core platform geometry (SPEC §4.2). Throws RangeError on invalid inputs. */
export function calculateGeometry(
  inputs: PlatformInputs,
  options: PlatformOptions = DEFAULT_OPTIONS,
): PlatformGeometry {
  const errors = [...validateInputs(inputs), ...validateOptions(options, inputs)];
  if (errors.length) throw new RangeError(errors.join('; '));

  const alpha = toRad(Math.abs(inputs.latitudeDeg));
  const { scopeMassKg: A, scopeCogHeightMm: B, mountMassKg: C, mountCogHeightMm: D } = inputs;
  const E = inputs.mountBaseWidthMm;
  const F = inputs.platformThicknessMm;

  const G = (A * B + C * D) / (A + C);
  const H = (G + F) / Math.tan(alpha) + E / 2;
  const I = H * Math.sin(alpha);
  const L = F / Math.cos(alpha);
  const M = I - L;
  const N = toDeg(2 * Math.atan(E / 2 / I));
  const O = N + options.extraTravelDeg;
  const halfO = toRad(O / 2);
  const P = 2 * I * Math.sin(halfO) + options.chordMarginMm;
  // Two mirrored end pieces; the unused middle part of the arc is left out.
  // A roller sits under each end of the mount base, at N/2 from the centre
  // line, and rolls over the travel either side of it. So each piece must
  // reach from N/2 − travel/2 to O/2 = N/2 + travel/2, and the gap cannot
  // start further out than N/2 − travel/2.
  const requestedInnerDeg = (O / 2) * (options.unusedMiddlePercent / 100);
  const maxInnerDeg = Math.max(0, (N - options.extraTravelDeg) / 2);
  const pieceInnerAngleDeg = Math.min(requestedInnerDeg, maxInnerDeg);
  const innerRad = toRad(pieceInnerAngleDeg);
  const whole = pieceInnerAngleDeg === 0;
  // The flat edge sits against the underside of the top board, which crosses
  // the segment plane t / cos α further from the axis than the platform top.
  const flatEdge = M + options.topBoardThicknessMm / Math.cos(alpha);
  const pieceWidthMm = whole ? 2 * I * Math.sin(halfO) : I * (Math.sin(halfO) - Math.sin(innerRad));
  const pieceHeightMm = I * Math.cos(innerRad) - flatEdge;
  // South pivot: where the polar axis crosses the platform plane (height F).
  const pivot = F / Math.tan(alpha);

  return {
    cogHeightMm: G,
    northDistanceMm: H,
    northRadiusMm: I,
    segmentHeightMm: L,
    polarAxisToPlatformMm: M,
    baseAngleDeg: N,
    segmentAngleDeg: O,
    northChordMm: P,
    trackingTravelDeg: options.extraTravelDeg,
    unusedMiddlePercent: (pieceInnerAngleDeg / (O / 2)) * 100,
    pieceInnerAngleDeg,
    pieceOuterAngleDeg: O / 2,
    segmentFlatEdgeMm: flatEdge,
    pieceWidthMm,
    pieceHeightMm,
    southPivotDistanceMm: pivot,
    pivotToNorthBearingMm: H - pivot,
  };
}

/** Sanity checks and warnings (SPEC §4.4). */
export function calculateChecks(
  inputs: PlatformInputs,
  geometry: PlatformGeometry,
): PlatformChecks {
  const g = geometry;
  const minTopBoardWidthMm = Math.max(
    inputs.mountBaseWidthMm + g.northRadiusMm / 4,
    g.northChordMm,
  );
  const outerRad = toRad(g.pieceOuterAngleDeg);
  const segmentFits =
    g.polarAxisToPlatformMm > 0 &&
    outerRad < Math.PI / 2 &&
    g.northRadiusMm * Math.cos(outerRad) > g.segmentFlatEdgeMm;
  const warnings: PlatformWarning[] = [];
  if (Math.abs(inputs.latitudeDeg) < LOW_LATITUDE_WARNING_DEG) {
    warnings.push({
      code: 'lowLatitude',
      message: 'Latitude is very low: the distances and radii become very large.',
    });
  }
  if (!segmentFits) {
    warnings.push({
      code: 'segmentDoesNotFit',
      message:
        'The segment cannot be built with these inputs: the polar axis is too close to the ' +
        'platform (a high latitude or a thick platform), or the segment angle is too large. ' +
        'Try a thinner platform, a thinner top board or less extra tracking travel.',
    });
  }
  return {
    northSagittaMm: sagitta(g.northRadiusMm, g.northChordMm),
    minTopBoardWidthMm,
    trackingHours: g.trackingTravelDeg / SIDEREAL_DEG_PER_HOUR,
    segmentFits,
    warnings,
  };
}

/** Geometry plus sanity checks. */
export function calculatePlatform(
  inputs: PlatformInputs,
  options: PlatformOptions = DEFAULT_OPTIONS,
): PlatformResult {
  const geometry = calculateGeometry(inputs, options);
  return { options: { ...options }, geometry, checks: calculateChecks(inputs, geometry) };
}

/** Worm drive (SPEC §6.1). */
export function calculateWormDrive(inputs: WormDriveInputs): WormDriveResult {
  const { northRadiusMm, spindleDiameterMm, motorRpm, siderealCorrection } = inputs;
  if (!(northRadiusMm > 0) || !(spindleDiameterMm > 0) || !(motorRpm > 0)) {
    throw new RangeError('northRadiusMm, spindleDiameterMm and motorRpm must be greater than 0');
  }
  const dayMin = siderealCorrection ? SIDEREAL_DAY_MIN : SOLAR_DAY_MIN;
  // Arc length of the north bearing per minute over its spindle circumference.
  const requiredSpindleRpm = (2 * Math.PI * northRadiusMm) / dayMin / (Math.PI * spindleDiameterMm);
  const idealRatio = motorRpm / requiredSpindleRpm;
  return { requiredSpindleRpm, idealRatio, teeth: Math.round(idealRatio) };
}

/** Direct-drive synchronous motor north radius (SPEC §6.2). */
export function calculateDirectDrive(inputs: DirectDriveInputs): DirectDriveResult {
  const { motorRph, shaftDiameterMm, northRadiusMm, siderealCorrection = true } = inputs;
  if (!(motorRph > 0) || !(shaftDiameterMm > 0)) {
    throw new RangeError('motorRph and shaftDiameterMm must be greater than 0');
  }
  // The source rounds the sidereal day to 1436 min.
  const dayMin = siderealCorrection ? 1436 : SOLAR_DAY_MIN;
  const requiredNorthRadiusMm = ((dayMin / (60 / motorRph)) * shaftDiameterMm) / 2;
  return { requiredNorthRadiusMm, differenceMm: requiredNorthRadiusMm - northRadiusMm };
}
