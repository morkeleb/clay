/**
 * Central export for all Clay type definitions
 */

export * from './generator';
export * from './model';
export * from './clay-file';
export * from './template';
export * from './cli';
export * from './output';

/**
 * Utility types
 */

/**
 * Make all properties in T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract function parameter types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Parameters<T extends (...args: any) => any> = T extends (
  ...args: infer P
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => any
  ? P
  : never;

/**
 * Extract function return type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReturnType<T extends (...args: any) => any> = T extends (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any
) => infer R
  ? R
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  : any;
