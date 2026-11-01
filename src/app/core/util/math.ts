/** Pure math helpers. No framework imports. */

export const toRad = (deg: number): number => (deg * Math.PI) / 180;
export const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Sagitta of a chord on a circle: R − sqrt(R² − (c/2)²). Clamped to R. */
export function sagitta(radius: number, chord: number): number {
  const half = chord / 2;
  if (half >= radius) return radius;
  return radius - Math.sqrt(radius * radius - half * half);
}
