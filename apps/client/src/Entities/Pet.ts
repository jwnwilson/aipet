import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import { Entity } from './Entity';
import { EntityMove } from './Entity/EntityMove';
import { EntityNamePlate } from './Entity/EntityNamePlate';
import { BunnySpriteRenderer, AnimationState } from './Pet/BunnySpriteRenderer';
import { GameScene } from '../Screens/GameScene';

export class Pet extends Entity {
  private _spriteRenderer: BunnySpriteRenderer | null = null;
  private _prevX: number = 0;
  private _prevZ: number = 0;

  constructor(name: string, scene: Scene, gamescene: GameScene, entity) {
    super(name, scene, gamescene, entity);
  }

  public async spawn(entity): Promise<void> {
    this._spriteRenderer = new BunnySpriteRenderer(this._scene);
    try {
      await this._spriteRenderer.load();
    } catch (err) {
      console.error(`Pet: failed to load sprite renderer for entity ${entity.sessionId}:`, err);
      return;
    }

    this.position = new Vector3(entity.x, entity.y, entity.z);
    this._spriteRenderer.setPosition(this.position);
    this._prevX = entity.x;
    this._prevZ = entity.z;

    this.moveController = new EntityMove(this);
    this.moveController.setPositionAndRotation(entity);
    this.nameplateController = new EntityNamePlate(this);
    this.nameplate = this.nameplateController.addNamePlate();

    const rot = entity.rot ?? 0;
    this._spriteRenderer.playAnimation('idle', rot);

    entity.onChange(() => {
      this._syncFromServer(entity);
    });
  }

  private _syncFromServer(entity): void {
    const isMoving = entity.x !== this._prevX || entity.z !== this._prevZ;
    this._prevX = entity.x;
    this._prevZ = entity.z;

    // Babylon.js TransformNode.position must be updated in-place for the engine to observe the change
    this.position.set(entity.x, entity.y, entity.z);
    this._spriteRenderer?.setPosition(this.position);

    const animState: AnimationState = isMoving ? 'walk' : 'idle';
    const rot = entity.rot ?? 0;
    this._spriteRenderer?.playAnimation(animState, rot);
  }

  public remove(): void {
    this._spriteRenderer?.dispose();

    // dispose the nameplate mesh (addNamePlate returns the mesh/instance)
    if (this.nameplate) {
      this.nameplate.dispose();
    }

    this.dispose();
  }
}
