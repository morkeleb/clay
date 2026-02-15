/**
 * Include-aware mutation helper.
 * Traces JSONPath targets back to source files (main model or included files)
 * and applies mutations to the correct file.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import jp from 'jsonpath';

/**
 * Given an expanded model, an include map, and a JSONPath target path array,
 * determines which file the target lives in and the relative path within that file.
 *
 * Returns:
 * - filePath: the included file path, or null if the target is in the main model
 * - relativePath: the JSONPath components within the source file (starts with '$')
 */
export function traceToSource(
  expandedModel: Record<string, unknown>,
  includeMap: Map<object, string>,
  targetPath: (string | number)[]
): { filePath: string | null; relativePath: (string | number)[] } {
  let current: unknown = expandedModel;
  let lastIncludeIdx = -1;
  let lastIncludeFile: string | null = null;

  for (let i = 1; i < targetPath.length; i++) {
    current = (current as Record<string | number, unknown>)[targetPath[i]];
    if (current !== null && typeof current === 'object' && includeMap.has(current as object)) {
      lastIncludeIdx = i;
      lastIncludeFile = includeMap.get(current as object)!;
    }
  }

  if (lastIncludeFile === null) {
    return { filePath: null, relativePath: targetPath };
  }

  const relativePath: (string | number)[] = ['$', ...targetPath.slice(lastIncludeIdx + 1)];
  return { filePath: lastIncludeFile, relativePath };
}

/**
 * Read an included JSON file and return parsed data.
 */
export function readIncludeFile(filePath: string): Record<string, unknown> {
  const content = fs.readFileSync(path.resolve(filePath), 'utf-8');
  return JSON.parse(content);
}

/**
 * Write an included JSON file as formatted JSON.
 */
export function writeIncludeFile(filePath: string, data: unknown): void {
  fs.writeFileSync(
    path.resolve(filePath),
    JSON.stringify(data, null, 2) + '\n',
    'utf-8'
  );
}

/**
 * Resolve a JSONPath target within an included file's data.
 * relativePath is a path array starting with '$'.
 */
export function resolveInInclude(
  includeData: Record<string, unknown>,
  relativePath: (string | number)[]
): unknown[] {
  return jp.query(includeData, jp.stringify(relativePath));
}
