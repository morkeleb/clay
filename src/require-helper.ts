import path from 'path';

/**
 * Require a module and clear it from the cache first
 * This ensures you always get a fresh copy of the module
 * 
 * @param modulePath - Path to the module to require
 * @returns The required module
 */
export function requireNew(modulePath: string): any {
  const resolvedPath = path.resolve(modulePath);
  delete require.cache[resolvedPath];
  return require(modulePath);
}

export default requireNew;
