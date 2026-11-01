import { sagitta, toDeg, toRad } from './math';

describe('math util', () => {
  it('converts between degrees and radians', () => {
    expect(toRad(180)).toBeCloseTo(Math.PI, 12);
    expect(toDeg(Math.PI / 2)).toBeCloseTo(90, 12);
  });

  it('computes sagitta for a known case', () => {
    expect(sagitta(5, 6)).toBeCloseTo(1, 12);
  });

  it('clamps sagitta to the radius when the chord exceeds the diameter', () => {
    expect(sagitta(5, 20)).toBe(5);
  });
});
