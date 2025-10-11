import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";

export interface NeedProperties {
  size: number;           // Size of the cube/GLTF model
  color: Color3;          // Color of the cube (applied to GLTF if no material)
  mass: number;           // Physics mass
  isStatic: boolean;      // Whether the object is static (immovable)
  isVisible: boolean;     // Whether the object is visible
  objectType?: string;    // Type of object (food, bed, other) - determines GLTF file to load
}

export class Need {
  private mesh: Mesh | null = null;
  private meshAggregate: PhysicsAggregate | null = null;
  private material: StandardMaterial | null = null;
  private properties: NeedProperties;
  private name: string;
  private isReady: boolean = false;
  private readyPromise: Promise<void>;

  // Mapping of object types to GLTF files
  private static readonly GLTF_MAPPING: Record<string, string> = {
    food: "/model/food/scene.gltf",
    bed: "/model/bed/scene.gltf",
    toy: "/model/toy/scene.gltf",
    toilet: "/model/toilet/scene.gltf",
    // Add more mappings as needed
  };

  constructor(
    private scene: Scene, 
    name: string = "Need", 
    position: Vector3 = new Vector3(0, 1, 0),
    properties: Partial<NeedProperties> = {}
  ) {
    this.scene = scene;
    this.name = name;
    
    // Set default properties
    this.properties = {
      size: 1,
      color: new Color3(0.5, 0.5, 0.5),
      mass: 1,
      isStatic: false,
      isVisible: true,
      ...properties
    };
    
    this.readyPromise = this._createNeed(position);
  }

  private async _createNeed(position: Vector3): Promise<void> {
    const objectType = this.properties.objectType || "other";
    const gltfPath = Need.GLTF_MAPPING[objectType];

    if (gltfPath) {
      // Try to load GLTF file
      try {
        await this._loadGLTFModel(gltfPath, position);
        this.isReady = true;
        return;
      } catch (error) {
        console.warn(`Failed to load GLTF model for ${objectType}:`, error);
        // Fall back to box creation
      }
    }

    // Fall back to creating a box
    this._createBoxMesh(position);
    this.isReady = true;
  }

  private async _loadGLTFModel(gltfPath: string, position: Vector3): Promise<void> {
    const result = await SceneLoader.ImportMeshAsync("", "", gltfPath, this.scene);
    
    if (result.meshes.length === 0) {
      throw new Error("No meshes found in GLTF file");
    }
    
    // Use the first mesh as the main mesh
    this.mesh = result.meshes[0] as Mesh;
    this.mesh.name = this.name;
    this.mesh.position = position;
    this.mesh.isVisible = this.properties.isVisible;

    // Scale the mesh according to the size property
    const scale = this.properties.size;
    this.mesh.scaling = new Vector3(scale, scale, scale);

    // Create material if the mesh doesn't have one
    if (!this.mesh.material) {
      this.material = new StandardMaterial(`${this.name}Material`, this.scene);
      this.material.diffuseColor = this.properties.color;
      this.material.specularColor = new Color3(0.1, 0.1, 0.1);
      this.material.emissiveColor = new Color3(0, 0, 0);
      this.mesh.material = this.material;
    } else {
      // Store reference to existing material
      this.material = this.mesh.material as StandardMaterial;
    }

    // Add physics if not static
    if (!this.properties.isStatic) {
      this.meshAggregate = new PhysicsAggregate(
        this.mesh, 
        PhysicsShapeType.BOX, 
        { 
          mass: this.properties.mass, 
          restitution: 0.3, 
          friction: 0.8
        }, 
        this.scene
      );
    }
  }

  private _createBoxMesh(position: Vector3): void {
    // Create cube mesh
    this.mesh = MeshBuilder.CreateBox(
      this.name, 
      { 
        size: this.properties.size,
        height: this.properties.size,
        width: this.properties.size,
        depth: this.properties.size
      }, 
      this.scene
    );
    
    this.mesh.position = position;
    this.mesh.isVisible = this.properties.isVisible;

    // Create material
    this.material = new StandardMaterial(`${this.name}Material`, this.scene);
    this.material.diffuseColor = this.properties.color;
    this.material.specularColor = new Color3(0.1, 0.1, 0.1);
    this.material.emissiveColor = new Color3(0, 0, 0);
    this.mesh.material = this.material;

    // Add physics if not static
    if (!this.properties.isStatic) {
      this.meshAggregate = new PhysicsAggregate(
        this.mesh, 
        PhysicsShapeType.BOX, 
        { 
          mass: this.properties.mass, 
          restitution: 0.3, 
          friction: 0.8
        }, 
        this.scene
      );
    }
  }

  // Methods to modify the need
  public setColor(color: Color3): void {
    this.properties.color = color;
    if (this.material) {
      this.material.diffuseColor = color;
    }
  }

  public setSize(size: number): void {
    this.properties.size = size;
    if (this.mesh) {
      this.mesh.scaling = new Vector3(size, size, size);
    }
  }

  public setPosition(position: Vector3): void {
    if (this.mesh) {
      this.mesh.position = position;
    }
  }

  public setMass(mass: number): void {
    this.properties.mass = mass;
    if (this.meshAggregate) {
      this.meshAggregate.body.setMassProperties({ mass });
    }
  }

  public setStatic(isStatic: boolean): void {
    this.properties.isStatic = isStatic;
    if (isStatic && this.meshAggregate) {
      this.meshAggregate.dispose();
      this.meshAggregate = null;
    } else if (!isStatic && !this.meshAggregate && this.mesh) {
      this.meshAggregate = new PhysicsAggregate(
        this.mesh, 
        PhysicsShapeType.BOX, 
        { 
          mass: this.properties.mass, 
          restitution: 0.3, 
          friction: 0.8
        }, 
        this.scene
      );
    }
  }

  public setVisible(isVisible: boolean): void {
    this.properties.isVisible = isVisible;
    if (this.mesh) {
      this.mesh.isVisible = isVisible;
    }
  }

  // Getters
  public getName(): string {
    return this.name;
  }

  public getProperties(): NeedProperties {
    return { ...this.properties };
  }

  public getMesh(): Mesh | null {
    return this.mesh;
  }

  public getPhysicsBody(): PhysicsAggregate | null {
    return this.meshAggregate;
  }

  public getPosition(): Vector3 {
    return this.mesh ? this.mesh.position : new Vector3(0, 0, 0);
  }

  public getMaterial(): StandardMaterial | null {
    return this.material;
  }

  public getObjectType(): string {
    return this.properties.objectType || "other";
  }

  // Async methods for handling GLTF loading
  public async waitForReady(): Promise<void> {
    return this.readyPromise;
  }

  public isNeedReady(): boolean {
    return this.isReady;
  }

  // Utility methods
  public applyImpulse(impulse: Vector3, point?: Vector3): void {
    if (this.meshAggregate && this.mesh) {
      const impulsePoint = point || this.mesh.position;
      this.meshAggregate.body.applyImpulse(impulse, impulsePoint);
    }
  }

  public applyForce(force: Vector3, point?: Vector3): void {
    if (this.meshAggregate && this.mesh) {
      const forcePoint = point || this.mesh.position;
      this.meshAggregate.body.applyForce(force, forcePoint);
    }
  }

  public rotate(axis: Vector3, amount: number): void {
    if (this.mesh) {
      this.mesh.rotate(axis, amount);
    }
  }

  public scale(factor: Vector3): void {
    if (this.mesh) {
      this.mesh.scaling = factor;
    }
  }

  // Cleanup method
  public dispose(): void {
    if (this.mesh) {
      this.mesh.dispose();
    }
    if (this.meshAggregate) {
      this.meshAggregate.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
  }
} 