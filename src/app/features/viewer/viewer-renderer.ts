import { InjectionToken } from '@angular/core';
import { Camera, Scene, WebGLRenderer } from 'three';

/** The part of a three.js renderer the viewer uses. Lets tests supply a fake. */
export interface ViewerRenderer {
  readonly domElement: HTMLCanvasElement;
  setPixelRatio(ratio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setClearColor(color: number, alpha?: number): void;
  render(scene: Scene, camera: Camera): void;
  dispose(): void;
  /** Releases the WebGL context now instead of waiting for garbage collection. */
  forceContextLoss(): void;
}

export type ViewerRendererFactory = () => ViewerRenderer;

/** Creates a WebGL renderer. Throws when WebGL is unavailable. */
export const VIEWER_RENDERER_FACTORY = new InjectionToken<ViewerRendererFactory>(
  'VIEWER_RENDERER_FACTORY',
  { providedIn: 'root', factory: () => () => new WebGLRenderer({ antialias: true, alpha: true }) },
);
