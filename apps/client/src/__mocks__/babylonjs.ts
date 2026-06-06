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
export class SpriteManager {
  constructor(..._args: unknown[]) {}
  dispose() {}
}
export class Sprite {
  width = 0; height = 0; isPickable = false;
  position = new Vector3();
  constructor(..._args: unknown[]) {}
  playAnimation(..._args: unknown[]) {}
  dispose() {}
}
