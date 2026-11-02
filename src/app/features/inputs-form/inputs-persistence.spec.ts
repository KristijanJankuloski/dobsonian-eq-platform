import { DEFAULT_INPUTS, DEFAULT_OPTIONS } from '@core/calculator';
import { defaultFormValue, fromQueryParams, toQueryParams } from './inputs-persistence';

const parse = (qs: string) => fromQueryParams(new URLSearchParams(qs));

describe('inputs persistence', () => {
  it('round-trips a form state', () => {
    const value = {
      inputs: { ...DEFAULT_INPUTS, latitudeDeg: -35.5, scopeMassKg: 20 },
      options: {
        extraTravelDeg: 30,
        chordMarginMm: 10,
        unusedMiddlePercent: 20,
        topBoardThicknessMm: 12,
        freeRollerDiameterMm: 30,
        driveRollerDiameterMm: 10,
      },
    };
    expect(fromQueryParams(toQueryParams(value))).toEqual(value);
  });

  it('round-trips the defaults', () => {
    expect(fromQueryParams(toQueryParams(defaultFormValue()))).toEqual({
      inputs: DEFAULT_INPUTS,
      options: DEFAULT_OPTIONS,
    });
  });

  it('reads the roller diameters and rejects non-positive ones', () => {
    expect(parse('roller=26&drive=8')?.options).toEqual({
      ...DEFAULT_OPTIONS,
      freeRollerDiameterMm: 26,
      driveRollerDiameterMm: 8,
    });
    const bad = parse('roller=0&drive=-3')!.options;
    expect(bad.freeRollerDiameterMm).toBe(DEFAULT_OPTIONS.freeRollerDiameterMm);
    expect(bad.driveRollerDiameterMm).toBe(DEFAULT_OPTIONS.driveRollerDiameterMm);
  });

  it('returns null when no known key is present', () => {
    expect(parse('')).toBeNull();
    expect(parse('utm_source=x&foo=1')).toBeNull();
  });

  it('uses defaults for missing fields', () => {
    expect(parse('lat=45')?.inputs).toEqual({ ...DEFAULT_INPUTS, latitudeDeg: 45 });
  });

  it('uses defaults for garbage values', () => {
    for (const bad of ['abc', '1e5', '0x10', 'NaN', 'Infinity', '', '1;2', '<script>']) {
      expect(parse(`lat=${encodeURIComponent(bad)}&a=${encodeURIComponent(bad)}`)?.inputs).toEqual(
        DEFAULT_INPUTS,
      );
    }
  });

  it('clamps latitude to 1–89 and keeps its sign', () => {
    expect(parse('lat=90')?.inputs.latitudeDeg).toBe(89);
    expect(parse('lat=0.2')?.inputs.latitudeDeg).toBe(1);
    expect(parse('lat=-95')?.inputs.latitudeDeg).toBe(-89);
    expect(parse('lat=0')?.inputs.latitudeDeg).toBe(1);
  });

  it('clamps negative non-negative fields to zero and rejects non-positive widths', () => {
    const v = parse('b=-5&d=-1&travel=-3&margin=-2&middle=-1&top=-4&e=0&f=-10')!;
    expect(v.inputs.scopeCogHeightMm).toBe(0);
    expect(v.inputs.mountCogHeightMm).toBe(0);
    expect(v.options).toEqual({
      extraTravelDeg: 0,
      chordMarginMm: 0,
      unusedMiddlePercent: 0,
      topBoardThicknessMm: 0,
      freeRollerDiameterMm: DEFAULT_OPTIONS.freeRollerDiameterMm,
      driveRollerDiameterMm: DEFAULT_OPTIONS.driveRollerDiameterMm,
    });
    expect(v.inputs.mountBaseWidthMm).toBe(DEFAULT_INPUTS.mountBaseWidthMm);
    expect(v.inputs.platformThicknessMm).toBe(DEFAULT_INPUTS.platformThicknessMm);
  });

  it('rejects absurdly large values', () => {
    expect(parse('a=99999999999')?.inputs.scopeMassKg).toBe(DEFAULT_INPUTS.scopeMassKg);
  });

  it('restores the masses when their total would be zero', () => {
    const v = parse('a=0&c=0')!;
    expect(v.inputs.scopeMassKg).toBe(DEFAULT_INPUTS.scopeMassKg);
    expect(v.inputs.mountMassKg).toBe(DEFAULT_INPUTS.mountMassKg);
  });

  it('accepts a zero mass when the other is positive', () => {
    const v = parse('a=0')!;
    expect(v.inputs.scopeMassKg).toBe(0);
    expect(v.inputs.mountMassKg).toBe(DEFAULT_INPUTS.mountMassKg);
  });

  it('clamps the travel and the unused middle to the form limits', () => {
    expect(parse('travel=340')?.options.extraTravelDeg).toBe(60);
    expect(parse('middle=95')?.options.unusedMiddlePercent).toBe(80);
  });

  it('keeps the top board thinner than the platform', () => {
    expect(parse('f=40&top=50')?.options.topBoardThicknessMm).toBe(18);
    expect(parse('f=20&top=25')?.options.topBoardThicknessMm).toBe(10);
    // Older saved links without "top" get the default.
    expect(parse('lat=45')?.options.topBoardThicknessMm).toBe(DEFAULT_OPTIONS.topBoardThicknessMm);
  });
});
