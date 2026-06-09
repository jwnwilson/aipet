import { directionFromAngle, BunnySpriteRenderer } from './BunnySpriteRenderer';

describe('directionFromAngle', () => {
  it('returns south for angle 0', () => {
    expect(directionFromAngle(0)).toBe('south');
  });

  it('returns north for angle π', () => {
    expect(directionFromAngle(Math.PI)).toBe('north');
  });

  it('returns east for angle 3π/2', () => {
    expect(directionFromAngle((3 * Math.PI) / 2)).toBe('east');
  });

  it('returns west for angle π/2', () => {
    expect(directionFromAngle(Math.PI / 2)).toBe('west');
  });

  it('returns south-east for angle 7π/4', () => {
    expect(directionFromAngle((7 * Math.PI) / 4)).toBe('south-east');
  });

  it('handles negative angles correctly', () => {
    expect(directionFromAngle(-Math.PI / 2)).toBe('east');
  });

  it('handles angles above 2π correctly', () => {
    expect(directionFromAngle(2 * Math.PI)).toBe('south');
  });
});

const mockAtlasJson = {
  frameSize: 84,
  cols: 8,
  rows: 24,
  layout: {
    idle: { south: { startCell: 0, frameCount: 8 } },
    walk: { south: { startCell: 64, frameCount: 4 } },
    jump: { south: { startCell: 128, frameCount: 5 } },
  },
};

describe('BunnySpriteRenderer', () => {
  let renderer: BunnySpriteRenderer;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockAtlasJson),
    } as unknown as Response);
    renderer = new BunnySpriteRenderer({} as any);
  });

  it('loads atlas and creates sprite', async () => {
    await expect(renderer.load()).resolves.not.toThrow();
  });

  it('throws if fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    await expect(renderer.load()).rejects.toThrow('failed to fetch atlas descriptor');
  });

  it('throws if response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(renderer.load()).rejects.toThrow('atlas descriptor not found');
  });

  it('throws if JSON has unexpected shape', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ unexpected: true }),
    } as unknown as Response);
    await expect(renderer.load()).rejects.toThrow('unexpected shape');
  });

  it('dispose does not throw when not loaded', () => {
    expect(() => renderer.dispose()).not.toThrow();
  });
});
