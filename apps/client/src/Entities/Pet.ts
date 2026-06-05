import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import { Entity } from './Entity';
import { EntityMove } from './Entity/EntityMove';
import { EntityNamePlate } from './Entity/EntityNamePlate';
import { BunnySpriteRenderer, AnimationState, SPRITE_WORLD_SIZE } from './Pet/BunnySpriteRenderer';
import { GameScene } from '../Screens/GameScene';

const MOVE_THRESHOLD = 0.001;

export class Pet extends Entity {
  private _spriteRenderer: BunnySpriteRenderer | null = null;
  private _serverRot: number = 0;

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

    this._spriteRenderer.setMetadata({ type: 'entity', sessionId: entity.sessionId });

    this.position = new Vector3(entity.x, entity.y, entity.z);
    this._spriteRenderer.setPosition(this.position);

    this.moveController = new EntityMove(this);
    this.moveController.setPositionAndRotation(entity);
    this.nameplateController = new EntityNamePlate(this);
    // getEntityheight() returns hardcoded 1 when there is no mesh, ignoring offset_y.
    // Override on this instance so nameplate and chat both stack above the sprite.
    this.nameplateController.getEntityheight = (offset_y: number) => SPRITE_WORLD_SIZE + offset_y + 1.5;
    this.nameplate = this.nameplateController.addNamePlate();

    const rot = entity.rot ?? 0;
    this._spriteRenderer.playAnimation('idle', rot);

    entity.onChange(() => {
      this._syncFromServer(entity);
    });
  }

  private _syncFromServer(entity): void {
    this._serverRot = entity.rot ?? 0;
    this.moveController?.setPositionAndRotation(entity);
  }

  public update(delta?: number): void {
    const prevX = this.position.x;
    const prevZ = this.position.z;
    super.update(delta);
    this._spriteRenderer?.setPosition(this.position);
    const dx = this.position.x - prevX;
    const dz = this.position.z - prevZ;
    const isMoving = dx * dx + dz * dz > MOVE_THRESHOLD * MOVE_THRESHOLD;
    const animState: AnimationState = isMoving ? 'walk' : 'idle';
    this._spriteRenderer?.playAnimation(animState, this._serverRot);
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
