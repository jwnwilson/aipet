// Minimal mock for @babylonjs/* packages so Jest can run unit tests
// without loading the full WebGL/ESM Babylon.js runtime.

export class Scene {}
export class Vector3 {
  x: number; y: number; z: number;
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  copyFrom(_v: Vector3) {}
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
