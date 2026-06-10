import path from 'path';
import fs from 'fs';
import handlebars from '../template-engine';
import * as ui from '../output';

const MAX_CACHE_SIZE = 1000;

const fileTemplateCache = new Map<string, HandlebarsTemplateDelegate>();
const stringTemplateCache = new Map<string, HandlebarsTemplateDelegate>();

/**
 * Clear all template caches. Called at the start of each generation run.
 */
export function clearTemplateCache(): void {
  fileTemplateCache.clear();
  stringTemplateCache.clear();
}

/**
 * Get a compiled template from a file path. Cached by file path.
 */
export function getCompiledTemplate(filePath: string): HandlebarsTemplateDelegate {
  if (!fileTemplateCache.has(filePath)) {
    if (fileTemplateCache.size >= MAX_CACHE_SIZE) {
      ui.warn(`Template cache reached ${MAX_CACHE_SIZE} entries, clearing cache`);
      fileTemplateCache.clear();
    }
    const content = fs.readFileSync(filePath, 'utf8');
    fileTemplateCache.set(filePath, handlebars.compile(content));
  }
  return fileTemplateCache.get(filePath)!;
}

/**
 * Compile a template from a string. Cached by optional key.
 * Normalizes path separators to forward slashes to prevent
 * Handlebars backslash escape issues on Windows.
 */
export function compileTemplate(
  content: string,
  cacheKey?: string
): HandlebarsTemplateDelegate {
  if (cacheKey && stringTemplateCache.has(cacheKey)) {
    return stringTemplateCache.get(cacheKey)!;
  }
  const normalized = content.split(path.sep).join('/');
  const compiled = handlebars.compile(normalized);
  if (cacheKey) {
    if (stringTemplateCache.size >= MAX_CACHE_SIZE) {
      ui.warn(`Template cache reached ${MAX_CACHE_SIZE} entries, clearing cache`);
      stringTemplateCache.clear();
    }
    stringTemplateCache.set(cacheKey, compiled);
  }
  return compiled;
}
