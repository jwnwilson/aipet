import { SUBTYPE_TO_MODEL, SUBTYPE_SCALE } from "./WorldObject";

describe("SUBTYPE_TO_MODEL", () => {
    const LOCATION_SUBTYPES = ["bowl", "bed", "toy", "toilet"];

    it("has an entry for every subtype used in LocationsDB", () => {
        for (const subtype of LOCATION_SUBTYPES) {
            expect(SUBTYPE_TO_MODEL[subtype]).toBeDefined();
        }
    });

    it("maps bowl to the food model asset key", () => {
        expect(SUBTYPE_TO_MODEL["bowl"]).toBe("OBJECT_food");
    });

    it("maps bed, toy, toilet to their own asset keys", () => {
        expect(SUBTYPE_TO_MODEL["bed"]).toBe("OBJECT_bed");
        expect(SUBTYPE_TO_MODEL["toy"]).toBe("OBJECT_toy");
        expect(SUBTYPE_TO_MODEL["toilet"]).toBe("OBJECT_toilet");
    });
});

describe("SUBTYPE_SCALE", () => {
    it("provides a positive scale for every mapped subtype", () => {
        for (const subtype of Object.keys(SUBTYPE_TO_MODEL)) {
            expect(typeof SUBTYPE_SCALE[subtype]).toBe("number");
            expect(SUBTYPE_SCALE[subtype]).toBeGreaterThan(0);
        }
    });
});
