/**
 * How the bunny's sprite atlas reaches Babylon.
 *
 * On Chrome for Android with an ANGLE/Vulkan backend (seen on a Samsung Xclipse
 * 940), the bunny sprite did not render while the meadow grass — drawn by the same
 * Babylon SpriteManager one frame later — did. The two differed in exactly two
 * ways, and both had to change before bunny and grass would render together:
 *
 *   - the grass builds its texture in-page as a canvas data URL, the bunny pointed
 *     the manager at a network URL
 *   - the grass allocates a manager with hundreds of slots, the bunny used one
 *
 * Allocating capacity alone made the bunny appear but stopped the grass rendering;
 * only both together restored both. The defaults below therefore match the grass,
 * and the flags exist to reproduce the old behaviour when investigating further:
 *
 *   ?bunnycanvas=0  point the manager at the network URL again
 *   ?bunnycap=N     allocate N slots instead of the default
 */
export interface SpriteFlagOptions {
  useCanvasAtlas: boolean;
  managerCapacity: number;
}

const MAX_CAPACITY = 1024;

export const DEFAULT_SPRITE_OPTIONS: SpriteFlagOptions = {
  useCanvasAtlas: true,
  managerCapacity: 64,
};

function readFlag(params: URLSearchParams, name: string, fallback: boolean): boolean {
  const value = params.get(name);
  if (value === null) return fallback;
  return value !== '0' && value.toLowerCase() !== 'false';
}

function readCapacity(params: URLSearchParams): number {
  const raw = params.get('bunnycap');
  if (raw === null) return DEFAULT_SPRITE_OPTIONS.managerCapacity;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_SPRITE_OPTIONS.managerCapacity;
  return Math.min(parsed, MAX_CAPACITY);
}

export function spriteOptionsFromQuery(search: string): SpriteFlagOptions {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  return {
    useCanvasAtlas: readFlag(params, 'bunnycanvas', DEFAULT_SPRITE_OPTIONS.useCanvasAtlas),
    managerCapacity: readCapacity(params),
  };
}

export function describeSpriteOptions(options: SpriteFlagOptions): string {
  const overrides: string[] = [];
  if (!options.useCanvasAtlas) overrides.push('network atlas');
  if (options.managerCapacity !== DEFAULT_SPRITE_OPTIONS.managerCapacity) {
    overrides.push(`capacity ${options.managerCapacity}`);
  }
  return overrides.length ? overrides.join(', ') : 'defaults';
}
