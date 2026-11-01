import { PlatformInputs, PlatformResult, hemisphereNames } from '@core/calculator';
import { toRad } from '@core/util/math';
import { buildViewerModel, SEGMENT_WIDTH_MM } from '@shared/models/platform-model';

/**
 * Pure builders for the exportable drawings (SVG text). Units are millimetres
 * and the SVG's width and height are in mm, so a print at 100 % scale is 1:1.
 */

const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * The drawings are shown inline in the page as well as downloaded, and a
 * <style> element inside inline SVG applies to the whole document. So every
 * selector is scoped to the drawing's own root class.
 */
const style = (scope: string, font: number): string => `<style>
  .${scope} .cut { fill: #eef3ff; stroke: #000; stroke-width: 0.6; }
  .${scope} .line { fill: none; stroke: #000; stroke-width: 0.4; }
  .${scope} .dash { fill: none; stroke: #555; stroke-width: 0.4; stroke-dasharray: 6 4; }
  .${scope} .thin { fill: none; stroke: #888; stroke-width: 0.3; }
  .${scope} .pivot { fill: #c33; stroke: #000; stroke-width: 0.4; }
  .${scope} text { font-family: sans-serif; font-size: ${font}px; fill: #000; }
  .${scope} .big { font-size: ${font * 1.3}px; font-weight: bold; }
</style>`;

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Root classes of the drawings; the style selectors are scoped to them. */
export const TEMPLATE_CLASS = 'dep-template';
export const PLAN_CLASS = 'dep-plan';

function document_(
  scope: string,
  widthMm: number,
  heightMm: number,
  title: string,
  body: string,
  font = 7,
): string {
  const w = r2(widthMm);
  const h = r2(heightMm);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="${scope}" width="${w}mm" height="${h}mm" ` +
    `viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(title)}">` +
    `<title>${escapeXml(title)}</title>${style(scope, font)}${body}</svg>`
  );
}

export interface SegmentTemplate {
  svg: string;
  /** Number of identical pieces to cut, the second one flipped over. */
  pieces: number;
  widthMm: number;
  heightMm: number;
  /** 'North' or 'South': which end of the platform the segment is under. */
  pole: 'North' | 'South';
}

/**
 * 1:1 template of one end piece of the pole-side segment. The straight top
 * goes against the underside of the top board; the curve is the bearing arc.
 * The second piece is this one flipped over. With no unused middle it is one
 * whole segment. `latitudeDeg` only picks the hemisphere names.
 */
export function buildSegmentTemplate(result: PlatformResult, latitudeDeg = 1): SegmentTemplate {
  const g = result.geometry;
  const names = hemisphereNames(latitudeDeg);
  const I = g.northRadiusMm;
  // Distance from the centre of curvature to the flat edge.
  const M = g.segmentFlatEdgeMm;
  const outer = toRad(g.pieceOuterAngleDeg);
  const inner = toRad(g.pieceInnerAngleDeg);
  const whole = g.pieceInnerAngleDeg === 0;

  // Centre of curvature at (0, 0); y points down; the flat edge is at y = M.
  const xo = I * Math.sin(outer);
  const xi = whole ? -xo : I * Math.sin(inner);
  const yo = I * Math.cos(outer);
  const yi = whole ? yo : I * Math.cos(inner);
  const bottom = whole ? I : yi; // lowest point of the outline
  const pad = 30;
  const label = 60;
  const minX = xi;
  const width = xo - xi;
  const height = bottom - M;
  // Shift so the outline starts at (pad, pad + label).
  const dx = pad - minX;
  const dy = pad + label - M;
  const p = (x: number, y: number): string => `${r2(x + dx)} ${r2(y + dy)}`;

  // Arc from the outer end to the inner end (right to left along the bottom).
  const arc = `A ${r2(I)} ${r2(I)} 0 0 1 ${p(xi, yi)}`;
  const outline = `M ${p(xi, M)} L ${p(xo, M)} L ${p(xo, yo)} ${arc} Z`;

  const totalW = width + pad * 2;
  const totalH = height + pad * 2 + label + 40;
  const cx = (xi + xo) / 2 + dx;
  const scaleY = height + pad + label + 14;
  const pieces = whole ? 1 : 2;

  const title = `${names.pole} segment template, scale 1:1`;
  const body = [
    `<path class="cut" d="${outline}"/>`,
    `<text class="big" x="${r2(pad)}" y="${r2(pad + 8)}">${title}</text>`,
    `<text x="${r2(pad)}" y="${r2(pad + 20)}">Cut ${pieces}${pieces === 2 ? ' (flip the template over for the second piece)' : ''}. Print at 100 % scale.</text>`,
    `<text x="${r2(pad)}" y="${r2(pad + 30)}">Radius ${r2(I)} mm, arc ${r2(g.pieceInnerAngleDeg)}° to ${r2(g.pieceOuterAngleDeg)}° each side of centre.</text>`,
    `<text x="${r2(pad)}" y="${r2(pad + 40)}">Top edge: glue flush with the underside of the ${r2(result.options.topBoardThicknessMm)} mm top board.</text>`,
    `<text x="${r2(cx)}" y="${r2(pad + label - 6)}" text-anchor="middle">top edge ${r2(width)} mm</text>`,
    // 100 mm scale bar to check the print scale.
    `<path class="line" d="M ${r2(pad)} ${r2(scaleY)} h 100 m 0 -3 v 6 m -100 0 v -6"/>`,
    `<text x="${r2(pad + 50)}" y="${r2(scaleY + 10)}" text-anchor="middle">100 mm</text>`,
  ].join('');
  const doc = document_(TEMPLATE_CLASS, totalW, totalH, title, body);
  return { svg: doc, pieces, widthMm: r2(width), heightMm: r2(height), pole: names.pole };
}

/**
 * Plan view (from above) of the platform: top board, mount footprint, the
 * end pieces of the segment under the pole end and the pivot at the other
 * end. The pole is at the top. Dimensions are approximate positions for
 * orientation.
 */
export function buildPlatformPlan(inputs: PlatformInputs, result: PlatformResult): string {
  const model = buildViewerModel(inputs, result);
  const names = hemisphereNames(inputs.latitudeDeg);
  const g = result.geometry;
  const E = inputs.mountBaseWidthMm;
  const board = model.topBoard;
  const bw = board.size.x;
  const bl = board.size.z;
  const zTop = board.centre.z + bl / 2; // pole-side edge
  const zBottom = board.centre.z - bl / 2;
  const pad = 40;
  const head = 50;
  const foot = 40;
  const totalW = bw + pad * 2;
  const totalH = bl + head + foot + pad;
  // Plan coordinates, seen from above with the pole at the top: the model's
  // +x (west in the north, east in the south) is on the left in both
  // hemispheres, so x is negated. y down = (zTop − z). Then shifted into the page.
  const px = (x: number): number => r2(-x + bw / 2 + pad);
  const left = (x0: number, x1: number): number => Math.min(px(x0), px(x1));
  const py = (z: number): number => r2(zTop - z + head);

  const outer = toRad(g.pieceOuterAngleDeg);
  const inner = toRad(g.pieceInnerAngleDeg);
  const whole = g.pieceInnerAngleDeg === 0;
  const seg = model.segments[0];
  const parts: string[] = [];

  parts.push(
    `<rect class="line" x="${left(-bw / 2, bw / 2)}" y="${py(zTop)}" width="${r2(bw)}" height="${r2(bl)}"/>`,
    `<rect class="dash" x="${left(-E / 2, E / 2)}" y="${py(model.mountBox.centre.z + E / 2)}" width="${r2(E)}" height="${r2(E)}"/>`,
    `<text x="${px(0)}" y="${py(model.mountBox.centre.z)}" text-anchor="middle">mount base ${r2(E)} mm</text>`,
  );

  if (seg) {
    // Flat edge of the segment seen from above: z of the line under the top board.
    const flatZ = seg.centre.z + -g.segmentFlatEdgeMm * model.planeUp.z;
    const halfThick = (SEGMENT_WIDTH_MM / 2) * model.axisDir.z;
    const xo = g.northRadiusMm * Math.sin(outer);
    const xi = g.northRadiusMm * Math.sin(inner);
    const spans = whole
      ? [[-xo, xo]]
      : [
          [xi, xo],
          [-xo, -xi],
        ];
    for (const [x0, x1] of spans) {
      parts.push(
        `<rect class="cut" x="${left(x0, x1)}" y="${py(flatZ + halfThick)}" width="${r2(x1 - x0)}" height="${r2(2 * halfThick)}"/>`,
      );
    }
    parts.push(
      `<text x="${px(0)}" y="${r2(py(flatZ) + 22)}" text-anchor="middle">${whole ? 'segment' : 'two mirrored segment pieces'}, radius ${r2(g.northRadiusMm)} mm</text>`,
    );
  }

  // Pivot and the polar axis direction (towards the pole).
  parts.push(
    `<circle class="pivot" cx="${px(0)}" cy="${py(model.pivot.z)}" r="5"/>`,
    `<text x="${r2(px(0) + 9)}" y="${r2(py(model.pivot.z) + 3)}">${names.equator.toLowerCase()} pivot</text>`,
    `<path class="thin" d="M ${px(0)} ${py(model.pivot.z)} V ${py(zTop)}"/>`,
    // Pole arrow, at the top right so it stays clear of the title.
    `<path class="line" d="M ${r2(pad + bw - 10)} ${head - 8} v -22 m -4 7 l 4 -7 l 4 7"/>`,
    `<text x="${r2(pad + bw - 18)}" y="${head - 22}" text-anchor="end">${names.poleLetter}</text>`,
    // Dimension: pivot to bearing.
    `<text x="${r2(pad + bw - 4)}" y="${r2(py(model.pivot.z) + 18)}" text-anchor="end">pivot to ${names.pole.toLowerCase()} bearing ${r2(g.pivotToNorthBearingMm)} mm</text>`,
    `<text x="${r2(pad + bw)}" y="${r2(totalH - 12)}" text-anchor="end">top board ${r2(bw)} × ${r2(bl)} mm</text>`,
    `<text class="big" x="${pad}" y="${head - 30}">Platform plan (view from above, scale 1:1)</text>`,
  );

  return document_(PLAN_CLASS, totalW, totalH, 'Platform plan, scale 1:1', parts.join(''), 14);
}
