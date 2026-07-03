/**
 * Shared generator-path resolution.
 *
 * Both the render pipeline (generate-api) and the pre-flight validation
 * (pipeline/preflight) need the same list of candidate locations for a
 * generator so they agree on what "found" means. This module owns the
 * single source of truth for that search list.
 */
import fs from 'fs';
import path from 'path';

/**
 * A generator reference in a model may be a bare string name or an object
 * carrying an optional output override.
 */
export interface GeneratorReference {
  generator?: string;
  output?: string;
}

/** Extract the plain generator name from a string or reference object. */
export function generatorName(name: string | GeneratorReference): string {
  return typeof name === 'string' ? name : name.generator || '';
}

/**
 * All candidate locations Clay searches for a generator, in priority order.
 * These are absolute/relative paths as searched — used both for existence
 * checks and to report what was searched when a generator is not found.
 */
export function generatorCandidatePaths(
  name: string | GeneratorReference,
  modelDir: string
): string[] {
  const gen = generatorName(name);
  return [
    gen + '.json',
    path.resolve(gen + '.json'),
    path.resolve(path.join(modelDir, gen + '.json')),
    path.resolve(path.join(modelDir, gen, 'generator.json')),
    path.resolve(path.join('clay', 'generators', gen, 'generator.json')),
    gen,
    path.resolve(gen),
    path.resolve(path.join(modelDir, gen)),
  ];
}

/**
 * Return only the candidate generator paths that actually exist on disk.
 */
export function resolveGeneratorPaths(
  name: string | GeneratorReference,
  modelDir: string
): string[] {
  return generatorCandidatePaths(name, modelDir).filter(fs.existsSync);
}
