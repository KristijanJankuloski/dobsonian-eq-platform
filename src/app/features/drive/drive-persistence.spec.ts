import { defaultDriveValue, fromDriveQueryParams, toDriveQueryParams } from './drive-persistence';

const parse = (qs: string) => fromDriveQueryParams(new URLSearchParams(qs));

describe('drive persistence', () => {
  it('round-trips the defaults and a full state', () => {
    const d = defaultDriveValue();
    expect(fromDriveQueryParams(toDriveQueryParams(d))).toEqual(d);
    const full = {
      spindleDiameterMm: 10,
      motorRpm: 2,
      siderealCorrection: false,
      motorRph: 4,
      shaftDiameterMm: 12.7,
    };
    expect(fromDriveQueryParams(toDriveQueryParams(full))).toEqual(full);
  });

  it('returns null without any drive key', () => {
    expect(parse('lat=45&a=1')).toBeNull();
  });

  it('writes empty values for unset optional fields so stale keys are replaced', () => {
    const params = toDriveQueryParams(defaultDriveValue());
    expect(params.get('rph')).toBe('');
    expect(params.get('shaft')).toBe('');
  });

  it('falls back to defaults for invalid required values', () => {
    const d = defaultDriveValue();
    for (const bad of ['abc', '-3', '0', '1e3', '0x1', '', '99999999']) {
      const v = parse(`sd=${encodeURIComponent(bad)}&rpm=${encodeURIComponent(bad)}`)!;
      expect(v.spindleDiameterMm).toBe(d.spindleDiameterMm);
      expect(v.motorRpm).toBe(d.motorRpm);
    }
  });

  it('treats invalid optional values as unset', () => {
    const v = parse('rph=-4&shaft=abc')!;
    expect(v.motorRph).toBeNull();
    expect(v.shaftDiameterMm).toBeNull();
  });

  it('only accepts 0 or 1 for the sidereal flag', () => {
    expect(parse('sid=0')!.siderealCorrection).toBe(false);
    expect(parse('sid=1')!.siderealCorrection).toBe(true);
    expect(parse('sid=yes')!.siderealCorrection).toBe(true);
  });
});
