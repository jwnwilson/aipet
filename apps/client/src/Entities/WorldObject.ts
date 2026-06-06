import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { GameController } from "../Controllers/GameController";

// Maps the server-side subtype to the AssetsController asset key.
// "bowl" uses the "food" model (a food dish); all others match their folder name.
export const SUBTYPE_TO_MODEL: Record<string, string> = {
    bowl:   "OBJECT_food",
    bed:    "OBJECT_bed",
    toy:    "OBJECT_toy",
    toilet: "OBJECT_toilet",
};

// Uniform scale applied to each instantiated model root node.
// Tune these after visual inspection in Task 5.
export const SUBTYPE_SCALE: Record<string, number> = {
    bowl:   1.0,
    bed:    1.0,
    toy:    1.0,
    toilet: 1.0,
};

const SUBTYPE_LABEL_HEIGHT: Record<string, number> = {
    bowl:   0.8,
    bed:    1.5,
    toy:    0.8,
    toilet: 1.2,
};

// Fallback colors used when the GLTF container is not yet in _loadedAssets
const SUBTYPE_COLORS: Record<string, Color3> = {
    bowl:   new Color3(0.2, 0.4, 0.9),
    bed:    new Color3(0.55, 0.27, 0.07),
    toy:    new Color3(0.95, 0.85, 0.1),
    toilet: new Color3(0.9, 0.9, 0.9),
};

export class WorldObject extends TransformNode {
    public _game: GameController;
    public _scene: Scene;
    public entity: any;
    public sessionId: string;
    public mesh: Mesh;
    public type: string = "worldobject";

    public x: number;
    public y: number;
    public z: number;

    constructor(name: string, scene: Scene, entity: any, game: GameController) {
        super(name, scene);
        this._scene = scene;
        this._game = game;
        this.entity = entity;
        this.sessionId = entity.sessionId;

        Object.assign(this, entity);
        this._spawn();
    }

    private _spawn() {
        const subtype: string = this.entity.subtype ?? "toy";
        const modelKey = SUBTYPE_TO_MODEL[subtype];
        const container = modelKey ? this._game._loadedAssets[modelKey] : null;

        if (container) {
            const result = container.instantiateModelsToScene(
                (name: string) => `${name}_${this.sessionId}`
            );
            const root = result.rootNodes[0] as TransformNode;
            if (root) {
                root.parent = this;
                root.position.setAll(0);
                root.scaling.setAll(SUBTYPE_SCALE[subtype] ?? 1.0);
                for (const m of root.getChildMeshes(false)) {
                    m.isPickable = false;
                }
                const childMeshes = root.getChildMeshes(false);
                if (childMeshes.length > 0) {
                    this.mesh = childMeshes[0] as Mesh;
                }
            }
        } else {
            // fallback: colored cube
            const color = SUBTYPE_COLORS[subtype] ?? Color3.Gray();
            this.mesh = MeshBuilder.CreateBox(`worldobj_${this.sessionId}`, { size: 0.6 }, this._scene);
            this.mesh.parent = this;
            this.mesh.position.y = 0.3;
            this.mesh.isPickable = false;
            const mat = new StandardMaterial(`worldobj_mat_${this.sessionId}`, this._scene);
            mat.diffuseColor = color;
            mat.specularColor = Color3.Black();
            this.mesh.material = mat;
        }

        const labelHeight = SUBTYPE_LABEL_HEIGHT[subtype] ?? 1.0;
        this._addLabel(this.entity.name ?? subtype, labelHeight);
        this.setPosition();

        this.entity.onChange(() => {
            Object.assign(this, this.entity);
            this.setPosition();
        });
    }

    private _addLabel(text: string, yOffset: number = 1.0) {
        const fontSize = 48;
        const font = `bold ${fontSize}px Arial`;

        const tmp = new DynamicTexture("_tmp_measure", 64, this._scene);
        const ctx = tmp.getContext();
        ctx.font = font;
        const textWidth = ctx.measureText(text).width + 16;
        tmp.dispose();

        const texHeight = fontSize * 1.5;
        const planeHeight = 0.35;
        const planeWidth = textWidth * (planeHeight / texHeight);

        const texture = new DynamicTexture(`worldobj_tex_${this.sessionId}`, { width: textWidth, height: texHeight }, this._scene);
        texture.drawText(text, null, null, font, "#FFFFFF", "transparent", true);

        const mat = new StandardMaterial(`worldobj_label_mat_${this.sessionId}`, this._scene);
        mat.diffuseTexture = texture;
        mat.opacityTexture = texture;
        mat.disableLighting = true;
        mat.emissiveColor = Color3.White();

        const plane = MeshBuilder.CreatePlane(
            `worldobj_label_${this.sessionId}`,
            { width: planeWidth, height: planeHeight, sideOrientation: Mesh.DOUBLESIDE },
            this._scene,
        );
        plane.parent = this;
        plane.position.y = yOffset;
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        plane.material = mat;
        plane.isPickable = false;
    }

    public update(_delta: number) {}
    public updateServerRate(_delta: number) {}
    public updateSlowRate(_delta: number) {}

    public lod(_currentPlayer: any) {}

    public setPosition() {
        this.position = this.getPosition();
    }

    public getPosition() {
        return new Vector3(this.x, this.y, this.z);
    }

    public remove() {
        this.dispose();
    }
}
