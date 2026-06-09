import { ICanvasRenderingContext } from "@babylonjs/core/Engines/ICanvas";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { generateRandomId, randomNumberInRange } from "../../../../shared/Utils";
import { Entity } from "../Entity";
import { Item } from "../Item";

export class EntityNamePlate {
    private _scene: Scene;
    private _entity: Entity | Item;
    private damageBubbles: any = [];
    private font_size = 50;
    private font = "bold 50px gamefont";

    private readonly BUBBLE_PAD_X = 24;
    private readonly BUBBLE_PAD_Y = 16;
    private readonly BUBBLE_TAIL  = 22;
    private readonly BUBBLE_RADIUS = 14;

    private currentMessage;
    private messageTimeout;

    private planeMesh;
    private planeTexture;

    constructor(entity: Entity | Item) {
        this._scene = entity._scene;
        this._entity = entity;
    }

    ////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////
    /////////////////////////    HELPERS           //////////////////////////
    /////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////

    /**
     * Returns the width of a dynamic texture for the provided text
     * @param text
     * @returns
     */
    getWidthForDynamicTexture(text: string): number {
        var temp = new DynamicTexture("TempDamageTexture", 64, this._scene);
        var tmpctx = temp.getContext();
        tmpctx.font = this.font;
        var DTWidth = tmpctx.measureText(text).width + 8;
        temp.dispose();
        return DTWidth;
    }

    /**
     * Create a material with a dynamic texture the size of the provided text
     * @param height =
     * @param t_height
     * @param text
     * @returns
     */
    createMaterial(height = 0.5, t_height = 2, text = "Hello World", scale = 1, extraWidth = 0, extraHeight = 0) {
        // set a few vars
        let uuid = generateRandomId(6);
        var planeHeight = height; //Set height for plane
        var DTHeight = t_height * this.font_size + extraHeight; //Set height for dynamic texture
        var ratio = planeHeight / DTHeight; //Calculate ratio
        var text = "" + text; //Set text

        //Use a temporay dynamic texture to calculate the length of the text on the dynamic texture canvas
        var DTWidth = this.getWidthForDynamicTexture(text) + extraWidth;

        //Calculate width the plane has to be
        var planeWidth = DTWidth * ratio;

        // scale to mesh
        // not needed anymore as player mesh is independant
        /*
        if (scale < 1) {
            planeWidth = planeWidth * (1 / scale);
            planeHeight = planeHeight * (1 / scale);
        } else if (scale > 1) {
            planeWidth = planeWidth / scale;
            planeHeight = planeHeight / scale;
        }*/

        //Create dynamic texture and write the text
        var texture = new DynamicTexture("UI_Nameplate_Txt_" + uuid, { width: DTWidth, height: DTHeight }, this._scene);

        // create material
        var material = new StandardMaterial("UI_Nameplate_Mat_" + uuid, this._scene);
        material.diffuseTexture = texture;
        material.opacityTexture = texture;
        material.disableLighting = true; // dont let lighting affect the mesh
        material.emissiveColor = Color3.White(); // material to be fully "lit"

        return {
            uuid,
            planeWidth,
            planeHeight,
            texture,
            material,
        };
    }

    /**
     * Draw on dynamic texture
     * @param text
     * @param texture
     * @param color
     */
    drawDynamicTexture(text, texture, color = "#FFFFFF") {
        texture.drawText(text, null, null, this.font, color, "transparent", true);
    }

    private _drawSpeechBubble(ctx: ICanvasRenderingContext, w: number, h: number) {
        const bodyH = h - this.BUBBLE_TAIL;
        const r     = this.BUBBLE_RADIUS;
        const tailX = w / 2;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, bodyH - r);
        ctx.quadraticCurveTo(w, bodyH, w - r, bodyH);
        ctx.lineTo(tailX + this.BUBBLE_TAIL, bodyH);
        ctx.lineTo(tailX, h);
        ctx.lineTo(tailX - this.BUBBLE_TAIL, bodyH);
        ctx.lineTo(r, bodyH);
        ctx.quadraticCurveTo(0, bodyH, 0, bodyH - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.fill();
    }

    getEntityheight(offset_y) {
        if(!this._entity.mesh){
            return 1;
        }
        let extendSize = this._entity.mesh.getBoundingInfo().boundingBox.extendSize.y ?? 1;
        return extendSize * 2 + offset_y;
    }

    /////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////
    ///////////////////////// METHODS //////////////////////////////
    /////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////

    /**
     * Draw chat above entity
     * @param entity
     * @param offset_y
     * @returns
     */
    private _wrapText(text: string, maxCharsPerLine: number = 22): string[] {
        const words = text.split(" ");
        const lines: string[] = [];
        let currentLine = "";
        for (const word of words) {
            const test = currentLine ? currentLine + " " + word : word;
            if (test.length <= maxCharsPerLine) {
                currentLine = test;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines.length > 0 ? lines : [text];
    }

    addChatMessage(message = "Hello World!", offset_y = 1.5, color = "blue") {
        // clear any existing message
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
            this.currentMessage.texture.dispose();
            this.currentMessage.material.dispose();
            this.currentMessage.plane.dispose();
        }

        const lines = this._wrapText(message);
        const numLines = lines.length;
        const longestLine = lines.reduce((a, b) => (a.length > b.length ? a : b), "");

        // create mesh + texture sized for all lines plus speech-bubble padding
        const extraW = 2 * this.BUBBLE_PAD_X;
        const extraH = 2 * this.BUBBLE_PAD_Y + this.BUBBLE_TAIL;
        const textDTHeight = numLines * this.font_size;
        const totalDTHeight = textDTHeight + extraH;
        const scaledPlaneHeight = 0.4 * numLines * (totalDTHeight / textDTHeight);
        let entity_height = this.getEntityheight(offset_y);
        let { planeWidth, planeHeight, texture, material } = this.createMaterial(scaledPlaneHeight, numLines, longestLine, this._entity.scale, extraW, extraH);

        const size = texture.getSize();
        const ctx  = texture.getContext();
        ctx.font   = this.font;

        // draw white rounded-rect bubble with downward tail, then text on top
        this._drawSpeechBubble(ctx, size.width, size.height);
        ctx.fillStyle = color;
        const lineHeight = (size.height - this.BUBBLE_TAIL - 2 * this.BUBBLE_PAD_Y) / numLines;
        lines.forEach((line, i) => {
            ctx.fillText(line, this.BUBBLE_PAD_X, this.BUBBLE_PAD_Y + (i + 0.85) * lineHeight);
        });
        texture.update();

        var plane = MeshBuilder.CreatePlane(
            "chatMessage_" + this._entity.name,
            { width: planeWidth, height: planeHeight, sideOrientation: Mesh.DOUBLESIDE },
            this._scene
        );
        plane.parent = this._entity;
        plane.position.y = plane.position.y + entity_height;
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        plane.material = material;

        // set as actual message
        this.currentMessage = {
            plane: plane,
            material: material,
            texture: texture,
        };

        this.messageTimeout = setTimeout(() => {
            texture.dispose();
            material.dispose();
            plane.dispose();
        }, 7000);
    }

    /**
     * Draw nameplate above entity
     * @param entity
     * @param offset_y
     * @returns
     */
    addNamePlate(offset_y = 0.5) {
        let text = this._entity.name;
        let entity_height = this.getEntityheight(offset_y);
        let height = 0.4;
        let t_height = 1.4;

        /*
        let mesh = this._entity._game._loadedAssets["DYNAMIC_name_plate"].createInstance("rawNameplate_" + this._entity.name);
        mesh.position.y = mesh.position.y + entity_height;
        mesh.parent = this._entity;*/

        // if entity is a spawn, we can use instances as they all have the same name.
        if (this._entity.spawnInfo) {
            let spawnKey = this._entity.spawnInfo.key;
            let instancekey = "nameplate_" + spawnKey;

            // if raw mesh does not exists, create it
            if (!this._entity._game.instances.get(instancekey)) {
                // create raw mesh
                let { planeWidth, planeHeight, texture, material } = this.createMaterial(height, t_height, text, this._entity.scale);
                var plane = MeshBuilder.CreatePlane(
                    "RawNamePlate_" + spawnKey,
                    { width: planeWidth, height: planeHeight, sideOrientation: Mesh.FRONTSIDE },
                    this._scene
                );
                plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
                plane.material = material;
                plane.setEnabled(false); // hide raw mesh

                // draw text
                this.drawDynamicTexture(text, texture);

                // save raw mesh for later use
                this._entity._game.instances.set(instancekey, plane);
            }

            // get raw mesh
            let rawMesh = this._entity._game.instances.get(instancekey);

            // create instance
            let uuid = generateRandomId(6);
            let instance = rawMesh.createInstance("namePlate_" + spawnKey + "_" + uuid);
            instance.parent = this._entity;
            instance.position.y = instance.position.y + entity_height;

            // don't continue
            return instance;
        }

        // else we create a unique mesh
        // todo: probably can do something better here
        let { planeWidth, planeHeight, texture, material } = this.createMaterial(height, t_height, text, this._entity.scale);
        var plane = MeshBuilder.CreatePlane(
            "namePlate_" + this._entity.name,
            { width: planeWidth, height: planeHeight, sideOrientation: Mesh.FRONTSIDE },
            this._scene
        );
        plane.parent = this._entity;
        plane.position.y = plane.position.y + entity_height;
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        plane.material = material;

        // draw text
        this.drawDynamicTexture(text, texture);

        return plane;
    }

    /**
     * Draw damage bubble above entity
     * TODO: add instances to improve performance
     * @param entity
     */
    addDamageBubble(offset_y = 0.2, ping = 0) {
        // only proceed if damage has occured
        let healthChange = this._entity.entity.health - this._entity.health;
        if (healthChange === 0 || healthChange === 1) {
            return false;
        }

        let text = "" + healthChange;
        let color = healthChange > 0 ? Color3.Green().toHexString() : Color3.Yellow().toHexString(); // set current color
        let { planeWidth, planeHeight, texture, material } = this.createMaterial(0.4, 1, text);
        let entity_height = this.getEntityheight(offset_y);

        // create plane
        let uuid = generateRandomId(6);
        var plane = MeshBuilder.CreatePlane("damageBubble_" + uuid, { width: planeWidth, height: planeHeight, sideOrientation: Mesh.DOUBLESIDE }, this._scene);
        plane.parent = this._entity;
        plane.position.y = plane.position.y + entity_height;
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        plane.material = material;

        // draw text
        this.drawDynamicTexture(text, texture, color);

        // set meta
        plane.metadata = {
            ping: ping,
            delta: 0,
            end_position: this._entity.position.y + 6,
            material: material,
            texture: texture,
            offset: randomNumberInRange(-0.002, 0.002),
        };

        plane.isVisible = false;

        // add to damage bubbles array
        this.damageBubbles.push(plane);
    }

    /**
     * Update Loop
     */
    update() {
        // update damage bubbles
        if (this.damageBubbles.length > 0) {
            // loop through damage bubbles and update them
            for (let i = 0; i < this.damageBubbles.length; i++) {
                let metadata = this.damageBubbles[i].metadata;

                // delay nameplate for the duration of the player ping
                metadata.delta += 15;
                if (metadata.delta < metadata.ping) {
                    continue;
                } else {
                    this.damageBubbles[i].isVisible = true;
                }

                this.damageBubbles[i].position.y += 0.02;
                this.damageBubbles[i].position.z += metadata.offset;
                this.damageBubbles[i].position.x += metadata.offset;
                this.damageBubbles[i].visibility -= 0.01;

                // if higher than end position, remove
                if (this.damageBubbles[i].position.y > this.damageBubbles[i].metadata.end_position) {
                    // dispose texture
                    if (this.damageBubbles[i].metadata.material) {
                        this.damageBubbles[i].metadata.material.dispose();
                    }

                    // dispose material
                    if (this.damageBubbles[i].metadata.texture) {
                        this.damageBubbles[i].metadata.texture.dispose();
                    }

                    // dispose mesh
                    this.damageBubbles[i].dispose();
                    this.damageBubbles.splice(i, 1);
                    i--;
                }
            }
        }
    }
}
