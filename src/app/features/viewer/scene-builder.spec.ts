import { Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { DEFAULT_INPUTS, DEFAULT_OPTIONS, calculatePlatform } from '@core/calculator';
import { FALLBACK_COLORS, buildScene } from './scene-builder';
import { buildViewerModel } from '@shared/models/platform-model';

function build(over = {}, options = { ...DEFAULT_OPTIONS, unusedMiddlePercent: 0 }) {
  const inputs = { ...DEFAULT_INPUTS, ...over };
  const model = buildViewerModel(inputs, calculatePlatform(inputs, options));
  return { model, parts: buildScene(model, FALLBACK_COLORS, { labels: false }) };
}

describe('buildScene', () => {
  it('builds the two end pieces when the middle is left out', () => {
    const { parts } = build({}, DEFAULT_OPTIONS);
    const names = parts.platform.children.map((c) => c.name);
    expect(names).toContain('segment-piece-east');
    expect(names).toContain('segment-piece-west');
    expect(names).not.toContain('segment-whole');
    parts.dispose();
  });

  it('builds the expected parts', () => {
    const { parts } = build();
    const names = parts.platform.children.map((c) => c.name);
    expect(names).toContain('segment-whole');
    expect(parts.root.getObjectByName('pivot')).toBeDefined();
    expect(names).toContain('top-board');
    expect(names).toContain('cog');
    expect(parts.silhouette.children.map((c) => c.name).sort()).toEqual(['mount', 'tube']);
    expect(parts.labels.children.length).toBe(0); // labels disabled
    parts.dispose();
  });

  it('puts the north segment bounding box around the bearing contact point', () => {
    const { parts, model } = build();
    const mesh = parts.platform.getObjectByName('segment-whole') as Mesh;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    const contact = { z: model.segments[0].centre.z - 462.744 * model.planeUp.z };
    // The arc touches the ground at its mid-plane; the 18 mm board extends 9 mm
    // either side along the tilted polar axis, so its lowest corner is 9·sin α below.
    expect(box.min.y).toBeCloseTo(-9 * Math.sin((50.7279 * Math.PI) / 180), 1);
    expect(box.min.z).toBeLessThan(contact.z);
    expect(box.max.z).toBeGreaterThan(contact.z);
    // Segment board is as wide as the arc chord.
    expect(box.max.x - box.min.x).toBeCloseTo(
      2 * 462.744 * Math.sin((61.749 / 2 / 180) * Math.PI),
      1,
    );
    parts.dispose();
  });

  it('rotates the platform about the polar axis', () => {
    const { parts, model } = build();
    const probe = new Vector3(100, 200, 300);
    const axis = new Vector3(model.axisDir.x, model.axisDir.y, model.axisDir.z);
    const along = (v: Vector3) => v.dot(axis);
    parts.setTrackingAngle(30);
    const turned = probe.clone().applyQuaternion(parts.platform.quaternion);
    expect(along(turned)).toBeCloseTo(along(probe), 9); // distance along the axis is kept
    expect(turned.distanceTo(probe)).toBeGreaterThan(1);
    parts.setTrackingAngle(0);
    expect(probe.clone().applyQuaternion(parts.platform.quaternion).distanceTo(probe)).toBeCloseTo(
      0,
      9,
    );
    parts.dispose();
  });

  it('toggles wireframe on all standard materials', () => {
    const { parts } = build();
    parts.setWireframe(true);
    const mesh = parts.platform.getObjectByName('top-board') as Mesh;
    expect((mesh.material as MeshStandardMaterial).wireframe).toBe(true);
    parts.setWireframe(false);
    expect((mesh.material as MeshStandardMaterial).wireframe).toBe(false);
    parts.dispose();
  });

  it('disposes geometries and materials', () => {
    const { parts } = build();
    const mesh = parts.platform.getObjectByName('top-board') as Mesh;
    const geometry = vi.spyOn(mesh.geometry, 'dispose');
    const material = vi.spyOn(mesh.material as MeshStandardMaterial, 'dispose');
    parts.dispose();
    expect(geometry).toHaveBeenCalled();
    expect(material).toHaveBeenCalled();
    expect(parts.root.children.length).toBe(0);
  });

  it('skips segments that cannot be drawn', () => {
    const { parts } = build({ platformThicknessMm: 500 });
    expect(parts.platform.getObjectByName('segment-north')).toBeUndefined();
    parts.dispose();
  });

  it('builds without labels when no 2D canvas is available', () => {
    const inputs = DEFAULT_INPUTS;
    const model = buildViewerModel(inputs, calculatePlatform(inputs));
    const parts = buildScene(model, FALLBACK_COLORS); // jsdom has no canvas context
    expect(parts.labels.children.length).toBe(0);
    parts.dispose();
  });
});
