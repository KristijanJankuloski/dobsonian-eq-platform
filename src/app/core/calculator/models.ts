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
  /**
   * Share of the segment arc, in percent, that is left out of the middle
   * because it is not used (Vogel). The rest is two mirrored end pieces.
   * Default 33.3 (one third); 0 keeps one whole segment. Limited to 0–80.
   */
  unusedMiddlePercent: number;
}

/** Core geometry results (SPEC §4.2). Letters match the Sky at Night diagram. */
export interface PlatformGeometry {
  /** G: combined centre of gravity height above ground, mm. */
  cogHeightMm: number;
  /** H: distance from origin to north bearing, mm. */
  northDistanceMm: number;
  /** I: radius of north bearing, mm. */
  northRadiusMm: number;
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
  /** Half the gap angle: where each end piece starts, measured from the centre line, degrees. */
  pieceInnerAngleDeg: number;
  /** Where each end piece ends (O / 2), degrees. */
  pieceOuterAngleDeg: number;
  /** Width of one end piece measured across the platform, including the chord margin, mm. */
  pieceWidthMm: number;
  /** Largest height of an end piece, from the flat edge to the arc, mm. */
  pieceHeightMm: number;
  /** Distance from origin to the south pivot (polar axis meets platform plane), mm. */
  southPivotDistanceMm: number;
  /** Distance from the south pivot to the north bearing along the platform, mm. */
  pivotToNorthBearingMm: number;
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
