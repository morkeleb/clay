/**
 * Input hashing for model skip optimization.
 * Collects all dependency file paths for a model and its generators,
 * hashes their contents, and compares against a stored hash to determine
 * if generation can be skipped entirely.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Recursively collect all include file paths from a model JSON file.
 * Does NOT load or execute the model — just scans for "include" references.
 */
export function collectModelDependencies(modelPath: string): string[] {
  const resolved = path.resolve(modelPath);
  // All includes resolve relative to the root model's directory,
  // matching the runtime behavior in model.ts executeIncludes()
  const modelDir = path.dirname(resolved);
  const deps: string[] = [resolved];
  const visited = new Set<string>([resolved]);

  function scan(filePath: string): void {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return; // File not found — skip
    }

    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch {
      return; // Not JSON (could be a JS mixin file)
    }

    // Recursively find all "include" properties
    function walk(obj: unknown): void {
      if (obj === null || obj === undefined || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        for (const item of obj) walk(item);
        return;
      }

      const record = obj as Record<string, unknown>;

      if (typeof record.include === 'string') {
        // Resolve relative to root model dir (matches runtime behavior)
        const includePath = path.resolve(modelDir, record.include);
        if (!visited.has(includePath)) {
          visited.add(includePath);
          deps.push(includePath);
          scan(includePath); // Recurse into included files
        }
      }

      for (const key of Object.keys(record)) {
        if (typeof record[key] === 'object' && record[key] !== null) {
          walk(record[key]);
        }
      }
    }

    walk(data);
  }

  scan(resolved);
  return deps;
}

/**
 * Collect all file paths that a generator depends on:
 * the generator JSON, template files/dirs, partial files, and convention includes.
 */
export function collectGeneratorDependencies(
  generatorPath: string,
  generatorDir: string
): string[] {
  const deps: string[] = [path.resolve(generatorPath)];

  let generatorData: { steps?: unknown[]; partials?: string[]; conventions?: unknown[] };
  try {
    generatorData = JSON.parse(fs.readFileSync(generatorPath, 'utf8'));
  } catch {
    return deps;
  }

  // Collect template and copy source paths from steps
  for (const step of generatorData.steps || []) {
    const s = step as Record<string, unknown>;
    if (typeof s.generate === 'string') {
      const templatePath = path.resolve(path.join(generatorDir, s.generate));
      collectFilesRecursive(templatePath, deps);
    }
    if (typeof s.copy === 'string' && !s.copy.startsWith('git+')) {
      const copyPath = path.resolve(path.join(generatorDir, s.copy));
      collectFilesRecursive(copyPath, deps);
    }
  }

  // Collect partial files
  for (const partial of generatorData.partials || []) {
    const partialPath = path.resolve(path.join(generatorDir, partial));
    if (fs.existsSync(partialPath)) {
      deps.push(partialPath);
    }
  }

  // Collect convention include files
  for (const conv of generatorData.conventions || []) {
    const c = conv as Record<string, unknown>;
    if (typeof c.include === 'string') {
      const convPath = path.resolve(path.join(generatorDir, c.include));
      if (fs.existsSync(convPath)) {
        deps.push(convPath);
      }
    }
  }

  return deps;
}

function collectFilesRecursive(filePath: string, deps: string[]): void {
  if (!fs.existsSync(filePath)) return;

  const stat = fs.lstatSync(filePath);
  if (stat.isFile()) {
    deps.push(filePath);
  } else if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(filePath)) {
      collectFilesRecursive(path.join(filePath, entry), deps);
    }
  }
}

/**
 * Compute a single hash from the contents of all dependency files.
 * Includes the Clay version to invalidate when Clay is upgraded.
 */
export function computeInputHash(filePaths: string[], clayVersion: string): string {
  const hash = crypto.createHash('md5');
  hash.update(`clay:${clayVersion}\n`);

  // Sort for deterministic ordering
  const sorted = [...filePaths].sort();

  for (const filePath of sorted) {
    try {
      const content = fs.readFileSync(filePath);
      hash.update(`${filePath}\n`);
      hash.update(content);
    } catch {
      // File not found — include path in hash so missing file changes the hash
      hash.update(`${filePath}:MISSING\n`);
    }
  }

  return hash.digest('hex');
}

/**
 * Check if a model's inputs have changed since last generation.
 * Returns the new input hash (to store if generation proceeds).
 */
export function checkInputHash(
  storedHash: string | undefined,
  filePaths: string[],
  clayVersion: string
): { changed: boolean; hash: string } {
  const hash = computeInputHash(filePaths, clayVersion);
  return { changed: hash !== storedHash, hash };
}
