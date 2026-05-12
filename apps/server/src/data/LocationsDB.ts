import { Speed } from "../../../shared/types";
import { Vector3 } from "../../../shared/Libs/yuka-min";

let LocationsDB = {
    lh_town: {
        title: "Bunny World",
        key: "lh_town",
        mesh: "lh_town",
        procedural: true, // skip mesh loading; client renders a flat ground plane instead
        sun: true,
        sunIntensity: 0.8,
        spawnPoint: { x: 0, y: 0, z: 0, rot: 0 },
        waterPlane: false,
        skyColor: [0.53, 0.81, 0.92, 1],
        fog: false,
        music: "MUSIC_01",
        worldobjects: [
            { key: "bowl_01",   subtype: "bowl",   name: "Bowl",   x:  8, y: 0, z:  0 },
            { key: "bed_01",    subtype: "bed",    name: "Bed",    x: -8, y: 0, z: -8 },
            { key: "toy_01",    subtype: "toy",    name: "Toy",    x:  0, y: 0, z:  8 },
            { key: "toilet_01", subtype: "toilet", name: "Toilet", x:  8, y: 0, z:  8 },
        ],
        dynamic: {
            interactive: [],
            spawns: [
                {
                    key: "bunny",
                    type: "area",
                    behaviour: "patrol",
                    aggressive: false,
                    canAttack: false,
                    points: [
                        new Vector3(4, 0.06, 4),
                        new Vector3(-4, 0.06, 4),
                        new Vector3(-4, 0.06, -4),
                        new Vector3(4, 0.06, -4),
                    ],
                    amount: 1,
                    race: "humanoid", // placeholder until bunny mesh is ready
                    material: 4,
                    head: "Head_Base",
                    name: "Bunny",
                    baseSpeed: Speed.VERY_SLOW,
                    interactable: {
                        title: "Talk",
                        data: [
                            {
                                type: "text",
                                text: "...*sniffs the air and blinks at you*...",
                                isEndOfDialog: true,
                            },
                        ],
                    },
                },
            ],
        },
    },
};

export { LocationsDB };
