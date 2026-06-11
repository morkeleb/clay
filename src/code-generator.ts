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

/**
 * Context passed to PostGenerateHook.run() — extends RenderContext with
 * hook-specific data about what was generated.
 */
export interface HookContext {
  /** The selected model item */
  data: Record<string, any>;
  /** Clay helpers — pascalCase, camelCase, pluralize, etc. */
  helpers: ClayHelpers;
  /** The full root model */
  model: Record<string, any>;
  /** Parent object in the JSON hierarchy */
  parent?: Record<string, any>;
  /** Touch files that were newly created during this generation run */
  touchFiles: string[];
  /** The output directory for this generator */
  outputDir: string;
  /** All files generated during this run (not just touch files) */
  generatedFiles: string[];
}

/**
 * Abstract base class for post-generation hooks.
 * Extend this and implement run() to execute logic after files are generated.
 *
 * @example
 * ```typescript
 * import { PostGenerateHook, type HookContext } from 'clay-generator/types';
 * import { execSync } from 'child_process';
 * import fs from 'fs';
 *
 * export default class extends PostGenerateHook {
 *   async run({ data, helpers, touchFiles, outputDir }: HookContext): Promise<void> {
 *     const { pascalCase } = helpers;
 *     const iface = fs.readFileSync(
 *       `${outputDir}/src/services/I${pascalCase(data.name)}Service.ts`, 'utf-8'
 *     );
 *     for (const file of touchFiles) {
 *       execSync(`claude -p 'Implement ${file} following: ${iface}'`, { cwd: outputDir });
 *     }
 *   }
 * }
 * ```
 */
export abstract class PostGenerateHook {
  abstract run(context: HookContext): void | Promise<void>;
}

/**
 * Context passed to PreCheck.check() — the fully resolved model (after
 * includes and mixins), before any generation step runs.
 */
export interface PreCheckContext {
  /** The selected model item (the root model when no `select` is given) */
  data: Record<string, any>;
  /** Clay helpers — pascalCase, camelCase, pluralize, etc. */
  helpers: ClayHelpers;
  /** The full root model */
  model: Record<string, any>;
  /** Parent object in the JSON hierarchy */
  parent?: Record<string, any>;
}

/**
 * Abstract base class for pre-generation checks.
 * Extend this and implement check() to validate model invariants before
 * any generation step runs. Checks are pure validators — they must not
 * write files or mutate the model. Return a non-empty array of violation
 * strings (or throw) to fail the check; return an empty array or nothing
 * to pass. Any violation aborts the generation before files are touched.
 *
 * @example
 * ```typescript
 * import { PreCheck, type PreCheckContext } from 'clay-generator/types';
 *
 * export default class extends PreCheck {
 *   check({ data }: PreCheckContext): string[] | void {
 *     if (!data.name) return ['every type needs a name'];
 *   }
 * }
 * ```
 */
export abstract class PreCheck {
  abstract check(
    context: PreCheckContext
  ): string[] | void | Promise<string[] | void>;
}
