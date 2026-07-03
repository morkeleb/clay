/**
 * Pre-flight validation.
 *
 * Runs BEFORE the worker pool is spawned and before any generation happens.
 * It performs existence-only checks over every model about to be generated:
 *   1. Every referenced generator resolves (using the shared resolution logic).
 *   2. For each resolved generator, every step that references a file on disk
 *      points at something that exists:
 *        - `generate` step -> the template path (a directory is valid).
 *        - `copy` step     -> the source path (remote `git+` sources skipped).
 *      `runCommand` steps are ignored for file existence.
 *
 * All problems across all models and generators are aggregated so a single
 * PreflightError reports the complete picture rather than failing on the first.
 * No side effects: generator.json is parsed directly rather than loaded.
 */
import fs from 'fs';
import path from 'path';
import {
  generatorCandidatePaths,
  resolveGeneratorPaths,
  generatorName,
  type GeneratorReference,
} from '../generator-resolver';
import type { ModelIndex } from '../types/clay-file';

/**
 * Thrown when pre-flight validation finds one or more problems.
 * Carries every problem so callers can present the complete picture.
 */
export class PreflightError extends Error {
  problems: string[];

  constructor(problems: string[]) {
    super(`Pre-flight validation failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'PreflightError';
    this.problems = problems;
  }
}

interface RawStep {
  generate?: unknown;
  copy?: unknown;
  runCommand?: unknown;
}

/**
 * Locate the generator.json file for a resolved candidate path. The first
 * existing candidate may be a `.json` file directly, or a directory that
 * contains a generator.json. Returns the JSON file path, or null if none.
 */
function generatorConfigFile(resolvedPath: string): string | null {
  try {
    const stat = fs.statSync(resolvedPath);
    if (stat.isDirectory()) {
      const candidate = path.join(resolvedPath, 'generator.json');
      return fs.existsSync(candidate) ? candidate : null;
    }
    return resolvedPath;
  } catch {
    return null;
  }
}

/**
 * Validate that every generator referenced by the given models resolves and
 * that all file-referencing steps point at existing files. Throws
 * PreflightError aggregating every problem found. No-op when clean.
 */
export function validateGeneratorsPreflight(models: ModelIndex[]): void {
  const problems: string[] = [];

  for (const modelIndex of models) {
    const modelPath = modelIndex.path;
    const modelDir = path.dirname(modelPath);

    let model: { generators?: Array<string | GeneratorReference> };
    try {
      model = modelIndex.load();
    } catch (e) {
      problems.push(
        `Failed to load model ${modelPath}: ${e instanceof Error ? e.message : String(e)}`
      );
      continue;
    }

    for (const g of model.generators || []) {
      const name = generatorName(g);
      const resolved = resolveGeneratorPaths(g, modelDir);

      if (resolved.length < 1) {
        const searched = generatorCandidatePaths(g, modelDir).join(', ');
        problems.push(
          `Generator "${name}" not found for model ${modelPath}. Searched: ${searched}`
        );
        continue;
      }

      const configFile = generatorConfigFile(resolved[0]);
      if (!configFile) {
        problems.push(
          `Generator "${name}" resolved to ${resolved[0]} but no generator.json was found there (referenced by model ${modelPath})`
        );
        continue;
      }

      const generatorDir = path.dirname(configFile);

      let steps: RawStep[];
      try {
        const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        steps = Array.isArray(parsed.steps) ? parsed.steps : [];
      } catch (e) {
        problems.push(
          `Generator "${name}" config could not be parsed (${configFile}): ${
            e instanceof Error ? e.message : String(e)
          } (referenced by model ${modelPath})`
        );
        continue;
      }

      for (const step of steps) {
        if (typeof step.generate === 'string') {
          const templatePath = path.join(generatorDir, step.generate);
          if (!fs.existsSync(templatePath)) {
            problems.push(
              `Template not found for generator "${name}" step "${step.generate}": ${templatePath} (referenced by model ${modelPath})`
            );
          }
        } else if (typeof step.copy === 'string') {
          // Remote sources are fetched at runtime, not resolved on disk here.
          if (step.copy.startsWith('git+')) continue;
          const copyPath = path.join(generatorDir, step.copy);
          if (!fs.existsSync(copyPath)) {
            problems.push(
              `Copy source not found for generator "${name}" step "${step.copy}": ${copyPath} (referenced by model ${modelPath})`
            );
          }
        }
        // runCommand steps reference no on-disk file — ignored.
      }
    }
  }

  if (problems.length > 0) {
    throw new PreflightError(problems);
  }
}
