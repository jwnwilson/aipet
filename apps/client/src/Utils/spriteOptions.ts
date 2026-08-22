/**
 * Bunny sprite options that can be overridden from the URL.
 *
 * The meadow grass renders correctly on devices where the bunny does not, and the
 * two differ in only a couple of ways: the grass builds its texture in-page as a
 * canvas data URL and allocates a large sprite manager, while the bunny points the
 * manager at a network URL with a capacity of one. These flags make the bunny
 * behave like the grass so the difference can be tested on a real device.
 *
 *   ?bunnycanvas=1  draw the atlas into a canvas and use that, as the grass does
 *   ?bunnycap=N     allocate the sprite manager with capacity N instead of 1
 */
export interface SpriteFlagOptions {
  useCanvasAtlas: boolean;
  managerCapacity: number;
}

const MAX_CAPACITY = 1024;

export const DEFAULT_SPRITE_OPTIONS: SpriteFlagOptions = {
  useCanvasAtlas: false,
  managerCapacity: 1,
};

function isFlagSet(params: URLSearchParams, name: string): boolean {
  const value = params.get(name);
  if (value === null) return false;
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
    useCanvasAtlas: isFlagSet(params, 'bunnycanvas'),
    managerCapacity: readCapacity(params),
  };
}

export function describeSpriteOptions(options: SpriteFlagOptions): string {
  const overrides: string[] = [];
  if (options.useCanvasAtlas) overrides.push('atlas via canvas');
  if (options.managerCapacity !== DEFAULT_SPRITE_OPTIONS.managerCapacity) {
    overrides.push(`capacity ${options.managerCapacity}`);
  }
  return overrides.length ? overrides.join(', ') : 'defaults';
}
