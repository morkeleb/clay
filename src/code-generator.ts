/**
 * CodeGenerator base class for TypeScript template engine.
 * Users extend this class and implement render() to generate code programmatically.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Context passed to CodeGenerator.render() — all available data is visible
 * through destructuring, no hidden properties.
 */
export interface RenderContext {
  /** The selected model item (e.g., one entity from $.model.types[*]) */
  data: Record<string, any>;
  /** Clay helpers — pascalCase, camelCase, pluralize, etc. */
  helpers: ClayHelpers;
  /** The full root model (equivalent to clay_model in Handlebars) */
  model: Record<string, any>;
  /** Parent object in the JSON hierarchy (equivalent to clay_parent) */
  parent?: Record<string, any>;
}

/**
 * Typed interface for Clay's template helpers.
 * All helpers registered in template-engine.ts are available.
 */
export interface ClayHelpers {
  pascalCase: (str: string) => string;
  camelCase: (str: string) => string;
  kebabCase: (str: string) => string;
  snakeCase: (str: string) => string;
  upperCase: (str: string) => string;
  lowerCase: (str: string) => string;
  capitalize: (str: string) => string;
  startCase: (str: string) => string;
  pluralize: (str: string) => string;
  singularize: (str: string) => string;
  eq: (v1: any, v2: any) => boolean;
  ne: (v1: any, v2: any) => boolean;
  lt: (v1: any, v2: any) => boolean;
  gt: (v1: any, v2: any) => boolean;
  lte: (v1: any, v2: any) => boolean;
  gte: (v1: any, v2: any) => boolean;
  inc: (value: number) => number;
  json: (context: any) => string;
  includes: (str: string, search: string) => boolean;
  startsWith: (str: string, search: string) => boolean;
  endsWith: (str: string, search: string) => boolean;
  parseInt: (str: string) => number;
  pad: (str: string, length: number) => string;
  repeat: (str: string, n: number) => string;
  replace: (str: string, search: string, replacement: string) => string;
  truncate: (str: string, length: number) => string;
  split: (str: string, delimiter: string) => string[];
  words: (str: string) => string[];
  splitAndUseWord: (str: string, delimiter: string, index: number) => string;
  markdown: (value: string) => string;
  [key: string]: (...args: any[]) => any;
}

/**
 * Abstract base class for TypeScript code generators.
 * Extend this and implement render() to generate code programmatically.
 *
 * @example
 * ```typescript
 * import { CodeGenerator, type RenderContext } from 'clay-generator/types';
 *
 * export default class extends CodeGenerator {
 *   render({ data, helpers, model }: RenderContext): string {
 *     const { pascalCase } = helpers;
 *     return `export class ${pascalCase(data.name)} {}`;
 *   }
 * }
 * ```
 */
export abstract class CodeGenerator {
  abstract render(context: RenderContext): string | Promise<string>;
}
