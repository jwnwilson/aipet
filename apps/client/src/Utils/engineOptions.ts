/**
 * Engine options that can be overridden from the URL.
 *
 * Some Android drivers — notably Samsung Xclipse GPUs driven through Chrome's
 * ANGLE/Vulkan backend — fail to draw content that renders correctly elsewhere.
 * These flags let a specific device be tested against alternative WebGL paths on
 * the live site without shipping a new build for each attempt.
 *
 *   ?webgl1=1  force the WebGL 1 backend instead of WebGL 2
 *   ?noaa=1    create the engine without antialiasing
 *   ?nodpr=1   ignore the device pixel ratio
 */
export interface EngineFlagOptions {
  adaptToDeviceRatio: boolean;
  antialias: boolean;
  disableWebGL2Support: boolean;
}

export const DEFAULT_ENGINE_OPTIONS: EngineFlagOptions = {
  adaptToDeviceRatio: true,
  antialias: true,
  disableWebGL2Support: false,
};

function isFlagSet(params: URLSearchParams, name: string): boolean {
  const value = params.get(name);
  if (value === null) return false;
  return value !== '0' && value.toLowerCase() !== 'false';
}

export function engineOptionsFromQuery(search: string): EngineFlagOptions {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  return {
    adaptToDeviceRatio: !isFlagSet(params, 'nodpr'),
    antialias: !isFlagSet(params, 'noaa'),
    disableWebGL2Support: isFlagSet(params, 'webgl1'),
  };
}

/** Human-readable summary of any overrides in force, for logging on startup. */
export function describeEngineOptions(options: EngineFlagOptions): string {
  const overrides: string[] = [];
  if (options.disableWebGL2Support) overrides.push('WebGL 1 forced');
  if (!options.antialias) overrides.push('antialiasing off');
  if (!options.adaptToDeviceRatio) overrides.push('device pixel ratio ignored');
  return overrides.length ? overrides.join(', ') : 'defaults';
}
