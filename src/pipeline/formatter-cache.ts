
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
      formatter = this.loader(packageName);
      this.cache.set(packageName, formatter);
    }
    return formatter;
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Create a FormatterCache using resolve-global + require for real formatter loading.
 */
export function createFormatterCache(): FormatterCache {
  const resolveGlobal = require('resolve-global');
  return new FormatterCache((pkg: string) => require(resolveGlobal(pkg)));
}
