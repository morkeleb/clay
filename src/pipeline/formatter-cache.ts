
export interface LoadedFormatter {
  extensions?: string[];
  apply: (
    fileName: string,
    content: string,
    options?: Record<string, unknown>,
    step?: unknown
  ) => string | Promise<string>;
}

export type FormatterLoader = (packageName: string) => LoadedFormatter;

/**
 * Caches loaded formatter modules so they're resolved once per generate run,
 * not once per file.
 */
export class FormatterCache {
  private readonly cache = new Map<string, LoadedFormatter>();
  private readonly loader: FormatterLoader;

  constructor(loader: FormatterLoader) {
    this.loader = loader;
  }

  get(packageName: string): LoadedFormatter {
    let formatter = this.cache.get(packageName);
    if (!formatter) {
      try {
        formatter = this.loader(packageName);
      } catch (e) {
        throw new Error(
          `Failed to load formatter "${packageName}". ` +
            `Is it installed? Try: npm install -g ${packageName}\n` +
            `Original error: ${e instanceof Error ? e.message : String(e)}`
        );
      }
      this.cache.set(packageName, formatter);
    }
    return formatter;
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Create a FormatterCache using resolve-global + createRequire for real formatter loading.
 * Uses createRequire from the formatter's path so that the formatter's internal
 * require() calls (e.g., require('prettier')) resolve from the formatter's own
 * node_modules, not from Clay's.
 */
export function createFormatterCache(): FormatterCache {
  const { createRequire } = require('module');
  const resolveGlobal = require('resolve-global');
  return new FormatterCache((pkg: string) => {
    const formatterPath = resolveGlobal(pkg);
    const formatterRequire = createRequire(formatterPath);
    return formatterRequire(formatterPath);
  });
}
