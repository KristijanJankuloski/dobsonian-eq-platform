/** Inputs for the circular-segment platform calculation (SPEC §4.1). Metric only. */
export interface PlatformInputs {
  /** α: latitude in degrees. Absolute value is used. Valid range 1–89. */
  latitudeDeg: number;
  /** A: weight of the scope (OTA) in kg. */
  scopeMassKg: number;
  /** B: height of the OTA centre of gravity above ground in mm. */
  scopeCogHeightMm: number;
  /** C: weight of the mount / rocker box in kg. */
  mountMassKg: number;
  /** D: height of the mount centre of gravity above ground in mm. */
  mountCogHeightMm: number;
  /** E: width of the mount base board (ground-board feet) in mm. */
  mountBaseWidthMm: number;
  /** F: platform thickness (gap for the segments) in mm. */
  platformThicknessMm: number;
}

/** Tunable constants taken from the Sky at Night spreadsheet (SPEC §4.2). */
export interface PlatformOptions {
  /** Extra tracking travel added to angle N, in degrees. Default 22.5. */
  extraTravelDeg: number;
  /** Margin added to segment chords, in mm. Default 30. */
  chordMarginMm: number;
}

/** Core geometry results (SPEC §4.2). Letters match the Sky at Night diagram. */
export interface PlatformGeometry {
  /** G: combined centre of gravity height above ground, mm. */
  cogHeightMm: number;
  /** H: distance from origin to north bearing, mm. */
  northDistanceMm: number;
  /** J: distance from origin to south bearing, mm. */
  southDistanceMm: number;
  /** I: radius of north bearing, mm. */
  northRadiusMm: number;
  /** K: radius of south bearing, mm. */
  southRadiusMm: number;
  /** L: radial height (thickness) of the segments, mm. */
  segmentHeightMm: number;
  /** M: polar axis to platform (north bearing plane), mm. */
  polarAxisToPlatformMm: number;
  /** N: angle of north segment below the platform, degrees. */
  baseAngleDeg: number;
  /** O: segment angle including travel extensions, degrees. */
  segmentAngleDeg: number;
  /** P: chord length of north segment, mm. */
  northChordMm: number;
  /** Q: chord length of south segment, mm. */
  southChordMm: number;
}

export type WarningCode = 'lowLatitude';

export interface PlatformWarning {
  code: WarningCode;
  message: string;
}

/** Non-blocking sanity checks (SPEC §4.4). */
export interface PlatformChecks {
  /** Sagitta of the north segment, mm: board depth needed. */
  northSagittaMm: number;
  /** Sagitta of the south segment, mm. */
  southSagittaMm: number;
  /** Recommended minimum top-board width, mm (E + I/4). */
  minTopBoardWidthMm: number;
  /** Total tracking time in hours for the segment angle O. */
  trackingHours: number;
  warnings: PlatformWarning[];
}

export interface PlatformResult {
  geometry: PlatformGeometry;
  checks: PlatformChecks;
}

export interface WormDriveInputs {
  /** North bearing radius I, mm. */
  northRadiusMm: number;
  /** Spindle / gear diameter, mm. Default 12.5. */
  spindleDiameterMm: number;
  /** Motor output speed, rpm. Default 3. */
  motorRpm: number;
  /** Use the sidereal day (default true) instead of 24 h. */
  siderealCorrection: boolean;
}

export interface WormDriveResult {
  requiredSpindleRpm: number;
  idealRatio: number;
  /** Spur gear tooth count with a single-start worm. */
  teeth: number;
}

export interface DirectDriveInputs {
  /** Synchronous motor speed in revolutions per hour. */
  motorRph: number;
  shaftDiameterMm: number;
  /** North radius I from the core geometry, for the comparison. */
  northRadiusMm: number;
}

export interface DirectDriveResult {
  /** Required north radius for direct drive, mm. */
  requiredNorthRadiusMm: number;
  /** requiredNorthRadiusMm − northRadiusMm, mm. */
  differenceMm: number;
}
