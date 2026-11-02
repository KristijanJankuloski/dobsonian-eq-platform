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
   * Default 25; 0 keeps one whole segment. Limited to 0–80, and reduced
   * further when needed so each piece still covers the whole travel.
   */
  unusedMiddlePercent: number;
  /**
   * Thickness of the top board the segment hangs from, mm. Default 18.
   * The segment's flat edge sits against the board's underside, so this is
   * taken off the segment height. Must be less than F.
   */
  topBoardThicknessMm: number;
  /**
   * Diameter of the free-running roller under one end of the segment arc, mm.
   * Default 22 (a 608 skate bearing).
   */
  freeRollerDiameterMm: number;
  /**
   * Diameter of the roller the motor turns under the other end, mm. Default
   * 12.5, the default spindle of the drive section; use the same value there.
   */
  driveRollerDiameterMm: number;
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
  /** Extra tracking travel used (O − N), degrees. */
  trackingTravelDeg: number;
  /**
   * Unused middle actually applied, percent of O. Lower than the option when
   * a larger gap would leave the pieces shorter than the travel.
   */
  unusedMiddlePercent: number;
  /** Half the gap angle: where each end piece starts, measured from the centre line, degrees. */
  pieceInnerAngleDeg: number;
  /** Where each end piece ends (O / 2), degrees. */
  pieceOuterAngleDeg: number;
  /** Distance from the polar axis to the segment's flat edge (underside of the top board), mm. */
  segmentFlatEdgeMm: number;
  /** Length of one piece's flat edge (the whole segment's when nothing is left out), mm. */
  pieceWidthMm: number;
  /** Board depth needed: largest height of a piece from its flat edge to the arc, mm. */
  pieceHeightMm: number;
  /** Distance from origin to the south pivot (polar axis meets platform plane), mm. */
  southPivotDistanceMm: number;
  /** Distance from the south pivot to the north bearing along the platform, mm. */
  pivotToNorthBearingMm: number;
}

export type WarningCode = 'lowLatitude' | 'segmentDoesNotFit';

export interface PlatformWarning {
  code: WarningCode;
  message: string;
}

/** Non-blocking sanity checks (SPEC §4.4). */
export interface PlatformChecks {
  /** Sagitta of the chord P on the circle of radius I, mm (SPEC §4.4.1). */
  northSagittaMm: number;
  /** Recommended minimum top-board width, mm: the larger of E + I/4 and the chord P. */
  minTopBoardWidthMm: number;
  /** Total tracking time in hours for the extra tracking travel (O − N). */
  trackingHours: number;
  /**
   * False when the segment cannot be built: the polar axis is not above the
   * platform's underside, or the arc ends do not reach below the flat edge.
   * The template and plan are not offered then.
   */
  segmentFits: boolean;
  warnings: PlatformWarning[];
}

export interface PlatformResult {
  /** The options the result was calculated with. */
  options: PlatformOptions;
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
  /** Use the sidereal day (1436 min, default) instead of 24 h (1440 min). */
  siderealCorrection?: boolean;
}

export interface DirectDriveResult {
  /** Required north radius for direct drive, mm. */
  requiredNorthRadiusMm: number;
  /** requiredNorthRadiusMm − northRadiusMm, mm. */
  differenceMm: number;
}
