import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITE_DIR = join(__dirname, '../public/sprites/bunny');
const OUTPUT_PNG = join(SPRITE_DIR, 'atlas.png');
const OUTPUT_JSON = join(SPRITE_DIR, 'atlas.json');

const FRAME_SIZE = 84;
const DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const COLS = 8;

const STATES = [
  { name: 'idle',  folder: '5288946c', animKey: 'animation-eb4ae751',             frameCount: 8 },
  { name: 'walk',  folder: 'walking',  animKey: 'animation-85860275',             frameCount: 4 },
  { name: 'jump',  folder: 'jumping',  animKey: 'hopping_like_a_rabbit-ed56bfbf', frameCount: 5 },
];

const ROWS = STATES.length * DIRECTIONS.length; // 24

const composites = [];
const layout = {};

let row = 0;
for (const state of STATES) {
  layout[state.name] = {};
  for (const dir of DIRECTIONS) {
    const startCell = row * COLS;
    layout[state.name][dir] = { startCell, frameCount: state.frameCount };
    for (let f = 0; f < state.frameCount; f++) {
      const framePath = join(
        SPRITE_DIR,
        state.folder,
        'animations',
        state.animKey,
        dir,
        `frame_${String(f).padStart(3, '0')}.png`
      );
      composites.push({ input: framePath, left: f * FRAME_SIZE, top: row * FRAME_SIZE });
    }
    row++;
  }
}

await sharp({
  create: {
    width: COLS * FRAME_SIZE,
    height: ROWS * FRAME_SIZE,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png()
  .toFile(OUTPUT_PNG);

const descriptor = { frameSize: FRAME_SIZE, cols: COLS, rows: ROWS, layout };
writeFileSync(OUTPUT_JSON, JSON.stringify(descriptor, null, 2));

console.log(`Atlas built: ${COLS * FRAME_SIZE}×${ROWS * FRAME_SIZE}px → ${OUTPUT_PNG}`);
console.log(`Descriptor  → ${OUTPUT_JSON}`);
