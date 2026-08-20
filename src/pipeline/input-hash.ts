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
 *
 * For generate: templates, also walks the static relative import graph
 * (`./`, `../`) so `engine: "ts"` helpers outside the template path still
 * invalidate input_hash. Stays inside the pack; skips node_modules.
 */
export function collectGeneratorDependencies(
  generatorPath: string,
  generatorDir: string
): string[] {
  const deps: string[] = [];
  const visited = new Set<string>();

  const addPath = (filePath: string): void => {
    const resolved = path.resolve(filePath);
    if (visited.has(resolved)) return;
    visited.add(resolved);
    deps.push(resolved);
  };

  addPath(generatorPath);

  let generatorData: {
    steps?: unknown[];
    partials?: string[];
    conventions?: unknown[];
  };
  try {
    generatorData = JSON.parse(fs.readFileSync(generatorPath, 'utf8'));
  } catch {
    return deps;
  }

  const packRoot = path.resolve(generatorDir);

  for (const step of generatorData.steps || []) {
    const s = step as Record<string, unknown>;
    if (typeof s.generate === 'string') {
      const templatePath = path.resolve(path.join(generatorDir, s.generate));
      collectFilesRecursive(templatePath, addPath);
    }
  }

  // Walk imports from generate: templates (and files those import) before
  // adding copy sources, so copied JS is not treated as an import root.
  const generateScripts = deps.filter(
    (filePath) => isScriptFile(filePath) && isInsidePack(filePath, packRoot)
  );
  for (const filePath of generateScripts) {
    followRelativeImports(filePath, addPath, visited, packRoot);
  }

  for (const step of generatorData.steps || []) {
    const s = step as Record<string, unknown>;
    if (typeof s.copy === 'string' && !s.copy.startsWith('git+')) {
      const copyPath = path.resolve(path.join(generatorDir, s.copy));
      collectFilesRecursive(copyPath, addPath);
    }
  }

  // Collect partial files
  for (const partial of generatorData.partials || []) {
    const partialPath = path.resolve(path.join(generatorDir, partial));
    if (fs.existsSync(partialPath)) {
      addPath(partialPath);
    }
  }

  // Collect convention include files
  for (const conv of generatorData.conventions || []) {
    const c = conv as Record<string, unknown>;
    if (typeof c.include === 'string') {
      const convPath = path.resolve(path.join(generatorDir, c.include));
      if (fs.existsSync(convPath)) {
        addPath(convPath);
      }
    }
  }

  return deps;
}

const SCRIPT_EXTS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

const RESOLVE_EXTS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
];

function isScriptFile(filePath: string): boolean {
  return SCRIPT_EXTS.has(path.extname(filePath).toLowerCase());
}

function isInsidePack(filePath: string, packRoot: string): boolean {
  const rel = path.relative(packRoot, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return !rel.split(path.sep).includes('node_modules');
}

function collectFilesRecursive(
  filePath: string,
  addPath: (filePath: string) => void
): void {
  if (!fs.existsSync(filePath)) return;

  const stat = fs.lstatSync(filePath);
  if (stat.isFile()) {
    addPath(filePath);
  } else if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(filePath)) {
      collectFilesRecursive(path.join(filePath, entry), addPath);
    }
  }
}

/**
 * Static relative specifiers only (`./`, `../`). Skips bare packages,
 * path aliases, and `import(variable)`.
 */
function extractRelativeSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /\bfrom\s+['"](\.\.?\/[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.\.?\/[^'"]+)['"]/g,
    /\brequire\s*\(\s*['"](\.\.?\/[^'"]+)['"]/g,
    /\bimport\s+['"](\.\.?\/[^'"]+)['"]/g,
  ];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(source)) !== null) {
      specs.push(match[1]);
    }
  }
  return specs;
}

function specifierCandidates(base: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const push = (p: string): void => {
    if (!seen.has(p)) {
      seen.add(p);
      candidates.push(p);
    }
  };

  const ext = path.extname(base);
  push(base);

  // jiti/TS: import './foo.js' often names foo.ts
  if (ext === '.js') {
    const stem = base.slice(0, -'.js'.length);
    push(stem + '.ts');
    push(stem + '.tsx');
  } else if (ext === '.mjs') {
    push(base.slice(0, -'.mjs'.length) + '.mts');
  } else if (ext === '.cjs') {
    push(base.slice(0, -'.cjs'.length) + '.cts');
  } else if (ext === '.jsx') {
    push(base.slice(0, -'.jsx'.length) + '.tsx');
  }

  if (!ext) {
    for (const e of RESOLVE_EXTS) push(base + e);
  }

  for (const e of RESOLVE_EXTS) {
    push(path.join(base, 'index' + e));
  }

  return candidates;
}

function resolveRelativeSpecifier(
  fromFile: string,
  spec: string,
  packRoot: string
): string | null {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of specifierCandidates(base)) {
    if (!isInsidePack(candidate, packRoot)) continue;
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function followRelativeImports(
  filePath: string,
  addPath: (filePath: string) => void,
  visited: Set<string>,
  packRoot: string
): void {
  if (!isScriptFile(filePath)) return;

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  for (const spec of extractRelativeSpecifiers(content)) {
    const resolved = resolveRelativeSpecifier(filePath, spec, packRoot);
    if (!resolved) continue;
    if (visited.has(path.resolve(resolved))) continue;
    addPath(resolved);
    followRelativeImports(resolved, addPath, visited, packRoot);
  }
}

/**
 * Compute a single hash from the contents of all dependency files.
 * Includes the Clay version to invalidate when Clay is upgraded.
 */
export function computeInputHash(
  filePaths: string[],
  clayVersion: string
): string {
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
