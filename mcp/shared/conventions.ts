/**
 * MCP conventions helper.
 * Loads conventions from generators referenced by a model and runs them.
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readExpandedModel } from './model-file.js';

const require = createRequire(import.meta.url);
const { loadConventions, runConventions } = require('../../dist/src/conventions.js');

export interface ConventionViolation {
  generator: string;
  convention: string;
  errors: string[];
}

/**
 * Check conventions for a model by loading conventions from all its generators.
 * Returns violations grouped by generator and convention.
 */
export function checkConventions(
  modelPath: string,
  workingDirectory: string
): ConventionViolation[] {
  const rawContent = fs.readFileSync(path.resolve(modelPath), 'utf-8');
  const rawModel = JSON.parse(rawContent);

  if (!rawModel.generators || !Array.isArray(rawModel.generators)) {
    return [];
  }

  // Load expanded model for convention checking
  const expandedModel = readExpandedModel(modelPath);

  const allViolations: ConventionViolation[] = [];

  for (const g of rawModel.generators) {
    const generatorName = typeof g === 'string' ? g : g.generator || '';
    const modelDir = path.dirname(path.resolve(modelPath));

    // Same resolution order as command-line.ts
    const candidatePaths = [
      generatorName + '.json',
      path.resolve(generatorName + '.json'),
      path.resolve(path.join(modelDir, generatorName + '.json')),
      path.resolve(path.join(modelDir, generatorName, 'generator.json')),
      path.resolve(path.join(workingDirectory, 'clay', 'generators', generatorName, 'generator.json')),
      generatorName,
      path.resolve(generatorName),
      path.resolve(path.join(modelDir, generatorName)),
    ].filter((p) => fs.existsSync(p));

    if (candidatePaths.length === 0) continue;

    try {
      const conventions = loadConventions(candidatePaths[0]);
      if (conventions.length === 0) continue;

      const violations = runConventions(conventions, expandedModel.model);
      for (const v of violations) {
        allViolations.push({
          generator: generatorName,
          convention: v.convention,
          errors: v.errors,
        });
      }
    } catch {
      // If conventions can't be loaded, skip silently
    }
  }

  return allViolations;
}
