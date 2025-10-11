import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3, SpriteManager, Sprite } from "@babylonjs/core";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

export class Ground {
  private mesh: Mesh | null = null;
  private meshAggregate: PhysicsAggregate | null = null;
  private spriteManagerPlayer: SpriteManager | null = null;
  private aipet: Sprite | null = null;
  private walls: Mesh[] = [];
  private wallAggregates: PhysicsAggregate[] = [];

  constructor(private scene: Scene) {
    this.scene = scene;
    this.mesh = null;
    this._createGround();
    this._createWalls();
  }

  _createGround(): void {
    const mesh = MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, this.scene);
    
    // Create material and apply floor texture
    const groundMaterial = new StandardMaterial("groundMaterial", this.scene);
    const floorTexture = new Texture("/texture/floor.png", this.scene);
    groundMaterial.diffuseTexture = floorTexture;
    
    // Apply material to the ground mesh
    mesh.material = groundMaterial;
    
    new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 1 }, this.scene);
  }

  _createWalls(): void {
    const groundSize = 20;
    const wallHeight = 2;
    const wallThickness = 0.5;
    const halfSize = groundSize / 2;

    // Create floor material for walls
    const wallMaterial = new StandardMaterial("wallMaterial", this.scene);
    const floorTexture = new Texture("/texture/floor.png", this.scene);
    wallMaterial.diffuseTexture = floorTexture;

    // Create four walls around the ground
    const wallPositions = [
      // North wall
      { position: new Vector3(0, wallHeight / 2, halfSize), rotation: new Vector3(0, 0, 0) },
      // South wall
      { position: new Vector3(0, wallHeight / 2, -halfSize), rotation: new Vector3(0, 0, 0) },
      // East wall
      { position: new Vector3(halfSize, wallHeight / 2, 0), rotation: new Vector3(0, Math.PI / 2, 0) },
      // West wall
      { position: new Vector3(-halfSize, wallHeight / 2, 0), rotation: new Vector3(0, Math.PI / 2, 0) }
    ];

    wallPositions.forEach((wallData, index) => {
      const wall = MeshBuilder.CreateBox(
        `wall_${index}`,
        {
          width: groundSize,
          height: wallHeight,
          depth: wallThickness
        },
        this.scene
      );

      wall.position = wallData.position;
      wall.rotation = wallData.rotation;

      // Apply floor material to the wall
      wall.material = wallMaterial;

      // Add physics to the wall
      const wallAggregate = new PhysicsAggregate(
        wall,
        PhysicsShapeType.BOX,
        { mass: 0 },
        this.scene
      );

      this.walls.push(wall);
      this.wallAggregates.push(wallAggregate);
    });
  }
}
