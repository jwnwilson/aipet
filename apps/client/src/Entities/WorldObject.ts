import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { GameController } from "../Controllers/GameController";

const SUBTYPE_COLORS: Record<string, Color3> = {
    bowl:   new Color3(0.2, 0.4, 0.9),   // blue
    bed:    new Color3(0.55, 0.27, 0.07), // brown
    toy:    new Color3(0.95, 0.85, 0.1),  // yellow
    toilet: new Color3(0.9, 0.9, 0.9),   // white
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
        const color = SUBTYPE_COLORS[subtype] ?? Color3.Gray();

        // box mesh
        this.mesh = MeshBuilder.CreateBox(`worldobj_${this.sessionId}`, { size: 0.6 }, this._scene);
        this.mesh.parent = this;
        this.mesh.position.y = 0.3;
        this.mesh.isPickable = false;

        const mat = new StandardMaterial(`worldobj_mat_${this.sessionId}`, this._scene);
        mat.diffuseColor = color;
        mat.specularColor = Color3.Black();
        this.mesh.material = mat;

        // billboard label
        this._addLabel(this.entity.name ?? subtype);

        // position
        this.setPosition();

        // listen for server changes
        this.entity.onChange(() => {
            Object.assign(this, this.entity);
            this.setPosition();
        });
    }

    private _addLabel(text: string) {
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
        plane.position.y = 1.0;
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
