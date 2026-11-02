import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector2,
  Vector3,
} from 'three';
import { Box, PlanPoint, ViewerModel } from '@shared/models/platform-model';

/** Theme colours as CSS colour strings. */
export interface ThemeColors {
  primary: string;
  secondary: string;
  tertiary: string;
  outline: string;
  onSurface: string;
  surfaceVariant: string;
}

export const FALLBACK_COLORS: ThemeColors = {
  primary: '#0b57d0',
  secondary: '#575e71',
  tertiary: '#715573',
  outline: '#74777f',
  onSurface: '#1a1c1e',
  surfaceVariant: '#dfe2eb',
};

/** The parts of the scene the viewer needs to update after it is built. */
export interface SceneParts {
  root: Group;
  /** Everything that turns with the platform about the polar axis. */
  platform: Group;
  silhouette: Group;
  labels: Group;
  /** Rotates the platform about the polar axis (degrees from centre). */
  setTrackingAngle(deg: number): void;
  setWireframe(on: boolean): void;
  /** Frees every geometry, material and texture in the scene. */
  dispose(): void;
}

const v3 = (v: { x: number; y: number; z: number }): Vector3 => new Vector3(v.x, v.y, v.z);

function boxMesh(box: Box, material: Material): Mesh {
  const mesh = new Mesh(new BoxGeometry(box.size.x, box.size.y, box.size.z), material);
  mesh.position.set(box.centre.x, box.centre.y, box.centre.z);
  return mesh;
}

/**
 * A board cut to a plan outline, `thickness` thick with its top face at `topY`.
 * The shape is drawn in (x, z) and extruded downwards.
 */
function boardMesh(
  outline: PlanPoint[],
  topY: number,
  thickness: number,
  material: Material,
): Mesh {
  const shape = new Shape(outline.map((p) => new Vector2(p.x, p.z)));
  const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  // Rotating +90° about x maps the shape's (x, y, depth) to (x, −depth, y).
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, topY, 0);
  return new Mesh(geometry, material);
}

/** A text sprite, or null when no 2D canvas is available (for example in tests). */
function labelSprite(text: string, color: string, heightMm: number): Sprite | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const px = 64;
  ctx.font = `600 ${px}px sans-serif`;
  const width = Math.ceil(ctx.measureText(text).width) + 24;
  canvas.width = width;
  canvas.height = px + 24;
  // Resizing resets the context state.
  ctx.font = `600 ${px}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 12, canvas.height / 2);
  const texture = new CanvasTexture(canvas);
  const sprite = new Sprite(new SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set((heightMm * canvas.width) / canvas.height, heightMm, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function disposeMaterial(material: Material): void {
  const map = (material as Material & { map?: Texture | null }).map;
  map?.dispose();
  material.dispose();
}

/** Disposes every geometry, material and texture below (and including) `object`. */
export function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    const node = child as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    node.geometry?.dispose();
    if (Array.isArray(node.material)) node.material.forEach(disposeMaterial);
    else if (node.material) disposeMaterial(node.material);
  });
}

/**
 * Builds the scene objects for a model. Millimetres, right-handed, y up, z
 * towards the visible pole; see shared/models/platform-model.ts for the axis
 * conventions.
 */
export function buildScene(
  model: ViewerModel,
  colors: ThemeColors,
  options: { labels?: boolean } = {},
): SceneParts {
  const root = new Group();
  const platform = new Group();
  const silhouette = new Group();
  const labels = new Group();
  root.add(platform, labels);

  const standard = (color: string, extra: { opacity?: number } = {}) =>
    new MeshStandardMaterial({
      color,
      roughness: 0.75,
      metalness: 0.05,
      transparent: extra.opacity !== undefined,
      opacity: extra.opacity ?? 1,
    });

  // Fixed parts: ground board, polar axis, north marker.
  const ground = boardMesh(
    model.board.outline,
    model.groundBoard.centre.y + model.groundBoard.size.y / 2,
    model.groundBoard.size.y,
    standard(colors.surfaceVariant),
  );
  ground.name = 'ground-board';
  root.add(ground);

  const axisLine = new Line(
    new BufferGeometry().setFromPoints([v3(model.axis.from), v3(model.axis.to)]),
    new LineBasicMaterial({ color: colors.tertiary }),
  );
  root.add(axisLine);

  const marker = new Mesh(
    new ConeGeometry(model.labelHeightMm * 0.8, model.labelHeightMm * 2.4, 16),
    standard(colors.primary),
  );
  const poleLabel = model.labels.find((l) => l.pole);
  if (poleLabel) {
    marker.rotation.x = Math.PI / 2; // cone tip points to the pole (+z)
    marker.position.set(
      poleLabel.position.x,
      model.labelHeightMm * 0.5,
      poleLabel.position.z - model.labelHeightMm * 2,
    );
    root.add(marker);
  }

  // Rollers on the ground board, axles along the polar axis; they stay put.
  for (const r of model.rollerAxles) {
    const roller = new Mesh(
      new CylinderGeometry(r.diameterMm / 2, r.diameterMm / 2, 7, 24),
      standard(r.kind === 'drive' ? colors.tertiary : colors.outline),
    );
    roller.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), v3(model.axisDir));
    roller.position.set(r.axle.x, r.axle.y, r.axle.z);
    roller.name = `roller-${r.kind}`;
    root.add(roller);
  }

  // Pivot bolt: sits on the polar axis, so it stays put while the platform turns.
  const bolt = new Mesh(
    new CylinderGeometry(model.labelHeightMm * 0.3, model.labelHeightMm * 0.3, 60, 16),
    standard(colors.tertiary),
  );
  bolt.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), v3(model.axisDir));
  bolt.position.set(model.pivot.x, model.pivot.y, model.pivot.z);
  bolt.name = 'pivot';
  root.add(bolt);

  // Moving parts: segments, top board, mount, telescope, centre of gravity.
  const segmentMaterial = standard(colors.primary);
  const axis = v3(model.axisDir);
  const e2 = v3(model.planeUp);
  const xAxis = new Vector3(1, 0, 0);
  const basis = new Matrix4().makeBasis(xAxis, e2, axis);
  for (const seg of model.segments) {
    const shape = new Shape(seg.profile.map((p) => new Vector2(p.a, p.b)));
    const geometry = new ExtrudeGeometry(shape, {
      depth: model.segmentWidthMm,
      bevelEnabled: false,
    });
    // Centre the board on the segment plane, then map (a, b, depth) to (x, e2, axis).
    geometry.translate(0, 0, -model.segmentWidthMm / 2);
    geometry.applyMatrix4(basis);
    geometry.translate(seg.centre.x, seg.centre.y, seg.centre.z);
    const mesh = new Mesh(geometry, segmentMaterial);
    mesh.name = `segment-${seg.id}`;
    platform.add(mesh);
  }

  // Semi-transparent so the segments underneath stay visible.
  const topBoard = boardMesh(
    model.board.outline,
    model.topBoard.centre.y + model.topBoard.size.y / 2,
    model.topBoard.size.y,
    standard(colors.secondary, { opacity: 0.6 }),
  );
  topBoard.name = 'top-board';
  platform.add(topBoard);

  const cog = new Mesh(
    new SphereGeometry(model.labelHeightMm * 0.3, 16, 12),
    standard(colors.onSurface),
  );
  cog.position.set(model.cog.x, model.cog.y, model.cog.z);
  cog.name = 'cog';
  platform.add(cog);

  const silhouetteMaterial = standard(colors.outline, { opacity: 0.45 });
  const mount = boxMesh(model.mountBox, silhouetteMaterial);
  mount.name = 'mount';
  silhouette.add(mount);
  const tube = new Mesh(
    new CylinderGeometry(model.tube.radiusMm, model.tube.radiusMm, model.tube.lengthMm, 32),
    silhouetteMaterial,
  );
  // Cylinders run along y: turn y onto the polar axis.
  tube.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), axis);
  tube.position.set(model.tube.centre.x, model.tube.centre.y, model.tube.centre.z);
  tube.name = 'tube';
  silhouette.add(tube);
  platform.add(silhouette);

  // Dimension labels.
  if (options.labels !== false) {
    for (const label of model.labels) {
      const sprite = labelSprite(label.text, colors.onSurface, model.labelHeightMm);
      if (!sprite) continue;
      sprite.position.set(label.position.x, label.position.y, label.position.z);
      labels.add(sprite);
    }
    // Lettered result measurements: a line over what each one measures, and its label.
    const dimMaterial = new LineBasicMaterial({ color: colors.tertiary, depthTest: false });
    for (const d of model.dimensions) {
      const lineObj = new Line(new BufferGeometry().setFromPoints(d.points.map(v3)), dimMaterial);
      lineObj.name = `dimension-${d.letter}`;
      lineObj.renderOrder = 9;
      labels.add(lineObj);
      const sprite = labelSprite(d.text, colors.tertiary, model.labelHeightMm * 0.85);
      if (!sprite) continue;
      sprite.position.set(d.labelAt.x, d.labelAt.y, d.labelAt.z);
      labels.add(sprite);
    }
  }

  const materials: MeshStandardMaterial[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m instanceof MeshStandardMaterial && !materials.includes(m)) materials.push(m);
  });

  return {
    root,
    platform,
    silhouette,
    labels,
    setTrackingAngle(deg) {
      platform.quaternion.setFromAxisAngle(axis, (deg * Math.PI) / 180);
    },
    setWireframe(on) {
      for (const m of materials) m.wireframe = on;
    },
    dispose() {
      disposeObject(root);
      root.clear();
    },
  };
}
