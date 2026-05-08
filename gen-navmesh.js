// Generates a flat 200x200 navmesh GLB for aipet world.
// Replaces lh_town.glb which was the original MMORPG town navmesh.
const fs = require("fs");
const path = require("path");

const HALF = 100; // 200x200 plane

// Four corners of the flat plane at y=0
const positions = new Float32Array([
    -HALF, 0, -HALF, //  v0 back-left
     HALF, 0, -HALF, //  v1 back-right
     HALF, 0,  HALF, //  v2 front-right
    -HALF, 0,  HALF, //  v3 front-left
]);

// Two triangles, CCW winding from Y+ so plane normal = (0,1,0)
// [0,2,1] and [0,3,2] give upward normals; [0,1,2] was CW-from-above (normal down) which broke clampMovementV2
const indices = new Uint16Array([0, 2, 1, 0, 3, 2]);

const posByteLen = positions.byteLength; // 48
const idxByteLen = indices.byteLength;   // 12
// pad total binary to 4-byte boundary (48+12=60, already aligned)
const binByteLen = Math.ceil((posByteLen + idxByteLen) / 4) * 4;

const bin = Buffer.alloc(binByteLen, 0);
Buffer.from(positions.buffer).copy(bin, 0);
Buffer.from(indices.buffer).copy(bin, posByteLen);

const gltf = {
    asset: { version: "2.0", generator: "aipet-navmesh-gen" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "Navmesh" }],
    meshes: [{
        name: "Navmesh",
        primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }],
    }],
    accessors: [
        {
            bufferView: 0,
            componentType: 5126, // FLOAT
            count: 4,
            type: "VEC3",
            min: [-HALF, 0, -HALF],
            max: [ HALF, 0,  HALF],
        },
        {
            bufferView: 1,
            componentType: 5123, // UNSIGNED_SHORT
            count: 6,
            type: "SCALAR",
        },
    ],
    bufferViews: [
        { buffer: 0, byteOffset: 0,          byteLength: posByteLen, target: 34962 },
        { buffer: 0, byteOffset: posByteLen, byteLength: idxByteLen, target: 34963 },
    ],
    buffers: [{ byteLength: binByteLen }],
};

const jsonStr = JSON.stringify(gltf);
const jsonPaddedLen = Math.ceil(jsonStr.length / 4) * 4;
const jsonBuf = Buffer.alloc(jsonPaddedLen, 0x20); // pad with spaces
Buffer.from(jsonStr, "utf8").copy(jsonBuf);

const totalLen = 12 + 8 + jsonPaddedLen + 8 + binByteLen;
const glb = Buffer.alloc(totalLen, 0);
let o = 0;

// Header
glb.writeUInt32LE(0x46546C67, o); o += 4; // magic "glTF"
glb.writeUInt32LE(2,           o); o += 4; // version 2
glb.writeUInt32LE(totalLen,    o); o += 4; // total length

// JSON chunk
glb.writeUInt32LE(jsonPaddedLen, o); o += 4;
glb.writeUInt32LE(0x4E4F534A,   o); o += 4; // "JSON"
jsonBuf.copy(glb, o); o += jsonPaddedLen;

// BIN chunk
glb.writeUInt32LE(binByteLen,  o); o += 4;
glb.writeUInt32LE(0x004E4942, o); o += 4; // "BIN\0"
bin.copy(glb, o);

const out = path.join(__dirname, "apps/client/public/models/navmesh/lh_town.glb");
fs.writeFileSync(out, glb);
console.log(`Written: ${out}  (${totalLen} bytes, 2 triangles covering ${HALF*2}x${HALF*2} units)`);
