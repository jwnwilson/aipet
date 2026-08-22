import { spriteOptionsFromQuery, DEFAULT_SPRITE_OPTIONS } from './spriteOptions';

describe('spriteOptionsFromQuery', () => {
  it('defaults to the configuration that renders on affected Android devices', () => {
    // Arrange
    const search = '';

    // Act
    const options = spriteOptionsFromQuery(search);

    // Assert
    expect(options).toEqual({ useCanvasAtlas: true, managerCapacity: 64 });
    expect(options).toEqual(DEFAULT_SPRITE_OPTIONS);
  });

  it('falls back to the network atlas when bunnycanvas is turned off', () => {
    // Arrange
    const search = '?bunnycanvas=0';

    // Act
    const options = spriteOptionsFromQuery(search);

    // Assert
    expect(options.useCanvasAtlas).toBe(false);
  });

  it('keeps the canvas atlas when the flag is explicitly on', () => {
    // Arrange
    const search = '?bunnycanvas=1';

    // Act
    const options = spriteOptionsFromQuery(search);

    // Assert
    expect(options.useCanvasAtlas).toBe(true);
  });

  it('overrides the sprite manager capacity', () => {
    // Arrange
    const search = '?bunnycap=1';

    // Act
    const options = spriteOptionsFromQuery(search);

    // Assert
    expect(options.managerCapacity).toBe(1);
  });

  it('ignores a capacity that is not a positive whole number', () => {
    // Arrange / Act / Assert
    expect(spriteOptionsFromQuery('?bunnycap=0').managerCapacity)
      .toBe(DEFAULT_SPRITE_OPTIONS.managerCapacity);
    expect(spriteOptionsFromQuery('?bunnycap=-4').managerCapacity)
      .toBe(DEFAULT_SPRITE_OPTIONS.managerCapacity);
    expect(spriteOptionsFromQuery('?bunnycap=abc').managerCapacity)
      .toBe(DEFAULT_SPRITE_OPTIONS.managerCapacity);
  });

  it('caps an absurd capacity so a typo cannot exhaust memory', () => {
    // Arrange
    const search = '?bunnycap=999999';

    // Act
    const options = spriteOptionsFromQuery(search);

    // Assert
    expect(options.managerCapacity).toBe(1024);
  });

  it('combines both flags', () => {
    // Arrange
    const search = '?bunnycanvas=0&bunnycap=32';

    // Act
    const options = spriteOptionsFromQuery(search);

    // Assert
    expect(options).toEqual({ useCanvasAtlas: false, managerCapacity: 32 });
  });
});
