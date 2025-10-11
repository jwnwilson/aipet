import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Scene } from "@babylonjs/core/scene";
import { Tools } from "@babylonjs/core/Misc/tools";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
// import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Ground } from "./ground";
import { Pet } from "./pet";
import { Need } from "./need";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";

registerBuiltInLoaders();
export default class MainScene {
  private camera: ArcRotateCamera;
  private ground: Ground | null = null;
  private pet: Pet | null = null;
  private needs: Need[] = [];

  constructor(private scene: Scene, private canvas: HTMLCanvasElement, private engine: Engine | WebGPUEngine) {
    this._setCamera(scene);
    this._setLight(scene);
    //  this._setEnvironment(scene);
    this.loadComponents();
  }

  _setCamera(scene: Scene): void {
    this.camera = new ArcRotateCamera("camera", Tools.ToRadians(120), Tools.ToRadians(50), 30, Vector3.Zero(), scene);
    this.camera.attachControl(this.canvas, true);
    this.camera.setTarget(Vector3.Zero());
  }

  _setLight(scene: Scene): void {
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.5;
  }

  _setEnvironment(scene: Scene) {
    scene.createDefaultEnvironment({ createGround: false, createSkybox: false });
  }

  _setPipeLine(): void {
    const pipeline = new DefaultRenderingPipeline("default-pipeline", false, this.scene, [this.scene.activeCamera!]);
    pipeline.fxaaEnabled = true;
    pipeline.samples = 4;
  }

  async loadComponents(): Promise<void> {
    // Load your files in order
    this.ground = new Ground(this.scene);
    this._createPet();
    await this._place_needs();
  }

  private _createPet(): void {
    // Create a Pet instance with needs
    this.pet = new Pet(this, "Bunny", new Vector3(0, 3, 0));
  }

  // Method to get the ground instance (which contains the pet)
  getGround(): Ground | null {
    return this.ground;
  }

  // Method to get the pet instance
  getPet(): Pet | null {
    return this.pet;
  }

  // Method to get all needs
  getNeeds(): Need[] {
    return this.needs;
  }

  getScene(): Scene {
    return this.scene;
  }

  // Method to add a new need and update the pet
  addNeed(need: Need): void {
    this.needs.push(need);
  }

  // Method to remove a need and update the pet
  removeNeed(needName: string): void {
    const index = this.needs.findIndex(need => need.getName() === needName);
    if (index !== -1) {
      const removedNeed = this.needs.splice(index, 1)[0];
      removedNeed.dispose();
    }
  }

  private async _place_needs(): Promise<void> {
    try {
      // Fetch the JSON file containing need configurations
      const response = await fetch('/needs-config.json');
      if (!response.ok) {
        console.warn('Could not load needs configuration file, using default needs');
        await this._createDefaultNeeds();
        return;
      }

      const needsConfig = await response.json();
      
      // Clear existing needs
      this.needs.forEach(need => need.dispose());
      this.needs = [];

      // Create needs based on the configuration
      for (const needConfig of needsConfig.needs) {
        const need = new Need(
          this.scene,
          needConfig.name,
          new Vector3(needConfig.position.x, needConfig.position.y, needConfig.position.z),
          {
            size: needConfig.size || 1,
            color: new Color3(needConfig.color.r, needConfig.color.g, needConfig.color.b),
            mass: needConfig.mass || 1,
            isStatic: needConfig.isStatic || false,
            isVisible: needConfig.isVisible !== undefined ? needConfig.isVisible : true,
            objectType: needConfig.objectType || "other"
          }
        );
        await need.waitForReady();
        this.needs.push(need);
      }

      console.log(`Placed ${this.needs.length} needs on the ground`);
    } catch (error) {
      console.error('Error loading needs configuration:', error);
      await this._createDefaultNeeds();
    }
  }

  private async _createDefaultNeeds(): Promise<void> {
    // Create some default needs if the JSON file is not available
    const defaultNeeds = [
      {
        name: "FoodNeed",
        position: { x: 5, y: 0.5, z: 0 },
        size: 1,
        color: { r: 1, g: 0, b: 0 }, // Red
        mass: 1,
        isStatic: false,
        objectType: "food"
      },
      {
        name: "BedNeed", 
        position: { x: -5, y: 0.5, z: 0 },
        size: 1,
        color: { r: 0, g: 0, b: 1 }, // Blue
        mass: 1,
        isStatic: false,
        objectType: "bed"
      },
      {
        name: "ToyNeed",
        position: { x: 0, y: 0.5, z: 5 },
        size: 1.5,
        color: { r: 1, g: 1, b: 0 }, // Yellow
        mass: 2,
        isStatic: false,
        objectType: "other"
      }
    ];

    for (const needConfig of defaultNeeds) {
      const need = new Need(
        this.scene,
        needConfig.name,
        new Vector3(needConfig.position.x, needConfig.position.y, needConfig.position.z),
        {
          size: needConfig.size,
          color: new Color3(needConfig.color.r, needConfig.color.g, needConfig.color.b),
          mass: needConfig.mass,
          isStatic: needConfig.isStatic,
          isVisible: true,
          objectType: needConfig.objectType
        }
      );
      await need.waitForReady();
      this.needs.push(need);
    }

    console.log('Created default needs');
  }

  // Cleanup method to dispose of all resources
  public dispose(): void {
    // Dispose of the pet (this will clear all intervals)
    if (this.pet) {
      this.pet.dispose();
      this.pet = null;
    }

    // Dispose of all needs
    this.needs.forEach(need => need.dispose());
    this.needs = [];

    // Note: Ground doesn't have a dispose method, so we just set it to null
    this.ground = null;
  }
}
