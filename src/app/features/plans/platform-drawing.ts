import { PlatformInputs, PlatformResult, hemisphereNames } from '@core/calculator';
import { toRad } from '@core/util/math';
import {
  BOARD_THICKNESS_MM,
  PlanPoint,
  SEGMENT_WIDTH_MM,
  buildViewerModel,
} from '@shared/models/platform-model';

/**
 * Pure builder for the dimensioned workshop drawing of the platform and its
 * base (SPEC §5.4): front view, side view and plan on an A3 landscape sheet,
 * with dimension lines, a table of key measurements and a title block.
 *
 * The SVG's width and height are the sheet's size in mm, and the views are
 * drawn at a standard scale (1:k) picked so they fit; text is sized in sheet
 * millimetres. All measurements are in mm. Lengths along the platform are
 * given from the straight pole edge, widths from the centre line.
 */

export const DRAWING_CLASS = 'dep-drawing';

/** Standard drawing scales tried in turn (1:k); the first that fits is used. */
export const DRAWING_SCALES = [1, 2, 2.5, 4, 5, 10, 20, 25, 50, 100];

const SHEET = { name: 'A3', widthMm: 420, heightMm: 297 };
const FRAME = 10;
const TITLE_BLOCK = { widthMm: 180, heightMm: 40 };
const NOTES_WIDTH = 178;
/** Height of the roller details, sheet mm (they are drawn at 1:1). */
const DETAIL_HEIGHT = 62;
/** Height of the table of measurements, sheet mm (5 + 27 rows at 4.2 + 4 headings). */
const TABLE_HEIGHT = 125;
/** How far the polar axis is drawn above the platform top in the elevations, mm (model). */
const AXIS_ABOVE_MM = 40;

export interface PlatformDrawing {
  svg: string;
  /** k of the 1:k drawing scale. */
  scale: number;
  sheet: string;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** A measurement as printed on the drawing: mm to 0.1, without a trailing ".0". */
export const fmt = (v: number): string => {
  const n = Math.round(v * 10) / 10;
  return String(Object.is(n, -0) ? 0 : n);
};

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const S = DRAWING_CLASS;
const STYLE = `<style>
  .${S} .sheet { fill: #fff; stroke: none; }
  .${S} .frame { fill: none; stroke: #000; stroke-width: 0.5; }
  .${S} .outline { fill: #fff; stroke: #000; stroke-width: 0.45; }
  .${S} .part { fill: #e3ebff; stroke: #000; stroke-width: 0.3; }
  .${S} .hidden { fill: none; stroke: #000; stroke-width: 0.22; stroke-dasharray: 1.6 0.8; }
  .${S} .phantom { fill: none; stroke: #666; stroke-width: 0.22; stroke-dasharray: 6 1 1 1 1 1; }
  .${S} .centre { fill: none; stroke: #666; stroke-width: 0.18; stroke-dasharray: 7 1.2 1.2 1.2; }
  .${S} .dim { fill: none; stroke: #000; stroke-width: 0.15; }
  .${S} .arrow { fill: #000; stroke: none; }
  .${S} .bolt { fill: none; stroke: #c33; stroke-width: 0.7; }
  .${S} .pivot { fill: #c33; stroke: #000; stroke-width: 0.15; }
  .${S} .roller { fill: #fff; stroke: #000; stroke-width: 0.25; }
  .${S} .cell { fill: none; stroke: #000; stroke-width: 0.3; }
  .${S} text { font-family: sans-serif; font-size: 2.8px; fill: #000; }
  .${S} .small { font-size: 2.2px; }
  .${S} .note { font-size: 2.4px; }
  .${S} .label { font-size: 3.2px; font-weight: bold; }
  .${S} .head { font-size: 2.6px; font-weight: bold; }
  .${S} .big { font-size: 5.5px; }
</style>`;

const pathOf = (pts: { x: number; y: number }[], close = true): string =>
  pts.map((p, i) => `${i ? 'L' : 'M'} ${r2(p.x)} ${r2(p.y)}`).join(' ') + (close ? ' Z' : '');

const line = (x1: number, y1: number, x2: number, y2: number, cls = 'dim'): string =>
  `<path class="${cls}" d="M ${r2(x1)} ${r2(y1)} L ${r2(x2)} ${r2(y2)}"/>`;

const rect = (x1: number, y1: number, x2: number, y2: number, cls: string): string =>
  `<rect class="${cls}" x="${r2(Math.min(x1, x2))}" y="${r2(Math.min(y1, y2))}" ` +
  `width="${r2(Math.abs(x2 - x1))}" height="${r2(Math.abs(y2 - y1))}"/>`;

const text = (
  x: number,
  y: number,
  value: string,
  opts: { anchor?: 'start' | 'middle' | 'end'; cls?: string; rotate?: boolean } = {},
): string =>
  `<text${opts.cls ? ` class="${opts.cls}"` : ''} x="${r2(x)}" y="${r2(y)}"` +
  (opts.anchor && opts.anchor !== 'start' ? ` text-anchor="${opts.anchor}"` : '') +
  (opts.rotate ? ` transform="rotate(-90 ${r2(x)} ${r2(y)})"` : '') +
  `>${escapeXml(value)}</text>`;

/** Filled arrowhead with its tip at (x, y), pointing along (dx, dy). */
function arrow(x: number, y: number, dx: number, dy: number): string {
  const n = Math.hypot(dx, dy) || 1;
  const ux = dx / n;
  const uy = dy / n;
  const len = 2.2;
  const w = 0.7;
  const bx = x - ux * len;
  const by = y - uy * len;
  return (
    `<path class="arrow" d="M ${r2(x)} ${r2(y)} L ${r2(bx - uy * w)} ${r2(by + ux * w)} ` +
    `L ${r2(bx + uy * w)} ${r2(by - ux * w)} Z"/>`
  );
}

/** Rough text width in sheet mm at the dimension font size. */
const textWidth = (s: string): number => s.length * 1.55;

/**
 * Horizontal dimension between x1 and x2, measured from features at heights
 * y1 and y2, with the dimension line at yDim.
 */
function dimH(x1: number, x2: number, y1: number, y2: number, yDim: number, label: string): string {
  const out: string[] = [];
  for (const [x, y] of [
    [x1, y1],
    [x2, y2],
  ]) {
    const s = Math.sign(yDim - y) || 1;
    out.push(line(x, y + s * 0.8, x, yDim + s * 1.5));
  }
  const [a, b] = x1 < x2 ? [x1, x2] : [x2, x1];
  out.push(line(a, yDim, b, yDim), arrow(a, yDim, -1, 0), arrow(b, yDim, 1, 0));
  const fits = b - a > textWidth(label) + 5;
  out.push(
    fits
      ? text((a + b) / 2, yDim - 0.8, label, { anchor: 'middle' })
      : text(b + 1.5, yDim + 1, label),
  );
  return out.join('');
}

/** Vertical dimension between y1 and y2 from features at x1 and x2, line at xDim. */
function dimV(y1: number, y2: number, x1: number, x2: number, xDim: number, label: string): string {
  const out: string[] = [];
  for (const [x, y] of [
    [x1, y1],
    [x2, y2],
  ]) {
    const s = Math.sign(xDim - x) || 1;
    out.push(line(x + s * 0.8, y, xDim + s * 1.5, y));
  }
  const [a, b] = y1 < y2 ? [y1, y2] : [y2, y1];
  out.push(line(xDim, a, xDim, b), arrow(xDim, a, 0, -1), arrow(xDim, b, 0, 1));
  const left = xDim < Math.min(x1, x2);
  if (b - a > textWidth(label) + 5) {
    out.push(text(xDim - 0.8, (a + b) / 2, label, { anchor: 'middle', rotate: true }));
  } else {
    out.push(
      text(left ? xDim - 1.5 : xDim + 1.5, (a + b) / 2 + 1, label, {
        anchor: left ? 'end' : 'start',
      }),
    );
  }
  return out.join('');
}

/** Leader from text at (tx, ty) to a point (px, py). */
function leader(px: number, py: number, tx: number, ty: number, label: string): string {
  const right = tx >= px;
  const shelf = textWidth(label) + 1;
  const sx = right ? tx + shelf : tx - shelf;
  return (
    line(sx, ty, tx, ty) +
    line(tx, ty, px, py) +
    arrow(px, py, px - tx, py - ty) +
    text(right ? tx + 0.5 : tx - 0.5, ty - 0.8, label, { anchor: right ? 'start' : 'end' })
  );
}

/** Small centre mark (cross) at a point. */
const centreMark = (x: number, y: number, size = 2.5): string =>
  line(x - size, y, x + size, y, 'centre') + line(x, y - size, x, y + size, 'centre');

/**
 * Builds the dimensioned drawing. `date` (any text, e.g. 2026-11-02) goes in
 * the title block; it is a parameter so the output is reproducible.
 */
export function buildPlatformDrawing(
  inputs: PlatformInputs,
  result: PlatformResult,
  date = '',
): PlatformDrawing {
  const model = buildViewerModel(inputs, result);
  const names = hemisphereNames(inputs.latitudeDeg);
  const g = result.geometry;
  const board = model.board;
  const alpha = toRad(Math.abs(inputs.latitudeDeg));
  const sinA = Math.sin(alpha);
  const cosA = Math.cos(alpha);
  const F = inputs.platformThicknessMm;
  const E = inputs.mountBaseWidthMm;
  const t = model.topBoardThicknessMm;
  const gT = BOARD_THICKNESS_MM;
  const W = board.widthMm;
  const L = board.lengthMm;
  const z0 = board.equatorEdgeZ;
  const z1 = board.poleEdgeZ;
  const fromPole = (z: number): number => z1 - z;
  const I = g.northRadiusMm;
  const whole = g.pieceInnerAngleDeg === 0;
  const xo = I * Math.sin(toRad(g.pieceOuterAngleDeg));
  const xi = whole ? 0 : I * Math.sin(toRad(g.pieceInnerAngleDeg));
  const seg = model.segments[0];
  const segCentre = seg?.centre ?? { x: 0, y: 0, z: 0 };
  const flatZ = segCentre.z - g.segmentFlatEdgeMm * model.planeUp.z;
  const halfThickZ = (SEGMENT_WIDTH_MM / 2) * cosA;
  const roller = model.rollers[0];
  const rollerX = Math.abs(roller.x);
  const pivot = model.pivot;
  const mountZ = board.mountArc.z;
  const elevTopY = F + AXIS_ABOVE_MM;
  const elevH = elevTopY + gT;

  // Pick the largest standard scale at which the layout fits the sheet.
  const titleTop = SHEET.heightMm - FRAME - TITLE_BLOCK.heightMm;
  const fits = (k: number): boolean => {
    const leftCol = Math.max(W / k + 16, NOTES_WIDTH);
    const width = FRAME + 6 + leftCol + 28 + 24 + L / k + 32;
    const height = FRAME + 10 + elevH / k + 30 + 22 + W / k + 24;
    const leftHeight = FRAME + 10 + elevH / k + 32 + TABLE_HEIGHT + 4 + DETAIL_HEIGHT;
    return (
      width <= SHEET.widthMm - FRAME &&
      height <= titleTop - 4 &&
      leftHeight <= SHEET.heightMm - FRAME
    );
  };
  const k = DRAWING_SCALES.find(fits) ?? DRAWING_SCALES[DRAWING_SCALES.length - 1];

  const leftX = FRAME + 6;
  const leftCol = Math.max(W / k + 16, NOTES_WIDTH);
  const elevTop = FRAME + 10;
  const elevY = (y: number): number => elevTop + (elevTopY - y) / k;
  const sideX0 = leftX + leftCol + 28 + 24;
  const zX = (z: number): number => sideX0 + (z - z0) / k;
  const frontCx = leftX + leftCol / 2;
  const frontX = (x: number): number => frontCx - x / k;
  const elevBottom = elevY(-gT);
  const planTop = elevBottom + 30 + 22;
  const planCy = planTop + W / 2 / k;
  // Plan with the pole to the right: +x (west in the north, east in the south) is up.
  const planY = (x: number): number => planCy - x / k;
  const planPt = (p: PlanPoint) => ({ x: zX(p.z), y: planY(p.x) });

  const parts: string[] = [];
  const views: string[] = [];

  // ---------- Front view: from the pivot end, looking towards the pole. ----------
  {
    const xL = frontX(W / 2);
    const xR = frontX(-W / 2);
    views.push(
      rect(xL, elevY(0), xR, elevY(-gT), 'outline'),
      rect(xL, elevY(F), xR, elevY(F - t), 'outline'),
    );
    for (const s of model.segments) {
      const pts = s.profile.map((p) => ({
        x: frontX(p.a),
        y: elevY(s.centre.y + p.b * model.planeUp.y),
      }));
      views.push(`<path class="part" d="${pathOf(pts)}"/>`);
    }
    for (const r of model.rollers) {
      views.push(`<circle class="roller" cx="${r2(frontX(r.x))}" cy="${r2(elevY(r.y))}" r="1"/>`);
    }
    views.push(
      line(frontCx, elevY(elevTopY), frontCx, elevY(-gT) + 3, 'centre'),
      line(frontCx, elevY(0), frontCx, elevY(F), 'bolt'),
      dimH(xL, xR, elevY(-gT), elevY(-gT), elevBottom + 7, fmt(W)),
      dimH(
        frontX(rollerX),
        frontX(-rollerX),
        elevY(roller.y),
        elevY(roller.y),
        elevBottom + 14,
        `rollers ${fmt(2 * rollerX)}`,
      ),
      dimV(elevY(F), elevY(F - t), xR, xR, xR + 6, fmt(t)),
      dimV(elevY(0), elevY(-gT), xR, xR, xR + 6, fmt(gT)),
      text(frontCx, elevBottom + 22, `FRONT VIEW (from the ${names.equator.toLowerCase()} end)`, {
        anchor: 'middle',
        cls: 'label',
      }),
    );
  }

  // ---------- Side view: pole to the right. ----------
  {
    const a = zX(z0);
    const b = zX(z1);
    views.push(
      rect(a, elevY(0), b, elevY(-gT), 'outline'),
      rect(a, elevY(F), b, elevY(F - t), 'outline'),
    );
    if (seg) {
      // The segment is a board in the plane square to the polar axis, so from
      // the side it is a band tilted at 90° − α.
      const bTop = -g.segmentFlatEdgeMm;
      const bBot = whole ? -I : -I * Math.cos(toRad(g.pieceInnerAngleDeg));
      const at = (bb: number, s: number) => ({
        x: zX(segCentre.z + bb * model.planeUp.z + s * model.axisDir.z),
        y: elevY(segCentre.y + bb * model.planeUp.y + s * model.axisDir.y),
      });
      const h = SEGMENT_WIDTH_MM / 2;
      views.push(
        `<path class="part" d="${pathOf([at(bTop, -h), at(bTop, h), at(bBot, h), at(bBot, -h)])}"/>`,
      );
    }
    for (const r of model.rollers.slice(0, 1)) {
      views.push(`<circle class="roller" cx="${r2(zX(r.z))}" cy="${r2(elevY(r.y))}" r="1"/>`);
    }
    // Polar axis through the pivot, and the bolt along it.
    const axisAt = (y: number) => ({ x: zX(pivot.z + (y - F) / Math.tan(alpha)), y: elevY(y) });
    const ax0 = axisAt(-gT - 4);
    const ax1 = axisAt(elevTopY);
    const b0 = axisAt(0);
    const px = zX(pivot.z);
    const py = elevY(F);
    const arcR = 9;
    views.push(
      line(ax0.x, ax0.y, ax1.x, ax1.y, 'centre'),
      line(b0.x, b0.y, px, py, 'bolt'),
      line(px, py, px + arcR + 3, py, 'dim'),
      `<path class="dim" d="M ${r2(px + arcR)} ${r2(py)} A ${arcR} ${arcR} 0 0 0 ` +
        `${r2(px + arcR * cosA)} ${r2(py - arcR * sinA)}"/>`,
      text(px + arcR + 1.5, py - 2.2, `α ${fmt(Math.abs(inputs.latitudeDeg))}°`, { cls: 'small' }),
      text(ax1.x - 1.5, ax1.y + 2.5, 'polar axis', { cls: 'small', anchor: 'end' }),
      dimV(elevY(F), elevY(0), a, a, a - 6, fmt(F)),
      dimV(elevY(F), elevY(-gT), a, a, a - 14, fmt(F + gT)),
      dimH(
        px,
        zX(g.northDistanceMm),
        elevY(0),
        elevY(0),
        elevBottom + 7,
        `T ${fmt(g.pivotToNorthBearingMm)} (pivot to bearing contact)`,
      ),
      text((a + b) / 2, elevBottom + 22, `SIDE VIEW (${names.pole.toLowerCase()} to the right)`, {
        anchor: 'middle',
        cls: 'label',
      }),
    );
  }

  // ---------- Plan: top board, with the segment and rollers below it hidden. ----------
  {
    const a = zX(z0);
    const b = zX(z1);
    const top = planY(W / 2);
    const bottom = planY(-W / 2);
    views.push(
      `<path class="outline" d="${pathOf(board.outline.map(planPt))}"/>`,
      line(a - 4, planCy, b + 4, planCy, 'centre'),
      `<circle class="phantom" cx="${r2(zX(mountZ))}" cy="${r2(planCy)}" r="${r2(E / 2 / k)}"/>`,
      centreMark(zX(mountZ), planCy),
    );
    if (seg) {
      const spans = whole
        ? [[-xo, xo]]
        : [
            [xi, xo],
            [-xo, -xi],
          ];
      for (const [x0, x1] of spans) {
        views.push(
          rect(zX(flatZ - halfThickZ), planY(x0), zX(flatZ + halfThickZ), planY(x1), 'hidden'),
        );
      }
    }
    for (const r of model.rollerAxles) {
      const cx = zX(r.contact.z);
      const cy = planY(r.contact.x);
      views.push(
        `<circle class="hidden" cx="${r2(cx)}" cy="${r2(cy)}" r="1.2"/>`,
        text(cx - 2, cy + 0.8, r.kind, { anchor: 'end', cls: 'small' }),
      );
    }
    views.push(
      `<circle class="pivot" cx="${r2(zX(pivot.z))}" cy="${r2(planCy)}" r="${r2(Math.max(5 / k, 0.7))}"/>`,
      centreMark(zX(pivot.z), planCy),
      text(zX(mountZ), planCy + E / 2 / k - 2, `mount base Ø ${fmt(E)}`, {
        anchor: 'middle',
        cls: 'small',
      }),
    );

    // Lengths from the pole edge, above the plan.
    views.push(
      dimH(zX(mountZ), b, planCy, top, top - 7, fmt(fromPole(mountZ))),
      dimH(zX(pivot.z), b, planCy, top, top - 15, fmt(fromPole(pivot.z))),
      dimH(a, b, bottom, bottom, bottom + 8, fmt(L)),
      dimV(top, bottom, b, b, b + 16, fmt(W)),
    );
    if (Math.abs(board.poleEdgeWidthMm - W) > 0.05) {
      views.push(
        dimV(
          planY(board.poleEdgeWidthMm / 2),
          planY(-board.poleEdgeWidthMm / 2),
          b,
          b,
          b + 7,
          fmt(board.poleEdgeWidthMm),
        ),
      );
    }

    // Radius leaders: to a point of the outline that lies on each arc.
    const onArc = (cz: number, r: number): PlanPoint | undefined => {
      const pts = board.outline.filter(
        (p) => p.x < -1e-6 && Math.abs(Math.hypot(p.x, p.z - cz) - r) < 1e-6,
      );
      return pts[Math.floor(pts.length / 2)];
    };
    const mountPt = onArc(mountZ, board.mountArc.radiusMm);
    if (mountPt) {
      const p = planPt(mountPt);
      views.push(leader(p.x, p.y, p.x + 10, p.y + 9, `R ${fmt(board.mountArc.radiusMm)}`));
    }
    const nosePt = onArc(pivot.z, board.pivotArc.radiusMm);
    if (nosePt) {
      const p = planPt(nosePt);
      views.push(leader(p.x, p.y, p.x - 8, p.y + 9, `R ${fmt(board.pivotArc.radiusMm)}`));
    }
    views.push(
      text(
        (a + b) / 2,
        bottom + 17,
        `PLAN (top board; dashed: segment and rollers below; ${names.pole.toLowerCase()} to the right)`,
        { anchor: 'middle', cls: 'label' },
      ),
    );
  }

  // ---------- Table of measurements. ----------
  const lat = `${fmt(Math.abs(inputs.latitudeDeg))}° ${names.poleLetter}`;
  const rows: [string, string][] = [
    ['#Boards', 'top and ground board, same outline: cut 2'],
    ['Outline', `${fmt(L)} long × ${fmt(W)} wide`],
    ['Pole edge (straight)', fmt(board.poleEdgeWidthMm)],
    [
      'Arc round the mount',
      `R ${fmt(board.mountArc.radiusMm)}, centre ${fmt(fromPole(mountZ))} from the pole edge`,
    ],
    ['Rounded nose', `R ${fmt(board.pivotArc.radiusMm)}, centre on the pivot`],
    ['Thickness', `top board ${fmt(t)}, ground board ${fmt(gT)}`],
    ['#Platform', ''],
    ['Height (F)', `${fmt(F)} from ground-board top to top-board top`],
    [
      `${names.equator} pivot`,
      `on the centre line, ${fmt(fromPole(pivot.z))} from the pole edge; bolt along the polar axis`,
    ],
    ['Mount base', `Ø ${fmt(E)}, centre ${fmt(fromPole(mountZ))} from the pole edge`],
    [`Pivot to ${names.pole.toLowerCase()} bearing (T)`, fmt(g.pivotToNorthBearingMm)],
    [`#${names.pole} segment (hangs under the top board)`, ''],
    ['Radius (I)', fmt(I)],
    [
      'Pieces',
      whole
        ? `1, ${fmt(xo)} each side of the centre line`
        : `2, each from ${fmt(xi)} to ${fmt(xo)} off the centre line`,
    ],
    ['Flat edge (mid-board)', `${fmt(fromPole(flatZ))} from the pole edge`],
    ['#Base (ground board)', ''],
    [
      'Rollers',
      `2, ${fmt(fromPole(roller.z))} from the pole edge, ${fmt(rollerX)} each side of the centre line`,
    ],
    ['Contact height', `${fmt(roller.y)} above the ground board (arc touches the rollers)`],
    ...model.rollerAxles.flatMap((r): [string, string][] => [
      [
        `${r.kind === 'free' ? 'Free' : 'Drive'} roller (${r.side})`,
        `Ø ${fmt(r.diameterMm)}, axle centre ${fmt(r.axle.y)} above the ground board`,
      ],
      [
        '',
        `axle ${fmt(Math.abs(r.axle.x))} off the centre line, ${fmt(fromPole(r.axle.z))} from the pole edge`,
      ],
      ...(r.clearanceMm < 0
        ? [['', `recess the ground board ${fmt(-r.clearanceMm)} deep under it`] as [string, string]]
        : []),
    ]),
    [
      'Roller axles',
      `parallel to the polar axis, rising ${fmt(Math.abs(inputs.latitudeDeg))}° to the pole`,
    ],
    [
      'Tracking',
      `±${fmt(g.trackingTravelDeg / 2)}°, ${result.checks.trackingHours.toFixed(1)} h in total`,
    ],
  ];
  {
    const x = leftX;
    let y = elevBottom + 32;
    parts.push(text(x, y, 'MEASUREMENTS (mm)', { cls: 'label' }));
    y += 5;
    for (const [key, value] of rows) {
      if (key.startsWith('#')) {
        y += 1.2;
        parts.push(text(x, y, key.slice(1) + (value ? `: ${value}` : ''), { cls: 'head' }));
      } else {
        parts.push(text(x + 2, y, key, { cls: 'note' }), text(x + 54, y, value, { cls: 'note' }));
      }
      y += 4.2;
    }
    if (seg) parts.push(rollerDetails(model, I, x, y + 4));
  }

  // ---------- Frame and title block. ----------
  const tbX = SHEET.widthMm - FRAME - TITLE_BLOCK.widthMm;
  const tbY = titleTop;
  const tbW = TITLE_BLOCK.widthMm;
  const tbR = SHEET.widthMm - FRAME;
  const cell = (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    value: string,
    big = false,
  ) =>
    rect(x, y, x + w, y + h, 'cell') +
    text(x + 1.2, y + 2.6, label, { cls: 'small' }) +
    text(x + 1.2, y + h - (big ? 1.6 : 1.4), value, big ? { cls: 'big' } : {});
  const title = `Platform and base, latitude ${lat}`;
  parts.push(
    rect(FRAME, FRAME, SHEET.widthMm - FRAME, SHEET.heightMm - FRAME, 'frame'),
    cell(tbX, tbY, tbW, 10, 'PROJECT', 'Dobsonian equatorial platform', true),
    cell(tbX, tbY + 10, tbW, 10, 'TITLE', title, true),
    cell(tbX, tbY + 20, 30, 10, 'SIZE', SHEET.name),
    cell(tbX + 30, tbY + 20, 40, 10, 'SCALE', `1:${k}`),
    cell(tbX + 70, tbY + 20, 40, 10, 'UNITS', 'mm'),
    cell(tbX + 110, tbY + 20, tbR - tbX - 110, 10, 'SHEET', '1/1'),
    cell(tbX, tbY + 30, 120, 10, 'DRAWN', 'Dobsonian EQ Platform Calculator'),
    cell(tbX + 120, tbY + 30, tbR - tbX - 120, 10, 'DATE', date),
  );

  const label = `${title}, scale 1:${k} on ${SHEET.name}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" class="${S}" width="${SHEET.widthMm}mm" ` +
    `height="${SHEET.heightMm}mm" viewBox="0 0 ${SHEET.widthMm} ${SHEET.heightMm}" role="img" ` +
    `aria-label="${escapeXml(label)}"><title>${escapeXml(label)}</title>${STYLE}` +
    `<rect class="sheet" width="${SHEET.widthMm}" height="${SHEET.heightMm}"/>` +
    views.join('') +
    parts.join('') +
    `</svg>`;
  return { svg, scale: k, sheet: SHEET.name };
}

/**
 * The free and the drive roller seen along the polar axis: the end of
 * the segment arc, the roller touching it, and the line from the roller's
 * axle to the polar axis, at 1:1. The axle must be I + r from the polar axis, so the
 * roller stays in contact as the platform turns.
 */
function rollerDetails(
  model: ReturnType<typeof buildViewerModel>,
  radiusMm: number,
  x0: number,
  top: number,
): string {
  const out: string[] = [
    text(x0, top, 'DETAIL: ROLLERS, seen along the polar axis, scale 1:1', { cls: 'label' }),
  ];
  const k = 1;
  const width = 84;
  model.rollerAxles.forEach((r, i) => {
    const ox = x0 + 2 + i * (width + 6);
    const cx = ox + width / 2;
    const cy = top + 34;
    // Segment-plane coordinates of the roller: a along x, b along planeUp, axis at (0, 0).
    const rad = r.diameterMm / 2;
    const nA = r.normal.x;
    const nB = r.normal.y * model.planeUp.y + r.normal.z * model.planeUp.z;
    const ca = r.contact.x;
    const cb = -radiusMm * Math.sqrt(Math.max(0, 1 - (ca / radiusMm) ** 2));
    const aa = ca + nA * rad;
    const ab = cb + nB * rad;
    // Looking from the pivot end towards the pole, as in the front view: −x is to the right.
    const X = (a: number): number => cx - (a - aa) * k;
    const Y = (b: number): number => cy - (b - ab) * k;
    const phiC = Math.atan2(ca, -cb);
    const arc: { x: number; y: number }[] = [];
    for (let j = 0; j <= 20; j++) {
      const phi = phiC + ((j - 10) / 10) * (14 / radiusMm);
      arc.push({ x: X(radiusMm * Math.sin(phi)), y: Y(-radiusMm * Math.cos(phi)) });
    }
    // The end of the segment board: the arc and 8 mm of board above it.
    const lift = 8;
    const board = [
      ...arc,
      ...arc
        .slice()
        .reverse()
        .map((p) => ({ x: p.x + (X(0) - X(nA)) * lift, y: p.y + (Y(0) - Y(nB)) * lift })),
    ];
    const toAxis = { x: X(aa - nA * (rad + lift + 8)), y: Y(ab - nB * (rad + lift + 8)) };
    out.push(
      `<path class="part" d="${pathOf(board)}"/>`,
      `<circle class="roller" cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rad * k)}"/>`,
      centreMark(cx, cy, rad * k + 2),
      line(cx, cy, toAxis.x, toAxis.y, 'centre'),
      arrow(toAxis.x, toAxis.y, toAxis.x - cx, toAxis.y - cy),
      text(toAxis.x + 1.5, toAxis.y + 1, `to the polar axis: ${fmt(radiusMm + rad)} (I + r)`, {
        cls: 'small',
      }),
      text(cx, cy + rad * k + 6, `axle centre ${fmt(r.axle.y)} above the ground board`, {
        anchor: 'middle',
        cls: 'small',
      }),
      text(cx, cy + rad * k + 9, `arc touches it ${fmt(r.contact.y)} above the ground board`, {
        anchor: 'middle',
        cls: 'small',
      }),
      text(
        cx,
        top + DETAIL_HEIGHT - 4,
        `${r.kind.toUpperCase()} ROLLER Ø ${fmt(r.diameterMm)} (${r.side})`,
        {
          anchor: 'middle',
          cls: 'head',
        },
      ),
    );
  });
  return out.join('');
}
