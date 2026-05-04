import { type } from "@colyseus/schema";
import { Entity } from "./Entity";
import { Vector3 } from "../../../../shared/Libs/yuka-min";

export class WorldObjectSchema extends Entity {
    @type("string") public type: string = "worldobject";
    @type("string") public subtype: string = "";
    @type("string") public name: string = "";
    @type("number") public x: number = 0;
    @type("number") public y: number = 0;
    @type("number") public z: number = 0;
    @type("number") public rot: number = 0;

    constructor(data: any, ...args: any[]) {
        super();
        Object.assign(this, data);
    }

    public update(_delta: number) {}

    getPosition() {
        return new Vector3(this.x, this.y, this.z);
    }
}
