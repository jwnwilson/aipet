// Minimal mock for @babylonjs/* packages so Jest can run unit tests
// without loading the full WebGL/ESM Babylon.js runtime.

export class Scene {}
export class Vector3 {
  x: number; y: number; z: number;
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  copyFrom(_v: Vector3) {}
}
export class Color3 {
  r: number; g: number; b: number;
  constructor(r = 0, g = 0, b = 0) { this.r = r; this.g = g; this.b = b; }
  static Black() { return new Color3(0, 0, 0); }
  static White() { return new Color3(1, 1, 1); }
  static Gray() { return new Color3(0.5, 0.5, 0.5); }
}
export class TransformNode {
  name: string;
  parent: unknown = null;
  position = new Vector3();
  scaling = new Vector3(1, 1, 1);
  constructor(name: string, _scene?: unknown) { this.name = name; }
  getChildMeshes(_direct?: boolean): unknown[] { return []; }
  dispose() {}
}
export class Mesh extends TransformNode {
  static DOUBLESIDE = 2;
  static BILLBOARDMODE_ALL = 7;
  isPickable = false;
  billboardMode = 0;
  material: unknown = null;
}
export class MeshBuilder {
  static CreateBox(_name: string, _opts: unknown, _scene?: unknown): Mesh { return new Mesh(_name); }
  static CreatePlane(_name: string, _opts: unknown, _scene?: unknown): Mesh { return new Mesh(_name); }
}
export class StandardMaterial {
  diffuseColor: unknown = null;
  specularColor: unknown = null;
  opacityTexture: unknown = null;
  diffuseTexture: unknown = null;
  disableLighting = false;
  emissiveColor: unknown = null;
  constructor(_name: string, _scene?: unknown) {}
}
export class DynamicTexture {
  constructor(_name: string, _sizeOrOptions: unknown, _scene?: unknown) {}
  getContext() {
    return {
      font: "",
      measureText: (_text: string) => ({ width: 100 }),
    };
  }
  drawText(..._args: unknown[]) {}
  dispose() {}
}
export class MockObservable {
  callbacks: Array<(...args: unknown[]) => void> = [];
  addOnce(cb: (...args: unknown[]) => void) { this.callbacks.push(cb); }
  notify() { this.callbacks.forEach((cb) => cb()); this.callbacks = []; }
}
export class MockTexture {
  ready = false;
  baseWidth = 672;
  baseHeight = 2016;
  onLoadObservable = new MockObservable();
  isReady() { return this.ready; }
  getBaseSize() { return { width: this.baseWidth, height: this.baseHeight }; }
  /** Simulates the atlas PNG finishing its upload to the GPU. */
  finishLoad() { this.ready = true; this.onLoadObservable.notify(); }
}
export class SpriteManager {
  static last: SpriteManager | null = null;
  texture = new MockTexture();
  isPickable = false;
  constructor(..._args: unknown[]) { SpriteManager.last = this; }
  dispose() {}
}
export class Sprite {
  width = 0; height = 0; isPickable = false;
  position = new Vector3();
  constructor(..._args: unknown[]) {}
  playAnimation(..._args: unknown[]) {}
  dispose() {}
}

// GUI mocks
export class Control {
  static VERTICAL_ALIGNMENT_TOP    = 0;
  static VERTICAL_ALIGNMENT_CENTER = 1;
  static VERTICAL_ALIGNMENT_BOTTOM = 2;
  static HORIZONTAL_ALIGNMENT_LEFT   = 0;
  static HORIZONTAL_ALIGNMENT_CENTER = 1;
  static HORIZONTAL_ALIGNMENT_RIGHT  = 2;
  verticalAlignment   = 0;
  horizontalAlignment = 0;
}
export class Rectangle extends Control {
  width  = '0px';
  height = '0px';
  top    = '0px';
  left   = '0px';
  background = '';
  color      = '';
  thickness  = 0;
  cornerRadius = 0;
  isVisible  = true;
  paddingLeft  = '';
  paddingRight = '';
  constructor(_name?: string) { super(); }
  addControl(_ctrl: unknown) {}
}
export class TextBlock extends Control {
  text        = '';
  color       = '';
  fontSize    = '';
  fontWeight  = '';
  width       = '';
  height      = '';
  top         = '';
  left        = '';
  isVisible   = true;
  resizeToFit = false;
  textHorizontalAlignment = 0;
  textVerticalAlignment   = 0;
  constructor(_name?: string, text?: string) { super(); if (text) this.text = text; }
}
export class StackPanel extends Control {
  isVertical  = true;
  width       = '';
  height      = '';
  top         = '';
  left        = '';
  paddingLeft  = '';
  paddingRight = '';
  constructor(_name?: string) { super(); }
  addControl(_ctrl: unknown) {}
}
