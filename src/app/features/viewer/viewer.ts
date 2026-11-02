import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PlatformInputs, PlatformResult } from '@core/calculator';
import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FALLBACK_COLORS, SceneParts, ThemeColors, buildScene } from './scene-builder';
import { ViewerModel, buildViewerModel } from '@shared/models/platform-model';
import { VIEWER_RENDERER_FACTORY, ViewerRenderer } from './viewer-renderer';

const REBUILD_DEBOUNCE_MS = 150;
/** Seconds for one full sweep of the tracking animation. */
const SWEEP_SECONDS = 8;
/** How often the slider readout follows the animation, ms. */
const READOUT_INTERVAL_MS = 100;

/** Resolves a CSS custom property to an rgb() colour. */
function resolveColor(host: HTMLElement, token: string, fallback: string): string {
  try {
    const probe = host.ownerDocument.createElement('span');
    probe.style.color = `var(${token})`;
    host.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color && color.startsWith('rgb') ? color : fallback;
  } catch {
    return fallback;
  }
}

function themeColors(host: HTMLElement): ThemeColors {
  return {
    primary: resolveColor(host, '--mat-sys-primary', FALLBACK_COLORS.primary),
    secondary: resolveColor(host, '--mat-sys-secondary', FALLBACK_COLORS.secondary),
    tertiary: resolveColor(host, '--mat-sys-tertiary', FALLBACK_COLORS.tertiary),
    outline: resolveColor(host, '--mat-sys-outline', FALLBACK_COLORS.outline),
    onSurface: resolveColor(host, '--mat-sys-on-surface', FALLBACK_COLORS.onSurface),
    surfaceVariant: resolveColor(host, '--mat-sys-surface-variant', FALLBACK_COLORS.surfaceVariant),
  };
}

/** Interactive three.js view of the platform (SPEC §7). Only this feature imports `three`. */
@Component({
  imports: [MatButtonModule, MatCardModule, MatSliderModule, MatSlideToggleModule],
  selector: 'app-viewer',
  styleUrl: './viewer.scss',
  templateUrl: './viewer.html',
})
export class Viewer {
  private readonly createRenderer = inject(VIEWER_RENDERER_FACTORY);
  private readonly destroyRef = inject(DestroyRef);

  readonly inputs = input<PlatformInputs | null>(null);
  readonly result = input<PlatformResult | null>(null);

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  protected readonly unavailable = signal<string | null>(null);
  protected readonly notes = signal<string[]>([]);
  protected readonly wireframe = signal(false);
  protected readonly showLabels = signal(true);
  protected readonly showSilhouette = signal(true);
  protected readonly playing = signal(false);
  /** Tracking angle in degrees from the centred position. */
  protected readonly angleDeg = signal(0);

  protected readonly halfTravelDeg = computed(
    () => (this.result()?.geometry.trackingTravelDeg ?? 0) / 2,
  );

  private renderer: ViewerRenderer | null = null;
  private camera: PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private scene: Scene | null = null;
  private parts: SceneParts | null = null;
  private model: ViewerModel | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private rebuildTimer: ReturnType<typeof setTimeout> | undefined;
  private frame = 0;
  private animFrame = 0;
  private animStart = 0;
  private lastReadout = 0;
  private ready = false;
  private destroyed = false;

  constructor() {
    afterNextRender(() => this.init());

    // Rebuild the scene (debounced) when the inputs or result change.
    effect(() => {
      const inputs = this.inputs();
      const result = this.result();
      untracked(() => this.scheduleRebuild(inputs, result));
    });

    // Apply the view toggles and the manual tracking angle.
    effect(() => {
      const wireframe = this.wireframe();
      const labels = this.showLabels();
      const silhouette = this.showSilhouette();
      const angle = this.angleDeg();
      untracked(() => {
        if (!this.parts) return;
        this.parts.setWireframe(wireframe);
        this.parts.labels.visible = labels;
        this.parts.silhouette.visible = silhouette;
        if (!this.playing()) this.parts.setTrackingAngle(angle);
        this.requestRender();
      });
    });

    this.destroyRef.onDestroy(() => this.destroy());
  }

  /** Spoken value of the tracking slider. */
  protected readonly formatAngle = (value: number): string => `${value.toFixed(1)} degrees`;

  protected setAngle(value: number): void {
    this.angleDeg.set(value);
  }

  protected togglePlay(): void {
    if (this.playing()) {
      this.playing.set(false);
      cancelAnimationFrame(this.animFrame);
      return;
    }
    this.playing.set(true);
    this.animStart = performance.now();
    this.lastReadout = 0;
    this.animFrame = requestAnimationFrame((t) => this.animate(t));
  }

  protected resetView(): void {
    this.applyCameraDefaults();
    this.requestRender();
  }

  // --- Setup and teardown -------------------------------------------------

  private init(): void {
    if (this.destroyed) return;
    const host = this.host().nativeElement;
    try {
      this.renderer = this.createRenderer();
    } catch {
      this.unavailable.set('The 3D view needs WebGL, which is not available in this browser.');
      return;
    }
    const renderer = this.renderer;
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    this.scene = new Scene();
    this.scene.add(new AmbientLight(0xffffff, 1.1));
    const sun = new DirectionalLight(0xffffff, 2);
    sun.position.set(-1, 2, -1.5);
    this.scene.add(sun);

    this.camera = new PerspectiveCamera(40, 1, 10, 100000);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = false;
    // Arrow keys pan the view when the canvas area has focus.
    this.controls.listenToKeyEvents(host);
    this.controls.addEventListener('change', () => this.requestRender());

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(host);
    }
    this.ready = true;
    this.resize();
    this.rebuild(this.inputs(), this.result(), true);
  }

  private destroy(): void {
    this.destroyed = true;
    clearTimeout(this.rebuildTimer);
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.animFrame);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.parts?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
    this.parts = null;
    this.renderer = null;
    this.controls = null;
    this.scene = null;
    this.camera = null;
  }

  // --- Building the scene ---------------------------------------------------

  private scheduleRebuild(inputs: PlatformInputs | null, result: PlatformResult | null): void {
    if (!this.ready) return; // init() builds the first scene
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = setTimeout(() => this.rebuild(inputs, result, false), REBUILD_DEBOUNCE_MS);
  }

  /** The single place where scene objects are created and replaced. */
  private rebuild(
    inputs: PlatformInputs | null,
    result: PlatformResult | null,
    resetCamera: boolean,
  ): void {
    const scene = this.scene;
    if (!scene || this.destroyed) return;
    if (this.parts) {
      scene.remove(this.parts.root);
      this.parts.dispose();
      this.parts = null;
    }
    this.model = null;
    this.notes.set([]);
    if (inputs && result) {
      const model = buildViewerModel(inputs, result);
      const parts = buildScene(model, themeColors(this.host().nativeElement));
      parts.setWireframe(this.wireframe());
      parts.labels.visible = this.showLabels();
      parts.silhouette.visible = this.showSilhouette();
      parts.setTrackingAngle(this.angleDeg());
      scene.add(parts.root);
      this.parts = parts;
      this.model = model;
      this.notes.set(model.skipped.map((s) => s.reason));
      // Keep the slider inside the new travel range.
      const half = model.halfTravelDeg;
      if (Math.abs(this.angleDeg()) > half) this.angleDeg.set(Math.sign(this.angleDeg()) * half);
      if (resetCamera || !this.cameraPlaced) this.applyCameraDefaults();
    }
    this.requestRender();
  }

  private cameraPlaced = false;

  private applyCameraDefaults(): void {
    const camera = this.camera;
    const controls = this.controls;
    const model = this.model;
    if (!camera || !controls || !model) return;
    const t = model.camera.target;
    const d = model.camera.distanceMm;
    controls.target.set(t.x, t.y, t.z);
    // From the pivot end, off to one side and above, looking towards the pole.
    camera.position.copy(new Vector3(t.x + d * 0.75, t.y + d * 0.55, t.z - d * 0.85));
    camera.far = d * 40;
    camera.updateProjectionMatrix();
    controls.update();
    this.cameraPlaced = true;
  }

  // --- Rendering -------------------------------------------------------------

  private resize(): void {
    const renderer = this.renderer;
    const camera = this.camera;
    if (!renderer || !camera) return;
    const { clientWidth, clientHeight } = this.host().nativeElement;
    const width = Math.max(clientWidth, 1);
    const height = Math.max(clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    this.requestRender();
  }

  /** Renders on demand: at most one frame per animation frame, only when something changed. */
  private requestRender(): void {
    if (this.frame || !this.renderer || this.destroyed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    });
  }

  private animate(now: number): void {
    if (!this.playing() || this.destroyed) return;
    const half = this.halfTravelDeg();
    const progress = ((((now - this.animStart) / 1000 / SWEEP_SECONDS) % 1) + 1) % 1;
    // Turn the way the platform tracks: against the Earth's rotation.
    const direction = this.model?.trackingDirection ?? -1;
    const angle = direction * (-half + 2 * half * progress);
    this.parts?.setTrackingAngle(angle);
    // Not a signal write per frame: the readout follows a few times a second.
    if (now - this.lastReadout > READOUT_INTERVAL_MS) {
      this.lastReadout = now;
      this.angleDeg.set(Math.round(angle * 10) / 10);
    }
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    this.animFrame = requestAnimationFrame((t) => this.animate(t));
  }
}
