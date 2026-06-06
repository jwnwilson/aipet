import { Schema, type } from "@colyseus/schema";

export class PetStatsSchema extends Schema {
    @type("float32") hunger: number = 0;
    @type("float32") boredom: number = 0;
    @type("float32") social: number = 0;
    @type("float32") toilet: number = 0;
    @type("float32") tiredness: number = 0;
}
