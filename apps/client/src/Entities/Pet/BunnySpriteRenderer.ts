import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { SpriteManager } from '@babylonjs/core/Sprites/spriteManager';
import { Sprite } from '@babylonjs/core/Sprites/sprite';

export type AnimationState = 'idle' | 'walk' | 'jump';

interface DirectionLayout {
  startCell: number;
  frameCount: number;
}

interface AtlasDescriptor {
  frameSize: number;
  cols: number;
  rows: number;
  layout: Record<AnimationState, Record<string, DirectionLayout>>;
}

function isAtlasDescriptor(json: unknown): json is AtlasDescriptor {
  if (!json || typeof json !== 'object') return false;
  const d = json as Record<string, unknown>;
  return (
    typeof d['frameSize'] === 'number' &&
    typeof d['cols'] === 'number' &&
    typeof d['rows'] === 'number' &&
    typeof d['layout'] === 'object' &&
    d['layout'] !== null
  );
}

// Ordered to match rot=0→south, increasing clockwise
const DIRECTIONS = [
  'south',
  'south-west',
  'west',
  'north-west',
  'north',
  'north-east',
  'east',
  'south-east',
];

const TAU = 2 * Math.PI;
const FRAME_MS = 150;
export const SPRITE_WORLD_SIZE = 3.0;
const ATLAS_URL = '/sprites/bunny/atlas.png';
const ATLAS_JSON_URL = '/sprites/bunny/atlas.json';

/** Maps entity Y-rotation (radians, Babylon.js convention) to nearest 8-direction string. */
export function directionFromAngle(rot: number): string {
  const normalized = ((rot % TAU) + TAU) % TAU;
  const index = (Math.round((normalized / TAU) * 8) + 4) % 8;
  return DIRECTIONS[index];
}

export class BunnySpriteRenderer {
  private _manager: SpriteManager | null = null;
  private _sprite: Sprite | null = null;
  private _atlasData: AtlasDescriptor | null = null;
  private _currentState: AnimationState | null = null;
  private _currentDir: string | null = null;

  constructor(private readonly _scene: Scene) {}

  async load(): Promise<void> {
    let response: Response;
    try {
      response = await fetch(ATLAS_JSON_URL);
    } catch (err) {
      throw new Error(`BunnySpriteRenderer: failed to fetch atlas descriptor: ${err}`);
    }
    if (!response.ok) {
      throw new Error(`BunnySpriteRenderer: atlas descriptor not found (${response.status})`);
    }
    let json: unknown;
    try {
      json = await response.json();
    } catch (err) {
      throw new Error(`BunnySpriteRenderer: atlas descriptor is not valid JSON: ${err}`);
    }
    if (!isAtlasDescriptor(json)) {
      throw new Error('BunnySpriteRenderer: atlas.json has unexpected shape');
    }
    this._atlasData = json;

    this._manager = new SpriteManager(
      'bunnyManager',
      ATLAS_URL,
      1,
      { width: this._atlasData.frameSize, height: this._atlasData.frameSize },
      this._scene
    );
    this._manager.isPickable = true;

    this._sprite = new Sprite('bunny', this._manager);
    this._sprite.width = SPRITE_WORLD_SIZE;
    this._sprite.height = SPRITE_WORLD_SIZE;
    this._sprite.isPickable = true;
  }

  setMetadata(metadata: unknown): void {
    if (this._sprite) (this._sprite as any).metadata = metadata;
  }

  setPosition(pos: Vector3): void {
    if (!this._sprite) return;
    // Lift by half the sprite height so the bottom edge sits at ground level
    this._sprite.position.set(pos.x, pos.y + SPRITE_WORLD_SIZE / 2, pos.z);
  }

  playAnimation(state: AnimationState, rot: number): void {
    if (!this._sprite || !this._atlasData) return;
    const dir = directionFromAngle(rot);
    if (state === this._currentState && dir === this._currentDir) return;
    const cell = this._atlasData.layout[state]?.[dir];
    if (!cell) return;
    this._currentState = state;
    this._currentDir = dir;
    this._sprite.playAnimation(cell.startCell, cell.startCell + cell.frameCount - 1, true, FRAME_MS);
  }

  dispose(): void {
    this._sprite?.dispose();
    this._manager?.dispose();
  }
}
