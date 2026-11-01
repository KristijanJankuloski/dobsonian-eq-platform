/** Drive section inputs (SPEC §6). The direct-drive pair is optional. */
export interface DriveFormValue {
  /** Worm drive: spindle / gear diameter, mm. */
  spindleDiameterMm: number;
  /** Worm drive: motor output speed, rpm. */
  motorRpm: number;
  /** Worm drive: use the sidereal day instead of 24 h. */
  siderealCorrection: boolean;
  /** Direct drive: synchronous motor speed in revolutions per hour, or null. */
  motorRph: number | null;
  /** Direct drive: shaft diameter, mm, or null. */
  shaftDiameterMm: number | null;
}
