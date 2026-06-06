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
