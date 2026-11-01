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
};

export const MIN_LATITUDE_DEG = 1;
export const MAX_LATITUDE_DEG = 89;
/** Latitude below which a warning is shown (SPEC §4.4). */
export const LOW_LATITUDE_WARNING_DEG = 10;
/** Sidereal rotation rate, degrees per hour. */
export const SIDEREAL_DEG_PER_HOUR = 15.04;
/** Length of a sidereal day in minutes. */
export const SIDEREAL_DAY_MIN = 1436.07;
export const SOLAR_DAY_MIN = 1440;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

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

/** Sagitta of a chord on a circle: R − sqrt(R² − (c/2)²). */
export function sagitta(radiusMm: number, chordMm: number): number {
  const half = chordMm / 2;
  if (half >= radiusMm) return radiusMm;
  return radiusMm - Math.sqrt(radiusMm * radiusMm - half * half);
}

/** Core platform geometry (SPEC §4.2). Throws RangeError on invalid inputs. */
export function calculateGeometry(
  inputs: PlatformInputs,
  options: PlatformOptions = DEFAULT_OPTIONS,
): PlatformGeometry {
  const errors = validateInputs(inputs);
  if (errors.length) throw new RangeError(errors.join('; '));

  const alpha = toRad(Math.abs(inputs.latitudeDeg));
  const { scopeMassKg: A, scopeCogHeightMm: B, mountMassKg: C, mountCogHeightMm: D } = inputs;
  const E = inputs.mountBaseWidthMm;
  const F = inputs.platformThicknessMm;

  const G = (A * B + C * D) / (A + C);
  const H = (G + F) / Math.tan(alpha) + E / 2;
  const J = H - E;
  const I = H * Math.sin(alpha);
  const K = J * Math.sin(alpha);
  const L = F / Math.cos(alpha);
  const M = I - L;
  const N = toDeg(2 * Math.atan(E / 2 / I));
  const O = N + options.extraTravelDeg;
  const halfO = toRad(O / 2);
  const P = 2 * I * Math.sin(halfO) + options.chordMarginMm;
  const Q = 2 * K * Math.sin(halfO) + options.chordMarginMm;

  return {
    cogHeightMm: G,
    northDistanceMm: H,
    southDistanceMm: J,
    northRadiusMm: I,
    southRadiusMm: K,
    segmentHeightMm: L,
    polarAxisToPlatformMm: M,
    baseAngleDeg: N,
    segmentAngleDeg: O,
    northChordMm: P,
    southChordMm: Q,
  };
}

/** Sanity checks and warnings (SPEC §4.4). */
export function calculateChecks(
  inputs: PlatformInputs,
  geometry: PlatformGeometry,
): PlatformChecks {
  const minTopBoardWidthMm = inputs.mountBaseWidthMm + geometry.northRadiusMm / 4;
  const warnings: PlatformWarning[] = [];
  if (Math.abs(inputs.latitudeDeg) < LOW_LATITUDE_WARNING_DEG) {
    warnings.push({
      code: 'lowLatitude',
      message: 'Latitude is very low: the distances and radii become very large.',
    });
  }
  return {
    northSagittaMm: sagitta(geometry.northRadiusMm, geometry.northChordMm),
    southSagittaMm: sagitta(geometry.southRadiusMm, geometry.southChordMm),
    minTopBoardWidthMm,
    trackingHours: geometry.segmentAngleDeg / SIDEREAL_DEG_PER_HOUR,
    warnings,
  };
}

/** Geometry plus sanity checks. */
export function calculatePlatform(
  inputs: PlatformInputs,
  options: PlatformOptions = DEFAULT_OPTIONS,
): PlatformResult {
  const geometry = calculateGeometry(inputs, options);
  return { geometry, checks: calculateChecks(inputs, geometry) };
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
  const { motorRph, shaftDiameterMm, northRadiusMm } = inputs;
  if (!(motorRph > 0) || !(shaftDiameterMm > 0)) {
    throw new RangeError('motorRph and shaftDiameterMm must be greater than 0');
  }
  const requiredNorthRadiusMm = ((1436 / (60 / motorRph)) * shaftDiameterMm) / 2;
  return { requiredNorthRadiusMm, differenceMm: requiredNorthRadiusMm - northRadiusMm };
}
