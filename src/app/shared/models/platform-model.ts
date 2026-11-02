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

/** A point in plan (seen from above): x across the platform, z towards the pole. */
export interface PlanPoint {
  x: number;
  z: number;
}

/**
 * Outline of the top board, seen from above. The ground board is cut to the
 * same outline. It is the convex hull of three parts (SPEC §4.5):
 *   - a straight pole edge as wide as the chord P, past the segment;
 *   - an arc round the mount, its diameter the recommended minimum width
 *     E + I/4 (room for the round base and its travel), centred under the mount;
 *   - a rounded nose round the pivot.
 * Everything is in plan coordinates, mm.
 */
export interface BoardShape {
  /** Closed outline, counter-clockwise, no repeated last point. */
  outline: PlanPoint[];
  /** z of the straight pole-side edge. */
  poleEdgeZ: number;
  /** z of the far (pivot) end. */
  equatorEdgeZ: number;
  /** Overall width across x, mm. */
  widthMm: number;
  /** Overall length along z, mm. */
  lengthMm: number;
  /** Length of the straight pole edge, mm. */
  poleEdgeWidthMm: number;
  /** Arc round the mount: centre on the centre line at z, radius. */
  mountArc: { z: number; radiusMm: number };
  /** Rounded nose round the pivot: centre on the centre line at z, radius. */
  pivotArc: { z: number; radiusMm: number };
}

export interface LabelModel {
  /** Short text drawn on a sprite. */
  text: string;
  position: Vec3;
  /** Marks the pole-direction label, which also gets a compass cone. */
  pole?: boolean;
}

/**
 * A lettered result measurement shown in the 3D view (SPEC §7): a polyline
 * over the length or angle it measures, and a label such as "H 597.7 mm".
 */
export interface DimensionModel {
  letter: string;
  text: string;
  points: Vec3[];
  labelAt: Vec3;
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
  /** Bounding boxes of the ground and top boards; both are cut to `board.outline`. */
  groundBoard: Box;
  topBoard: Box;
  board: BoardShape;
  /** Thickness of the top board as built (at least 1 mm so it stays visible). */
  topBoardThicknessMm: number;
  /**
   * Where the arc touches its two rollers, on the ground board, with the
   * platform at the centre of its travel: one each side, at ±N/2 from the
   * centre line, under the edges of the mount base.
   */
  rollers: Vec3[];
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
  /** The lettered measurements (E, F, G, H, I, L, M, N, O, P, S, T). */
  dimensions: DimensionModel[];
  camera: { target: Vec3; distanceMm: number };
  /** Size of a label sprite's height, mm. */
  labelHeightMm: number;
}

/** Axial thickness of the bearing segment boards (plywood), mm. */
export const SEGMENT_WIDTH_MM = 18;
/** Thickness of the ground board, mm. */
export const BOARD_THICKNESS_MM = 18;
const ARC_STEPS = 48;
/** Radius of the rounded nose round the pivot, mm. */
export const PIVOT_NOSE_RADIUS_MM = 60;
/** Board left past the segment at the pole edge, mm. */
const POLE_EDGE_MARGIN_MM = 20;

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

/** Convex hull (monotone chain), counter-clockwise in (x, z), collinear points dropped. */
export function convexHull(points: PlanPoint[]): PlanPoint[] {
  const pts = [...points].sort((p, q) => p.x - q.x || p.z - q.z);
  if (pts.length < 3) return pts;
  const cross = (o: PlanPoint, p: PlanPoint, q: PlanPoint): number =>
    (p.x - o.x) * (q.z - o.z) - (p.z - o.z) * (q.x - o.x);
  const half = (list: PlanPoint[]): PlanPoint[] => {
    const out: PlanPoint[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 1e-9) {
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

function circlePoints(cx: number, cz: number, r: number): PlanPoint[] {
  const out: PlanPoint[] = [];
  for (let i = 0; i < 360; i++) {
    const t = (i * Math.PI) / 180;
    out.push({ x: cx + r * Math.cos(t), z: cz + r * Math.sin(t) });
  }
  return out;
}

/**
 * The board outline (see `BoardShape`). `segmentPoleZ` is the furthest z the
 * segment reaches under the board; `extraPoints` must lie inside it too.
 */
export function buildBoardShape(params: {
  chordMm: number;
  mountCentreZ: number;
  mountArcRadiusMm: number;
  pivotZ: number;
  segmentPoleZ: number;
  extraPoints?: PlanPoint[];
}): BoardShape {
  const { chordMm, mountCentreZ, mountArcRadiusMm: rM, pivotZ } = params;
  const rP = PIVOT_NOSE_RADIUS_MM;
  const poleEdgeZ = Math.max(mountCentreZ + rM, params.segmentPoleZ + POLE_EDGE_MARGIN_MM);
  const equatorEdgeZ = Math.min(mountCentreZ - rM, pivotZ - rP);
  const half = chordMm / 2;
  const outline = convexHull([
    ...circlePoints(0, mountCentreZ, rM),
    ...circlePoints(0, pivotZ, rP),
    { x: -half, z: poleEdgeZ },
    { x: half, z: poleEdgeZ },
    ...(params.extraPoints ?? []),
  ]);
  const xs = outline.map((p) => p.x);
  return {
    outline,
    poleEdgeZ,
    equatorEdgeZ,
    widthMm: Math.max(...xs) - Math.min(...xs),
    lengthMm: poleEdgeZ - equatorEdgeZ,
    poleEdgeWidthMm: chordMm,
    mountArc: { z: mountCentreZ, radiusMm: rM },
    pivotArc: { z: pivotZ, radiusMm: rP },
  };
}

const mm = (v: number): string => `${Math.round(v * 10) / 10} mm`;
const deg = (v: number): string => `${Math.round(v * 10) / 10}°`;

/** Points along an arc of radius r about `centre` in the segment plane, from angle p0 to p1 (radians from straight down). */
function planeArc(centre: Vec3, planeUp: Vec3, r: number, p0: number, p1: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= 24; i++) {
    const p = p0 + ((p1 - p0) * i) / 24;
    out.push(
      add(add(centre, { x: r * Math.sin(p), y: 0, z: 0 }), scale(planeUp, -r * Math.cos(p))),
    );
  }
  return out;
}

/** The lettered measurements of SPEC §4.2, placed on the model (see `DimensionModel`). */
function buildDimensions(c: {
  g: PlatformResult['geometry'];
  E: number;
  F: number;
  alpha: number;
  axisDir: Vec3;
  planeUp: Vec3;
  segCentre: Vec3;
  mountZ: number;
  pivot: Vec3;
  cog: Vec3;
  sideX: number;
  labelHeightMm: number;
  hasSegment: boolean;
}): DimensionModel[] {
  const { g, E, F, planeUp, segCentre: centre, sideX } = c;
  const lh = c.labelHeightMm;
  const H = g.northDistanceMm;
  const S = g.southPivotDistanceMm;
  const I = g.northRadiusMm;
  const M = g.polarAxisToPlatformMm;
  const mid = (p: Vec3, q: Vec3): Vec3 => scale(add(p, q), 0.5);
  const dim = (letter: string, value: string, points: Vec3[], labelAt: Vec3): DimensionModel => ({
    letter,
    text: `${letter} ${value}`,
    points,
    labelAt,
  });
  const out: DimensionModel[] = [];

  // Along the ground beside the platform: H from the origin, then S and T.
  const h0 = { x: sideX, y: 0, z: 0 };
  const h1 = { x: sideX, y: 0, z: H };
  const s1 = { x: sideX - lh * 2, y: 0, z: S };
  const s0 = { x: sideX - lh * 2, y: 0, z: 0 };
  const t1 = { x: sideX - lh * 2, y: 0, z: H };
  out.push(
    dim('H', mm(H), [h0, h1], add(mid(h0, h1), { x: 0, y: lh * 0.7, z: 0 })),
    dim('S', mm(S), [s0, s1], add(mid(s0, s1), { x: -lh, y: lh * 0.7, z: 0 })),
    dim('T', mm(g.pivotToNorthBearingMm), [s1, t1], add(mid(s1, t1), { x: 0, y: lh * 0.7, z: 0 })),
  );

  // F: platform height at the pole end; E: across the mount base.
  const f0 = { x: sideX, y: 0, z: H + lh };
  const f1 = { x: sideX, y: F, z: H + lh };
  const e0 = { x: E / 2, y: F, z: c.mountZ - E / 2 - lh };
  const e1 = { x: -E / 2, y: F, z: c.mountZ - E / 2 - lh };
  out.push(
    dim('F', mm(F), [f0, f1], add(mid(f0, f1), { x: -lh, y: 0, z: lh })),
    dim('E', mm(E), [e0, e1], add(mid(e0, e1), { x: 0, y: lh * 0.7, z: -lh * 0.5 })),
  );

  // G: combined centre of gravity above the platform top (the mount's base).
  const g0 = { x: c.cog.x, y: F, z: c.cog.z };
  out.push(dim('G', mm(g.cogHeightMm), [g0, c.cog], add(mid(g0, c.cog), { x: lh, y: 0, z: 0 })));

  if (!c.hasSegment) return out;

  // In the segment plane: M down the centre line to the platform plane, then
  // L to the ground; I out to the end of the arc; N and O as angles; P as the chord.
  const atB = (b: number): Vec3 => add(centre, scale(planeUp, -b));
  const halfO = toRad(g.segmentAngleDeg / 2);
  const halfN = toRad(g.baseAngleDeg / 2);
  const end = (side: number, p: number): Vec3 =>
    add(add(centre, { x: side * I * Math.sin(p), y: 0, z: 0 }), scale(planeUp, -I * Math.cos(p)));
  const pM = atB(M);
  const pI = atB(I);
  const oL = end(1, halfO);
  const oR = end(-1, halfO);
  const nL = end(1, halfN);
  const nR = end(-1, halfN);
  out.push(
    dim('M', mm(M), [centre, pM], add(mid(centre, pM), { x: -lh * 1.5, y: 0, z: 0 })),
    dim('L', mm(g.segmentHeightMm), [pM, pI], add(mid(pM, pI), { x: -lh * 1.5, y: 0, z: 0 })),
    dim('I', mm(I), [centre, oL], add(mid(centre, oL), { x: lh * 1.5, y: 0, z: 0 })),
    dim(
      'N',
      deg(g.baseAngleDeg),
      [nL, centre, nR, ...planeArc(centre, planeUp, I * 0.35, halfN, -halfN)],
      planeArc(centre, planeUp, I * 0.35 + lh, halfN * 0.6, 0)[0],
    ),
    dim(
      'O',
      deg(g.segmentAngleDeg),
      [oR, centre, ...planeArc(centre, planeUp, I * 0.55, halfO, -halfO)],
      planeArc(centre, planeUp, I * 0.55 + lh, -halfO * 0.6, 0)[0],
    ),
    dim('P', mm(g.northChordMm), [oL, oR], add(oR, { x: -lh * 2, y: 0, z: 0 })),
  );
  return out;
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

  // Rollers under the arc at ±N/2 from the centre line (a = ±I sin(N/2)).
  const half = toRad(g.baseAngleDeg / 2);
  const segCentre = scale(axisDir, H * cosA);
  const rollers: Vec3[] = [1, -1].map((side) =>
    add(
      add(segCentre, { x: side * radius * Math.sin(half), y: 0, z: 0 }),
      scale(planeUp, -radius * Math.cos(half)),
    ),
  );

  // Furthest the segment reaches towards the pole: its flat edge, plus half its thickness.
  const flatZ = segCentre.z - topDistance * planeUp.z;
  const segmentPoleZ = flatZ + (SEGMENT_WIDTH_MM / 2) * cosA;
  const rollerMargin = 25;
  const board = buildBoardShape({
    // P already covers the arc's flat edge (2 I sin(O/2)) plus the chord margin.
    chordMm: g.northChordMm,
    mountCentreZ: mountZ,
    // Recommended minimum width E + I/4: the round base plus its travel (SPEC §4.4).
    mountArcRadiusMm: (E + radius / 4) / 2,
    pivotZ: pivot.z,
    segmentPoleZ: Math.max(segmentPoleZ, H),
    extraPoints: rollers.flatMap((r) =>
      circlePoints(r.x, r.z, rollerMargin).filter((_, i) => i % 30 === 0),
    ),
  });
  const zCentre = (board.poleEdgeZ + board.equatorEdgeZ) / 2;
  const boardWidth = board.widthMm;
  const boardLength = board.lengthMm;
  // A 0 mm board is still drawn as a thin sheet so the platform stays visible.
  const boardT = Math.max(Math.min(result.options.topBoardThicknessMm, F), 1);

  const groundBoard: Box = {
    centre: { x: 0, y: -BOARD_THICKNESS_MM / 2, z: zCentre },
    size: { x: boardWidth, y: BOARD_THICKNESS_MM, z: boardLength },
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
  const dimensions = buildDimensions({
    g,
    E,
    F,
    alpha,
    axisDir,
    planeUp,
    segCentre,
    mountZ,
    pivot,
    cog,
    sideX: -(boardWidth / 2 + labelHeightMm * 1.5),
    labelHeightMm,
    hasSegment: segments.length > 0,
  });

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
    board,
    topBoardThicknessMm: boardT,
    rollers,
    mountBox,
    tube,
    cog,
    axis: { from: scale(axisDir, -labelHeightMm), to: scale(axisDir, cogS + tubeLength * 0.6) },
    halfTravelDeg: g.trackingTravelDeg / 2,
    trackingDirection: south ? 1 : -1,
    labels,
    dimensions,
    camera: {
      target: { x: 0, y: (F + inputs.scopeCogHeightMm) * 0.45, z: zCentre },
      distanceMm: sceneSize * 1.05,
    },
    labelHeightMm,
  };
}
