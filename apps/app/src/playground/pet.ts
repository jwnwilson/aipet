import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3, Matrix } from "@babylonjs/core";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { SpriteManager } from "@babylonjs/core/Sprites/spriteManager";
import { Sprite } from "@babylonjs/core/Sprites/sprite";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { Need } from "./need";
import { apiClient, SceneData, SceneObject, PetData, ObjectTypes, ApiResponse, PetActionRecommendation } from "../api/client";
import MainScene from "./main-scene";

export interface PetNeeds {
  hungry: number;      // 0-100 (100 = very hungry)
  tiredness: number;   // 0-100 (100 = very tired)
  boredom: number;     // 0-100 (100 = very bored)
  toilet: number;      // 0-100 (100 = really needs to go)
}

export class Pet {
  private mesh: Mesh | null = null;
  private meshAggregate: PhysicsAggregate | null = null;
  private sprite: Sprite | null = null;
  private spriteManager: SpriteManager | null = null;
  private shadowMesh: Mesh | null = null;
  private needs: PetNeeds;
  private name: string;
  private proximityThreshold: number = 3.0; // Distance threshold for need interaction
  private demoTimeoutMs: number;
  private mainScene: MainScene;
  private scene: Scene;
  // Track intervals to prevent duplicates and enable cleanup
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  // Speech bubble properties
  private speechBubble: AdvancedDynamicTexture | null = null;
  private speechText: TextBlock | null = null;
  private speechBackground: Rectangle | null = null;
  private speechTimeout: NodeJS.Timeout | null = null;

  constructor(
    scene: MainScene, 
    name: string = "Pet", 
    position: Vector3 = new Vector3(0, 2, 0),
  ) {
    this.mainScene = scene;
    this.scene = scene.getScene();
    this.name = name;
    this.needs = {
      hungry: 50,
      tiredness: 30,
      boredom: 40,
      toilet: 20
    };
    this.demoTimeoutMs = parseInt(import.meta.env.VITE_DEMO_TIMEOUT_MS || '120000', 10);
    
    this._createPet(position);
    this._createSpeechBubble();
    this._startNeedsDecay();
    this._startPetThinking();
    this._createKeyboardControls();
    this._startDemoTimeout();
  }

  private _createPet(position: Vector3): void {
    // Create an invisible sphere for physics
    this.mesh = MeshBuilder.CreateSphere("petPhysics", { diameter: 1.5, segments: 32 }, this.scene);
    this.mesh.position = position;
    this.mesh.isVisible = false; // Make the mesh invisible

    // Add physics to the invisible sphere
    this.meshAggregate = new PhysicsAggregate(
      this.mesh, 
      PhysicsShapeType.BOX, 
      { mass: 0.5, restitution: 0.6, friction: 1}, 
      this.scene
    );

    // Create sprite manager and sprite
    this.spriteManager = new SpriteManager("petSpriteManager", "/texture/bunny.png", 1, { width: 32, height: 32 }, this.scene);
    this.sprite = new Sprite("petSprite", this.spriteManager);
    this.sprite.playAnimation(0, 4, true, 100);
    this.sprite.position = position;
    this.sprite.width = 1.5;
    this.sprite.height = 1.5;
    
    // Create shadow mesh and shadow generator
    this._createShadow();
    
    // Update sprite position to follow physics body
    this.scene.registerBeforeRender(() => {
      if (this.mesh && this.sprite) {
        this.sprite.position = this.mesh.position;
        // Update shadow position to follow the pet
        if (this.shadowMesh) {
          this.shadowMesh.position = new Vector3(this.mesh.position.x, 0.01, this.mesh.position.z);
        }
      }
    });
  }

  private _createShadow(): void {
    // Create a flat circle mesh for the shadow
    this.shadowMesh = MeshBuilder.CreateDisc("petShadow", { radius: 0.4, tessellation: 32 }, this.scene);
    this.shadowMesh.position = new Vector3(0, 0.01, 0); // Slightly above ground to avoid z-fighting
    this.shadowMesh.rotation.x = Math.PI / 2; // Rotate to lay flat on the ground
    
    // Create shadow material
    const shadowMaterial = new StandardMaterial("shadowMaterial", this.scene);
    shadowMaterial.diffuseColor = new Color3(0, 0, 0);
    shadowMaterial.alpha = 0.3; // Semi-transparent
    shadowMaterial.emissiveColor = new Color3(0, 0, 0);
    shadowMaterial.specularColor = new Color3(0, 0, 0);
    this.shadowMesh.material = shadowMaterial;
  }

  private _createSpeechBubble(): void {
    this.speechBubble = AdvancedDynamicTexture.CreateFullscreenUI("UI");

    
    this.speechBackground = new Rectangle();
    this.speechBackground.width = "300px";
    this.speechBackground.height = "300px";
    this.speechBackground.cornerRadius = 20;
    this.speechBackground.color = "Black";
    this.speechBackground.thickness = 4;
    this.speechBackground.background = "white";
    this.speechBubble.addControl(this.speechBackground);
    this.speechBackground.linkWithMesh(this.mesh);   
    this.speechBackground.linkOffsetY = -200;
    
    // const font = "65px Arial";
    this.speechText = new TextBlock();
    this.speechText.text = "";
    this.speechText.fontFamily = "Arial, sans-serif";
    this.speechText.fontSize = 40;
    // this.speechText.setAttribute('style', `font: ${font} !important`);
    this.speechText.lineSpacing = 5;
    this.speechText.textWrapping = true;

    this.speechBackground.addControl(this.speechText);
    this.speechBackground.isVisible = false;
  }

  private _showSpeech(text: string, duration: number = 3000): void {
    if (!this.speechBackground || !this.speechText) return;
    
    // Clear any existing timeout
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
    }
    
    // Update speech text
    this.speechText.text = text;
    
    // Show the speech bubble
    this.speechBackground.isVisible = true;
    
    // Hide after duration
    this.speechTimeout = setTimeout(() => {
      this._hideSpeech();
    }, duration);
  }

  private _hideSpeech(): void {
    if (!this.speechBackground) return;
    
    this.speechBackground.isVisible = false;
    
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
  }

  private _startNeedsDecay(): void {
    // Clear existing interval if it exists
    this._clearInterval('needsDecay');
    
    // Simulate pet needs increasing over time
    const interval = setInterval(() => {
      this.needs.hungry = Math.min(100, this.needs.hungry + 0.5);
      this.needs.tiredness = Math.min(100, this.needs.tiredness + 0.3);
      this.needs.boredom = Math.min(100, this.needs.boredom + 0.4);
      this.needs.toilet = Math.min(100, this.needs.toilet + 0.2);
      
      this._updatePetAppearance();
      this._updateStatusDisplay();
    }, 1000); // Update every second
    
    // Store the interval for tracking
    this.intervals.set('needsDecay', interval);
    console.log(`${this.name}: Started needs decay interval`);
  }

  private _clearInterval(name: string): void {
    const existingInterval = this.intervals.get(name);
    if (existingInterval) {
      clearInterval(existingInterval);
      this.intervals.delete(name);
    }
  }

  private _clearAllIntervals(): void {
    // Clear all tracked intervals
    for (const [name, interval] of this.intervals.entries()) {
      clearInterval(interval);
      console.log(`${this.name}: Cleared interval: ${name}`);
    }
    this.intervals.clear();
  }

  private _startPetThinking(): void {
    // Clear existing interval if it exists
    this._clearInterval('petThinking');
    
    const interval = setInterval(async () => {
      console.log(`${this.name} is thinking...`);
      this._showSpeech("Hmm... what should I do?", 2000);
      
      try {
        // Convert pet needs and scene objects to scene data format
        const petData: PetData = {
          type: "pet",
          position: this.mesh ? [this.mesh.position.x, this.mesh.position.y, this.mesh.position.z] : [0, 0, 0],
          hungry: this.needs.hungry,
          tiredness: this.needs.tiredness,
          boredom: this.needs.boredom,
          toilet: this.needs.toilet
        };

        // Convert need objects to scene objects
        const sceneObjects: SceneObject[] = this.mainScene.getNeeds().map(need => {
          const position = need.getPosition();
          const objectType = need.getObjectType();
          return {
            type: objectType as ObjectTypes,
            position: [position.x, position.y, position.z]
          };
        });

        const sceneData: SceneData = {
          scene_data: sceneObjects,
          pet_data: petData
        };

        // Get pet recommendations from the API
        const response: ApiResponse<PetActionRecommendation> = await apiClient.getPetRecommendations(sceneData);
        
        if (response.data) {
          this._handle_pet_recommendations(response.data);
        } else if (response.error) {
          console.error(`Failed to get recommendations for ${this.name}:`, response.error);
        }
      } catch (error) {
        console.error(`Error getting pet recommendations for ${this.name}:`, error);
      }
    }, 5000);
    
    // Store the interval for tracking
    this.intervals.set('petThinking', interval);
  }

  private _handle_pet_recommendations(pet_recommendation: PetActionRecommendation): void {
    console.log(`${this.name} AI recommendation:`, pet_recommendation);
    const thinkingInterval: number = 5000;
    
    // Show what the pet is going to do
    if (pet_recommendation.action) {
      this._showSpeech(`${pet_recommendation.reasoning}!`, 3000);
    }
    
    // Apply movement force if recommendation includes movement
    if (pet_recommendation.movement && this.meshAggregate && this.mesh) {
      const [x, y, z] = pet_recommendation.movement;
      const movementVector = new Vector3(x, y, z);
      
      // Apply initial impulse
      this.meshAggregate.body.applyImpulse(movementVector, this.mesh.position);
      
      // Set up continuous force application for 5 seconds
      const forceInterval = setInterval(() => {
        if (this.meshAggregate && this.mesh) {
          // Apply a smaller continuous force to maintain movement
          const continuousForce = movementVector.scale(0.2);
          this.meshAggregate.body.applyForce(continuousForce, this.mesh.position);
        }
      }, 500); // Apply force every 100ms
      
      // Stop applying force after 5 seconds
      setTimeout(() => {
        clearInterval(forceInterval);
        console.log(`${this.name} movement recommendation completed`);
      }, thinkingInterval);
    }
    
    // Handle action recommendation if provided
    if (pet_recommendation.action) {
      console.log(`${this.name} will perform action: ${pet_recommendation.action}`);
      
      // Perform the action immediately
      this._performAction(pet_recommendation.action);
      
      // Set up periodic action triggering for 5 seconds
      const actionInterval = setInterval(() => {
        this._performAction(pet_recommendation.action!);
      }, 1000); // Trigger action every 1 seconds
      
      // Stop periodic actions after 5 seconds
      setTimeout(() => {
        clearInterval(actionInterval);
        console.log(`${this.name} action recommendation completed`);
      }, thinkingInterval);
    }
  }
  
  private _performAction(action: string): void {
    switch (action) {
      case "feed":
        this.feed();
        break;
      case "play":
        this.play();
        break;
      case "toilet":
        this.toilet();
        break;
      case "sleep":
        this.sleep();
        break;
      default:
        console.warn(`Unknown action: ${action}`);
    }
  }

  private _updatePetAppearance(): void {
    if (!this.mesh || !this.mesh.material) return;
  }

  private _updateStatusDisplay(): void {
    // Create or update a status display element
    let statusDiv = document.getElementById("pet-status");
    if (!statusDiv) {
      statusDiv = document.createElement("div");
      statusDiv.id = "pet-status";
      statusDiv.style.position = "absolute";
      statusDiv.style.top = "10px";
      statusDiv.style.left = "10px";
      statusDiv.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
      statusDiv.style.color = "white";
      statusDiv.style.padding = "10px";
      statusDiv.style.borderRadius = "5px";
      statusDiv.style.fontFamily = "Arial, sans-serif";
      statusDiv.style.fontSize = "14px";
      statusDiv.style.zIndex = "1000";
      document.body.appendChild(statusDiv);
    }

    const urgentNeed = this.getMostUrgentNeed();
    
    // Check what needs are nearby
    const nearbyNeeds = this.getNearbyNeeds();
    const nearbyText = nearbyNeeds.length > 0 
      ? nearbyNeeds.map(need => need.getName()).join(', ')
      : 'None';
    
    statusDiv.innerHTML = `
      <strong>${this.name} Status:</strong><br/>
      🍔 Hungry: ${this.needs.hungry.toFixed(1)}<br/>
      😴 Tired: ${this.needs.tiredness.toFixed(1)}<br/>
      😑 Bored: ${this.needs.boredom.toFixed(1)}<br/>
      🚽 Toilet: ${this.needs.toilet.toFixed(1)}<br/>
      <br/>
      <strong>Most Urgent:</strong> ${urgentNeed.need} (${urgentNeed.value.toFixed(1)})<br/>
      <strong>Nearby Needs:</strong> ${nearbyText}<br/>
      <strong>Proximity Range:</strong> ${this.proximityThreshold.toFixed(1)}m<br/>
    `;
  }

  private getNearbyNeeds(): Need[] {
    if (!this.mesh) return [];
    
    const petPosition = this.mesh.position;
    const nearby: Need[] = [];
    
    for (const need of this.mainScene.getNeeds()) {
      const distance = Vector3.Distance(petPosition, need.getPosition());
      if (distance <= this.proximityThreshold) {
        nearby.push(need);
      }
    }
    
    return nearby;
  }

  // Methods to check proximity to needs
  private isNearNeed(needType: string): boolean {
    if (!this.mesh) return false;
    
    const petPosition = this.mesh.position;
    
    for (const need of this.mainScene.getNeeds()) {
      const needName = need.getName().toLowerCase();
      if (needName.includes(needType.toLowerCase())) {
        const distance = Vector3.Distance(petPosition, need.getPosition());
        if (distance <= this.proximityThreshold) {
          return true;
        }
      }
    }
    return false;
  }

  private findClosestNeed(needType: string): Need | null {
    if (!this.mesh) return null;
    
    const petPosition = this.mesh.position;
    let closestNeed: Need | null = null;
    let closestDistance = Infinity;
    
    for (const need of this.mainScene.getNeeds()) {
      const needName = need.getName().toLowerCase();
      if (needName.includes(needType.toLowerCase())) {
        const distance = Vector3.Distance(petPosition, need.getPosition());
        if (distance < closestDistance) {
          closestDistance = distance;
          closestNeed = need;
        }
      }
    }
    
    return closestNeed;
  }

  // Methods to satisfy pet needs
  public feed(): void {
    if (!this.isNearNeed('food')) {
      const closestFood = this.findClosestNeed('food');
      if (closestFood) {
        console.log(`${this.name} needs to go to the food! It's at position ${closestFood.getPosition()}`);
        this._showSpeech("I need to find food!", 2000);
        return;
      } else {
        console.log(`${this.name} can't find any food nearby!`);
        this._showSpeech("I can't find any food!", 2000);
        return;
      }
    }
    
    this.needs.hungry = Math.max(0, this.needs.hungry - 30);
    console.log(`${this.name} has been fed! Hunger: ${this.needs.hungry}`);
    this._showSpeech("Yummy! That was delicious!", 2000);
  }

  public sleep(): void {
    if (!this.isNearNeed('sleep') && !this.isNearNeed('bed')) {
      const closestSleep = this.findClosestNeed('sleep') || this.findClosestNeed('bed');
      if (closestSleep) {
        console.log(`${this.name} needs to go to the sleep area! It's at position ${closestSleep.getPosition()}`);
        this._showSpeech("I need to find a bed!", 2000);
        return;
      } else {
        console.log(`${this.name} can't find any sleep area nearby!`);
        this._showSpeech("I can't find anywhere to sleep!", 2000);
        return;
      }
    }
    
    this.needs.tiredness = Math.max(0, this.needs.tiredness - 40);
    console.log(`${this.name} has slept! Tiredness: ${this.needs.tiredness}`);
    this._showSpeech("Zzz... That was refreshing!", 2000);
  }

  public play(): void {
    if (!this.isNearNeed('toy') && !this.isNearNeed('play')) {
      const closestToy = this.findClosestNeed('toy') || this.findClosestNeed('play');
      if (closestToy) {
        console.log(`${this.name} needs to go to the toy! It's at position ${closestToy.getPosition()}`);
        this._showSpeech("I need to find a toy!", 2000);
        return;
      } else {
        console.log(`${this.name} can't find any toys nearby!`);
        this._showSpeech("I can't find any toys!", 2000);
        return;
      }
    }
    
    this.needs.boredom = Math.max(0, this.needs.boredom - 35);
    // Playing also increases tiredness slightly
    this.needs.tiredness = Math.min(100, this.needs.tiredness + 10);
    console.log(`${this.name} has played! Boredom: ${this.needs.boredom}, Tiredness: ${this.needs.tiredness}`);
    this._showSpeech("Wheee! This is fun!", 2000);
  }

  public toilet(): void {
    if (!this.isNearNeed('toilet') && !this.isNearNeed('bathroom')) {
      const closestToilet = this.findClosestNeed('toilet') || this.findClosestNeed('bathroom');
      if (closestToilet) {
        console.log(`${this.name} needs to go to the toilet! It's at position ${closestToilet.getPosition()}`);
        this._showSpeech("I need to find a bathroom!", 2000);
        return;
      } else {
        console.log(`${this.name} can't find any toilet nearby!`);
        this._showSpeech("I can't find a bathroom!", 2000);
        return;
      }
    }
    
    this.needs.toilet = Math.max(0, this.needs.toilet - 50);
    console.log(`${this.name} used the toilet! Toilet need: ${this.needs.toilet}`);
    this._showSpeech("Ah, much better!", 2000);
  }

  // Getters
  public getName(): string {
    return this.name;
  }

  public getMesh(): Mesh | null {
    return this.mesh;
  }

  public getPhysicsBody(): PhysicsAggregate | null {
    return this.meshAggregate;
  }

  // Method to set proximity threshold
  public setProximityThreshold(threshold: number): void {
    this.proximityThreshold = threshold;
  }

  // Method to get the most urgent need
  public getMostUrgentNeed(): { need: keyof PetNeeds; value: number } {
    const needs = this.needs;
    let maxNeed: keyof PetNeeds = 'hungry';
    let maxValue = needs.hungry;

    for (const [need, value] of Object.entries(needs) as [keyof PetNeeds, number][]) {
      if (value > maxValue) {
        maxNeed = need;
        maxValue = value;
      }
    }

    return { need: maxNeed, value: maxValue };
  }

  private _createKeyboardControls(): void {
    // Track key states for simultaneous key presses
    const keyStates: { [key: string]: boolean } = {};
    
    this.scene.onKeyboardObservable.add((kbInfo) => {
      switch (kbInfo.type) {
        case KeyboardEventTypes.KEYDOWN:
          // Update key state
          keyStates[kbInfo.event.key.toLowerCase()] = true;
          
          // Handle movement keys with simultaneous press support
          if (this.meshAggregate) {
            let impulse = new Vector3(0, 0, 0);
            
            // Check all movement keys and combine their impulses
            if (keyStates['a']) {
              impulse.addInPlace(new Vector3(1, 0, 0));
            }
            if (keyStates['d']) {
              impulse.addInPlace(new Vector3(-1, 0, 0));
            }
            if (keyStates['w']) {
              impulse.addInPlace(new Vector3(0, 0, -1));
            }
            if (keyStates['s']) {
              impulse.addInPlace(new Vector3(0, 0, 1));
            }
            
            // Apply combined impulse if any movement keys are pressed
            if (!impulse.equals(Vector3.Zero())) {
              this.meshAggregate.body.applyImpulse(impulse, this.mesh!.position);
            }
          }
          
          // Handle single-press interaction controls
          switch (kbInfo.event.key) {
            case "f":
            case "F":
              this.feed();
            break
            case "t":
            case "T":
              this.toilet();
            break
            case "p":
            case "P":
              this.play();
            break
            case "z":
            case "Z":
              this.sleep();
            break
            case " ":
              // Jump movement on spacebar
              if (this.meshAggregate) {
                this.meshAggregate.body.applyImpulse(new Vector3(0, 4, 0), this.mesh!.position);
              }
            break
          }
        break;
        
        case KeyboardEventTypes.KEYUP:
          // Update key state when key is released
          keyStates[kbInfo.event.key.toLowerCase()] = false;
        break;
      }
    });
  }

  private _startDemoTimeout(): void {
    // Set up demo timeout to disable pet thinking after the specified time
    setTimeout(() => {
      console.log(`${this.name}: Demo timeout reached (${this.demoTimeoutMs}ms), disabling pet thinking`);
      this._clearAllIntervals();
    }, this.demoTimeoutMs);
  }

  // Cleanup method
  public dispose(): void {
    // Clear all intervals
    this._clearAllIntervals();
    
    // Clear speech timeout
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
    }
    
    if (this.mesh) {
      this.mesh.dispose();
    }
    if (this.meshAggregate) {
      this.meshAggregate.dispose();
    }
    if (this.shadowMesh) {
      this.shadowMesh.dispose();
    }
    if (this.speechBubble) {
      this.speechBubble.dispose();
    }
    
    // Remove status display
    const statusDiv = document.getElementById("pet-status");
    if (statusDiv) {
      statusDiv.remove();
    }
  }
}