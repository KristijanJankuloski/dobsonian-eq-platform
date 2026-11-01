import { PlatformInputs, PlatformResult, hemisphereNames } from '@core/calculator';
import { toRad } from '@core/util/math';

/**
 * Pure geometry of the built platform, shared by the 3D view (SPEC §7) and
 * the plan drawing. No three.js imports, so the maths can be unit tested
 * without WebGL.
 *
 * Axis conventions (millimetres, right-handed like three.js):
 *   y = up, z = towards the visible celestial pole (north in the northern
 *   hemisphere, south in the southern), x = y × z, which is west in the
 *   northern hemisphere and east in the southern.
 *   The ground board's top surface is y = 0. The origin is where the polar
 *   axis crosses the ground plane (y = 0). The polar axis points up and
 *   towards the pole: u = (0, sin α, cos α).
 *   The bearing contact point lies on the ground line at z = H (SPEC §4.2),
 *   directly under the mount's pole-side edge. The platform's top plane is
 *   at y = F, where the mount sits. At the other end the platform turns on a
 *   pivot where the polar axis crosses that plane, at (0, F, F / tan α)
 *   (Reiner Vogel's design).
 *
 * The bearing segment lives in a plane perpendicular to the polar axis,
 * centred on the axis, with its curved edge at radius I and its flat edge
 * against the underside of the top board. In that plane, `a` runs along x
 * and `b` runs along e2 = (0, cos α, −sin α); the circle's lowest point is
 * at (a, b) = (0, −radius), where it touches the ground line. The flat edge
 * is at b = −(M + t / cos α), with t the top-board thickness (SPEC §4.2).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Point2 {
  a: number;
  b: number;
}

export interface SegmentModel {
  /** 'whole' for one whole segment, else one of the two mirrored end pieces. */
  id: 'whole' | 'piece-east' | 'piece-west';
  radiusMm: number;
  /** Centre of the segment's circle, on the polar axis. */
  centre: Vec3;
  /** Closed outline in the (a, b) plane: flat top edge, then the arc. */
  profile: Point2[];
}

export interface Box {
  centre: Vec3;
  size: Vec3;
}

export interface LabelModel {
  /** Short text drawn on a sprite. */
  text: string;
  position: Vec3;
  /** Marks the pole-direction label, which also gets a compass cone. */
  pole?: boolean;
}

export interface ViewerModel {
  latitudeDeg: number;
  /** Unit vector along the polar axis (up and north). */
  axisDir: Vec3;
  /** Unit vector e2 of the segment plane (see above). */
  planeUp: Vec3;
  segments: SegmentModel[];
  /** South pivot: the polar axis where it crosses the platform plane. */
  pivot: Vec3;
  /** Segments that cannot be drawn, with the reason. */
  skipped: { id: 'segment'; reason: string }[];
  /** Axial thickness of a segment board, mm. */
  segmentWidthMm: number;
  groundBoard: Box;
  topBoard: Box;
  mountBox: Box;
  /** Simplified telescope tube, along the polar axis. */
  tube: { centre: Vec3; axisDir: Vec3; radiusMm: number; lengthMm: number };
  /** Combined centre of gravity, on the polar axis. */
  cog: Vec3;
  axis: { from: Vec3; to: Vec3 };
  /** Half of the extra tracking travel: how far the platform turns either side of centre. */
  halfTravelDeg: number;
  /**
   * Sign of the tracking rotation about +axisDir as time goes on: the
   * platform turns against the Earth's rotation, so −1 in the northern
   * hemisphere (axis to the north pole) and +1 in the southern.
   */
  trackingDirection: 1 | -1;
  labels: LabelModel[];
  camera: { target: Vec3; distanceMm: number };
  /** Size of a label sprite's height, mm. */
  labelHeightMm: number;
}

/** Axial thickness of the bearing segment boards (plywood), mm. */
export const SEGMENT_WIDTH_MM = 18;
/** Thickness of the ground board, mm. */
export const BOARD_THICKNESS_MM = 18;
const ARC_STEPS = 48;

const scale = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });

const add = (p: Vec3, q: Vec3): Vec3 => ({ x: p.x + q.x, y: p.y + q.y, z: p.z + q.z });

/**
 * Outline of one bearing segment in the plane perpendicular to the polar axis.
 * `radiusMm` is the curved edge, `topDistanceMm` the distance from the axis to
 * the flat edge, `angleDeg` the arc angle. Returns null when the shape is
 * degenerate (flat edge at or beyond the axis, or the arc ends above it).
 */
export function segmentProfile(
  radiusMm: number,
  topDistanceMm: number,
  angleDeg: number,
): Point2[] | null {
  const half = toRad(angleDeg / 2);
  if (!(radiusMm > 0) || !(topDistanceMm > 0) || !(half > 0) || half >= Math.PI / 2) return null;
  // The arc ends must lie below the flat edge, otherwise the sides have no length.
  if (radiusMm * Math.cos(half) <= topDistanceMm) return null;

  const top = -topDistanceMm;
  const halfWidth = radiusMm * Math.sin(half);
  const points: Point2[] = [
    { a: -halfWidth, b: top },
    { a: halfWidth, b: top },
  ];
  for (let i = 0; i <= ARC_STEPS; i++) {
    const phi = half - (2 * half * i) / ARC_STEPS;
    points.push({ a: radiusMm * Math.sin(phi), b: -radiusMm * Math.cos(phi) });
  }
  return points;
}

/**
 * Outline of one end piece: the part of the segment between `innerDeg` and
 * `outerDeg` from the centre line, on the east (+1) or west (−1) side. Same
 * plane and conventions as `segmentProfile`; null when degenerate.
 */
export function pieceProfile(
  radiusMm: number,
  topDistanceMm: number,
  innerDeg: number,
  outerDeg: number,
  side: 1 | -1,
): Point2[] | null {
  const outer = toRad(outerDeg);
  const inner = toRad(innerDeg);
  if (!(radiusMm > 0) || !(topDistanceMm > 0) || !(outer > inner) || outer >= Math.PI / 2) {
    return null;
  }
  if (radiusMm * Math.cos(outer) <= topDistanceMm) return null;
  const top = -topDistanceMm;
  const points: Point2[] = [
    { a: side * radiusMm * Math.sin(inner), b: top },
    { a: side * radiusMm * Math.sin(outer), b: top },
  ];
  for (let i = 0; i <= ARC_STEPS / 2; i++) {
    const phi = outer - ((outer - inner) * i) / (ARC_STEPS / 2);
    points.push({ a: side * radiusMm * Math.sin(phi), b: -radiusMm * Math.cos(phi) });
  }
  return points;
}

/** Builds the 3D model for valid inputs and their calculation result. */
export function buildViewerModel(inputs: PlatformInputs, result: PlatformResult): ViewerModel {
  const g = result.geometry;
  const alpha = toRad(Math.abs(inputs.latitudeDeg));
  const sinA = Math.sin(alpha);
  const cosA = Math.cos(alpha);
  const E = inputs.mountBaseWidthMm;
  const F = inputs.platformThicknessMm;

  const axisDir: Vec3 = { x: 0, y: sinA, z: cosA };
  const planeUp: Vec3 = { x: 0, y: cosA, z: -sinA };
  const H = g.northDistanceMm;
  const pivot: Vec3 = { x: 0, y: F, z: g.southPivotDistanceMm };
  const mountZ = H - E / 2;
  const boardMargin = 60;
  const zStart = Math.min(pivot.z, H - E) - boardMargin;
  const zEnd = H + boardMargin;
  const zCentre = (zStart + zEnd) / 2;

  const names = hemisphereNames(inputs.latitudeDeg);
  const south = inputs.latitudeDeg < 0;
  const segments: SegmentModel[] = [];
  const skipped: ViewerModel['skipped'] = [];
  const radius = g.northRadiusMm;
  const topDistance = g.segmentFlatEdgeMm;
  const whole = g.pieceInnerAngleDeg === 0;
  // +x is west in the northern hemisphere and east in the southern.
  const eastSide: 1 | -1 = south ? 1 : -1;
  const pieces = whole
    ? [{ id: 'whole' as const, profile: segmentProfile(radius, topDistance, g.segmentAngleDeg) }]
    : [
        {
          id: 'piece-east' as const,
          profile: pieceProfile(
            radius,
            topDistance,
            g.pieceInnerAngleDeg,
            g.pieceOuterAngleDeg,
            eastSide,
          ),
        },
        {
          id: 'piece-west' as const,
          profile: pieceProfile(
            radius,
            topDistance,
            g.pieceInnerAngleDeg,
            g.pieceOuterAngleDeg,
            -eastSide as 1 | -1,
          ),
        },
      ];
  for (const piece of pieces) {
    if (!piece.profile || !result.checks.segmentFits) {
      skipped.push({
        id: 'segment',
        reason: `The ${names.pole.toLowerCase()} segment cannot be drawn: its height is too large for its radius.`,
      });
      segments.length = 0;
      break;
    }
    segments.push({
      id: piece.id,
      radiusMm: radius,
      centre: scale(axisDir, H * cosA),
      profile: piece.profile,
    });
  }

  const boardWidth = Math.max(result.checks.minTopBoardWidthMm, E);
  const boardLength = zEnd - zStart;
  // A 0 mm board is still drawn as a thin sheet so the platform stays visible.
  const boardT = Math.max(Math.min(result.options.topBoardThicknessMm, F), 1);

  const groundBoard: Box = {
    centre: { x: 0, y: -BOARD_THICKNESS_MM / 2, z: zCentre },
    size: { x: boardWidth + 200, y: BOARD_THICKNESS_MM, z: boardLength + 200 },
  };
  const topBoard: Box = {
    centre: { x: 0, y: F - boardT / 2, z: zCentre },
    size: { x: boardWidth, y: boardT, z: boardLength },
  };
  const mountHeight = Math.max(2 * inputs.mountCogHeightMm, 20);
  const mountBox: Box = {
    centre: { x: 0, y: F + mountHeight / 2, z: mountZ },
    size: { x: E, y: mountHeight, z: E },
  };

  const cogS = (g.cogHeightMm + F) / sinA;
  const cog = scale(axisDir, cogS);
  const tubeRadius = E * 0.35;
  const tubeLength = Math.max(1.8 * inputs.scopeCogHeightMm, 4 * tubeRadius);
  const tube = {
    centre: { x: 0, y: F + inputs.scopeCogHeightMm, z: mountZ },
    axisDir,
    radiusMm: tubeRadius,
    lengthMm: tubeLength,
  };

  const sceneSize = Math.max(H + E, 2 * (F + inputs.scopeCogHeightMm), boardWidth);
  const labelHeightMm = sceneSize / 28;
  const labels: LabelModel[] = [
    { text: names.poleLetter, position: { x: 0, y: labelHeightMm, z: H + E * 0.9 }, pole: true },
    {
      text: `α ${Math.abs(inputs.latitudeDeg).toFixed(1)}°`,
      position: add(scale(axisDir, -labelHeightMm * 2), { x: 0, y: -labelHeightMm, z: 0 }),
    },
    {
      text: `${names.equatorLetter} pivot`,
      position: add(pivot, { x: 0, y: labelHeightMm, z: -labelHeightMm }),
    },
    { text: 'C of G', position: add(cog, { x: 0, y: labelHeightMm, z: 0 }) },
  ];
  if (segments.length) {
    labels.push({
      text: `I = ${radius.toFixed(0)} mm`,
      position: { x: boardWidth / 2 + labelHeightMm * 2, y: labelHeightMm, z: H },
    });
  }

  return {
    latitudeDeg: Math.abs(inputs.latitudeDeg),
    axisDir,
    planeUp,
    segments,
    pivot,
    skipped,
    segmentWidthMm: SEGMENT_WIDTH_MM,
    groundBoard,
    topBoard,
    mountBox,
    tube,
    cog,
    axis: { from: scale(axisDir, -labelHeightMm), to: scale(axisDir, cogS + tubeLength * 0.6) },
    halfTravelDeg: g.trackingTravelDeg / 2,
    trackingDirection: south ? 1 : -1,
    labels,
    camera: {
      target: { x: 0, y: (F + inputs.scopeCogHeightMm) * 0.45, z: zCentre },
      distanceMm: sceneSize * 1.05,
    },
    labelHeightMm,
  };
}
