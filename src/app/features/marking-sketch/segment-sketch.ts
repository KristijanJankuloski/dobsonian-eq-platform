/**
 * Pure geometry for the 2D marking-out sketch of one bearing segment.
 *
 * Units are millimetres. The sketch is drawn in SVG user units that equal
 * mm, with y pointing down. The centre of curvature is at (0, 0) and the arc
 * hangs below it, symmetric about the vertical axis. A point at angle θ from
 * straight down on a circle of radius r is (r·sin θ, r·cos θ).
 */

export interface Point {
  x: number;
  y: number;
}

export interface SegmentSketch {
  /** SVG viewBox in mm, including padding. */
  viewBox: string;
  viewBoxWidthMm: number;
  viewBoxHeightMm: number;
  centre: Point;
  arcStart: Point;
  arcEnd: Point;
  /** SVG path of the segment arc. */
  arcPath: string;
  /** SVG path of the small angle marker around the centre. */
  anglePath: string;
  /** Straight distance between the arc end points, mm. */
  chordMm: number;
  /** Label anchor points. */
  radiusLabel: Point;
  angleLabel: Point;
  chordLabel: Point;
  /** Text size and stroke width in mm, scaled to the drawing. */
  fontSizeMm: number;
  strokeMm: number;
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Round to 0.01 mm so paths are short and stable. */
const r2 = (v: number): number => Math.round(v * 100) / 100;

const pointAt = (radius: number, thetaRad: number): Point => ({
  x: radius * Math.sin(thetaRad),
  y: radius * Math.cos(thetaRad),
});

/** SVG arc from the left end to the right end, passing below the centre. */
function arcBetween(radius: number, halfAngleRad: number): string {
  const start = pointAt(radius, -halfAngleRad);
  const end = pointAt(radius, halfAngleRad);
  const large = halfAngleRad * 2 > Math.PI ? 1 : 0;
  // Sweep 0: left to right along the bottom is counter-clockwise on screen.
  return `M ${r2(start.x)} ${r2(start.y)} A ${r2(radius)} ${r2(radius)} 0 ${large} 0 ${r2(end.x)} ${r2(end.y)}`;
}

/**
 * Builds the sketch geometry for a segment of the given radius and arc angle.
 * Throws RangeError for a non-positive radius or an angle outside (0, 360).
 */
export function buildSegmentSketch(radiusMm: number, angleDeg: number): SegmentSketch {
  if (!Number.isFinite(radiusMm) || radiusMm <= 0) {
    throw new RangeError('radiusMm must be greater than 0');
  }
  if (!Number.isFinite(angleDeg) || angleDeg <= 0 || angleDeg >= 360) {
    throw new RangeError('angleDeg must be between 0 and 360');
  }

  const half = toRad(angleDeg / 2);
  const arcStart = pointAt(radiusMm, -half);
  const arcEnd = pointAt(radiusMm, half);
  const chordMm = 2 * radiusMm * Math.sin(half);

  // Drawing extent: the centre, both arc ends, and the arc bottom (y = R when
  // the arc passes straight below the centre, i.e. when half < 180°).
  const minX = Math.min(arcStart.x, arcEnd.x, 0);
  const maxX = Math.max(arcStart.x, arcEnd.x, 0);
  const minY = 0;
  const maxY = half >= Math.PI / 2 ? radiusMm : Math.max(arcStart.y, arcEnd.y, radiusMm);
  const extent = Math.max(maxX - minX, maxY - minY);

  const fontSizeMm = extent / 18;
  const strokeMm = extent / 400;
  // Room for labels around the drawing.
  const pad = fontSizeMm * 4;
  const x = minX - pad;
  const y = minY - pad;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;

  const angleRadius = radiusMm * 0.22;
  const mid = pointAt(radiusMm / 2, -half);

  return {
    viewBox: `${r2(x)} ${r2(y)} ${r2(w)} ${r2(h)}`,
    viewBoxWidthMm: r2(w),
    viewBoxHeightMm: r2(h),
    centre: { x: 0, y: 0 },
    arcStart: { x: r2(arcStart.x), y: r2(arcStart.y) },
    arcEnd: { x: r2(arcEnd.x), y: r2(arcEnd.y) },
    arcPath: arcBetween(radiusMm, half),
    anglePath: arcBetween(angleRadius, half),
    chordMm,
    radiusLabel: { x: r2(mid.x - fontSizeMm * 0.6), y: r2(mid.y) },
    angleLabel: { x: 0, y: r2(angleRadius + fontSizeMm * 1.6) },
    chordLabel: { x: 0, y: r2(arcStart.y - fontSizeMm * 0.6) },
    fontSizeMm: r2(fontSizeMm),
    strokeMm: Math.round(strokeMm * 1000) / 1000,
  };
}
