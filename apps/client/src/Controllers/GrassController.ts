import { Scene } from '@babylonjs/core/scene';
import { SpriteManager } from '@babylonjs/core/Sprites/spriteManager';
import { Sprite } from '@babylonjs/core/Sprites/sprite';

const CELL_SIZE = 64;
const NUM_VARIANTS = 4;
const SPRITE_HEIGHT = 1.2;
const EXCLUSION_RADIUS = 6;

// [dark, mid, light] per variant
const BLADE_PALETTES: [string, string, string][] = [
    ['#2a5218', '#3d7825', '#5a9e38'],
    ['#3b6e1e', '#56a02c', '#72c040'],
    ['#1e4d15', '#2d6b1e', '#4a8c2e'],
    ['#4a6e1e', '#6e9c2e', '#90c050'],
];

export class GrassController {
    private _manager: SpriteManager | null = null;
    private _sprites: Sprite[] = [];

    constructor(private readonly _scene: Scene) {}

    private _drawBlade(
        ctx: CanvasRenderingContext2D,
        x: number,
        baseY: number,
        height: number,
        lean: number,
        width: number,
        color: string
    ): void {
        ctx.beginPath();
        ctx.moveTo(x - width, baseY);
        ctx.quadraticCurveTo(x + lean * 0.4, baseY - height * 0.6, x + lean, baseY - height);
        ctx.quadraticCurveTo(x + lean * 0.4 + width, baseY - height * 0.6, x + width, baseY);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    private _drawVariant(ctx: CanvasRenderingContext2D, ox: number, variant: number): void {
        const palette = BLADE_PALETTES[variant];
        const bladeCount = 3 + (variant % 2);
        const maxHeight = 28 + variant * 5;

        for (let b = 0; b < bladeCount; b++) {
            const frac = bladeCount === 1 ? 0.5 : b / (bladeCount - 1);
            const bx = ox + 10 + frac * (CELL_SIZE - 20);
            const bh = maxHeight * (0.7 + 0.3 * Math.sin(b * 2.3 + variant * 0.7));
            const lean = (frac - 0.5) * 10;
            const bw = Math.max(1, 2.5 - b * 0.2);
            this._drawBlade(ctx, bx, CELL_SIZE - 2, bh, lean, bw, palette[b % palette.length]);
        }

        if (variant === 3) {
            const fx = ox + CELL_SIZE / 2 + 4;
            const fy = CELL_SIZE - maxHeight - 4;
            for (let p = 0; p < 5; p++) {
                const angle = (p / 5) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(fx + Math.cos(angle) * 4, fy + Math.sin(angle) * 4, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#e8b0f0';
                ctx.fill();
            }
            ctx.beginPath();
            ctx.arc(fx, fy, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#f5e060';
            ctx.fill();
        }
    }

    spawn(groundSize: number, count: number): void {
        const canvas = document.createElement('canvas');
        canvas.width = CELL_SIZE * NUM_VARIANTS;
        canvas.height = CELL_SIZE;
        const ctx = canvas.getContext('2d')!;

        for (let i = 0; i < NUM_VARIANTS; i++) {
            this._drawVariant(ctx, i * CELL_SIZE, i);
        }

        const dataUrl = canvas.toDataURL('image/png');

        this._manager = new SpriteManager(
            'grassManager',
            dataUrl,
            count,
            { width: CELL_SIZE, height: CELL_SIZE },
            this._scene
        );
        this._manager.isPickable = false;

        let spawned = 0;
        let attempts = 0;

        while (spawned < count && attempts < count * 3) {
            attempts++;
            const x = (Math.random() - 0.5) * groundSize;
            const z = (Math.random() - 0.5) * groundSize;

            if (x * x + z * z < EXCLUSION_RADIUS * EXCLUSION_RADIUS) continue;

            const sprite = new Sprite(`grass_${spawned}`, this._manager);
            sprite.cellIndex = Math.floor(Math.random() * NUM_VARIANTS);
            const scale = 0.8 + Math.random() * 0.6;
            sprite.width = SPRITE_HEIGHT * scale;
            sprite.height = SPRITE_HEIGHT * scale;
            sprite.position.set(x, (SPRITE_HEIGHT * scale) / 2, z);
            sprite.isPickable = false;

            this._sprites.push(sprite);
            spawned++;
        }
    }

    dispose(): void {
        for (const s of this._sprites) s.dispose();
        this._sprites = [];
        this._manager?.dispose();
        this._manager = null;
    }
}
