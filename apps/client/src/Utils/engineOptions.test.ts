import { engineOptionsFromQuery, DEFAULT_ENGINE_OPTIONS } from './engineOptions';

describe('engineOptionsFromQuery', () => {
  it('returns the standard options when no flags are present', () => {
    // Arrange
    const search = '';

    // Act
    const options = engineOptionsFromQuery(search);

    // Assert
    expect(options).toEqual(DEFAULT_ENGINE_OPTIONS);
  });

  it('forces WebGL 1 when webgl1 is set', () => {
    // Arrange
    const search = '?webgl1=1';

    // Act
    const options = engineOptionsFromQuery(search);

    // Assert
    expect(options.disableWebGL2Support).toBe(true);
  });

  it('disables antialiasing when noaa is set', () => {
    // Arrange
    const search = '?noaa=1';

    // Act
    const options = engineOptionsFromQuery(search);

    // Assert
    expect(options.antialias).toBe(false);
  });

  it('stops adapting to device ratio when nodpr is set', () => {
    // Arrange
    const search = '?nodpr=1';

    // Act
    const options = engineOptionsFromQuery(search);

    // Assert
    expect(options.adaptToDeviceRatio).toBe(false);
  });

  it('combines several flags at once', () => {
    // Arrange
    const search = '?webgl1=1&noaa=1';

    // Act
    const options = engineOptionsFromQuery(search);

    // Assert
    expect(options).toEqual({
      adaptToDeviceRatio: true,
      antialias: false,
      disableWebGL2Support: true,
      disableVertexArrayObjects: false,
      disableInstancing: false,
    });
  });

  it('ignores flags set to 0 so links can be toggled off', () => {
    // Arrange
    const search = '?webgl1=0&noaa=0';

    // Act
    const options = engineOptionsFromQuery(search);

    // Assert
    expect(options).toEqual(DEFAULT_ENGINE_OPTIONS);
  });

  it('disables vertex array objects when novao is set', () => {
    // Arrange
    const search = '?novao=1';

    // Act
    const options = engineOptionsFromQuery(search);

    // Assert
    expect(options.disableVertexArrayObjects).toBe(true);
  });

  it('disables hardware instancing when noinst is set', () => {
    // Arrange
    const search = '?noinst=1';

    // Act
    const options = engineOptionsFromQuery(search);

    // Assert
    expect(options.disableInstancing).toBe(true);
  });

  it('tolerates a search string without a leading question mark', () => {
    // Arrange
    const search = 'webgl1=1';

    // Act
    const options = engineOptionsFromQuery(search);

    // Assert
    expect(options.disableWebGL2Support).toBe(true);
  });
});
