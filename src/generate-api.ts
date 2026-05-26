/**
 * Core generate API — used by both the CLI and MCP server.
 * Loads models, runs the pipeline with worker threads, saves the .clay file.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs';
import path from 'path';
import * as ui from './output';
import { load as loadClayFile } from './clay_file';
import { requireNew } from './require-helper';
import { loadConventions, runConventions } from './conventions';
import { updateGitattributes } from './gitattributes';
import {
  buildGeneratePipeline,
  createFormatterCache,
  createProgress,
  clearTemplateCache,
  RenderWorkerPool,
} from './pipeline/index';
import {
  collectModelDependencies,
  collectGeneratorDependencies,
  checkInputHash,
} from './pipeline/input-hash';
import type { ModelIndex } from './types/clay-file';
import type { DecoratedGenerator } from './types/generator';

// Read Clay version for input hash (catches upgrades)
let clayVersion = '0.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  clayVersion = pkg.version;
} catch {
  // Fallback if package.json not found
}

interface GeneratorReference {
  generator?: string;
  output?: string;
}

function resolveGeneratorPaths(
  name: string | GeneratorReference,
  modelDir: string
): string[] {
  const generatorName = typeof name === 'string' ? name : name.generator || '';
  return [
    generatorName + '.json',
    path.resolve(generatorName + '.json'),
    path.resolve(path.join(modelDir, generatorName + '.json')),
    path.resolve(path.join(modelDir, generatorName, 'generator.json')),
    path.resolve(path.join('clay', 'generators', generatorName, 'generator.json')),
    generatorName,
    path.resolve(generatorName),
    path.resolve(path.join(modelDir, generatorName)),
  ].filter(fs.existsSync);
}

function resolveGenerator(
  name: string | GeneratorReference,
  modelPath: string,
  indexFile: ModelIndex
): DecoratedGenerator {
  const output = typeof name === 'object' ? name.output : undefined;
  const generatorPaths = resolveGeneratorPaths(name, modelPath);

  if (generatorPaths.length < 1) {
    const generatorName = typeof name === 'string' ? name : name.generator || '';
    throw new Error('generator not found for: ' + generatorName);
  }

  ui.log('loading generator: ', generatorPaths[0]);
  return requireNew('./generator').load(generatorPaths[0], output, indexFile);
}

export interface GenerateResult {
  modelsProcessed: number;
  modelsSkipped: number;
  filesWritten: number;
  filesUnchanged: number;
  models: Array<{ modelPath: string; outputPath: string }>;
}

/**
 * Run code generation for the given directory.
 * This is the core API that both CLI and MCP server use.
 *
 * Input hashing: before running the pipeline, all dependency files
 * (model, includes, generators, templates, partials) are hashed.
 * If the hash matches the stored value, the model is skipped entirely.
 */
export async function generate(
  directory: string,
  options?: {
    modelPath?: string;
    outputPath?: string;
    verbose?: boolean;
    workers?: boolean;
    workerCount?: number;
    force?: boolean;
  }
): Promise<GenerateResult> {
  const originalCwd = process.cwd();
  process.chdir(directory);

  try {
    const clayFilePath = path.resolve('.clay');
    if (!fs.existsSync(clayFilePath)) {
      throw new Error(
        'This folder has not been initiated with clay. Please create a .clay file.'
      );
    }

    const indexFile = loadClayFile('.');
    const force = options?.force ?? (process.env.CLAY_FORCE === 'true');

    let modelsToExecute: ModelIndex[];
    if (options?.modelPath) {
      modelsToExecute = [indexFile.getModelIndex(options.modelPath, options.outputPath)];
    } else {
      modelsToExecute = indexFile.models.map((m) =>
        indexFile.getModelIndex(m.path, m.output)
      );
    }

    const verbose = options?.verbose ?? !!process.env.VERBOSE;
    if (!verbose) ui.suppress(true);

    clearTemplateCache();
    const formatterCache = createFormatterCache();
    const progress = createProgress('generate', verbose);

    const useWorkers = options?.workers ?? (process.env.CLAY_WORKERS !== '0');
    const poolSize = options?.workerCount
      ?? (process.env.CLAY_WORKERS && parseInt(process.env.CLAY_WORKERS, 10) > 0
        ? parseInt(process.env.CLAY_WORKERS, 10)
        : RenderWorkerPool.defaultPoolSize());
    const workerPool = useWorkers ? new RenderWorkerPool(poolSize) : undefined;
    const pipelineRunner = buildGeneratePipeline(formatterCache, progress, workerPool);

    let modelsSkipped = 0;

    await Promise.all(
      modelsToExecute.map(async (modelIndex) => {
        const modelDir = path.dirname(modelIndex.path);

        // Collect all dependency file paths for input hashing
        const deps: string[] = collectModelDependencies(modelIndex.path);

        // Resolve generator paths and collect their dependencies
        const model = modelIndex.load();
        for (const g of model.generators) {
          const genPaths = resolveGeneratorPaths(g, modelDir);
          if (genPaths.length > 0) {
            const genDir = path.dirname(genPaths[0]);
            deps.push(...collectGeneratorDependencies(genPaths[0], genDir));
          }
        }

        // Check input hash — skip if nothing changed
        const { changed, hash } = checkInputHash(
          modelIndex.input_hash,
          deps,
          clayVersion
        );
        // Always store the hash (even with --force) so the next run can skip
        modelIndex.input_hash = hash;

        if (!force && !changed) {
          modelsSkipped++;
          if (verbose) {
            ui.info(`skipping ${modelIndex.path} (unchanged)`);
          }
          return;
        }

        // Check conventions
        const allViolations: Array<{ generator: string; convention: string; description: string; errors: string[] }> = [];
        for (const g of model.generators) {
          const generatorName = typeof g === 'string' ? g : (g as GeneratorReference).generator || '';
          const genPaths = resolveGeneratorPaths(g, modelDir);

          if (genPaths.length > 0) {
            try {
              const conventions = loadConventions(genPaths[0]);
              if (conventions.length > 0) {
                const violations = runConventions(conventions, model.model);
                for (const v of violations) {
                  allViolations.push({ generator: generatorName, convention: v.convention, description: v.description, errors: v.errors });
                }
              }
            } catch (e) {
              if (verbose) {
                ui.warn(`Could not load conventions for generator '${generatorName}': ${e instanceof Error ? e.message : String(e)}`);
              }
            }
          }
        }

        if (allViolations.length > 0) {
          const messages = allViolations.flatMap(v =>
            v.errors.map(e => `[${v.generator}/${v.convention}] ${e}`)
          );
          throw new Error(`Convention violations found:\n${messages.join('\n')}`);
        }

        await Promise.all(
          model.generators.map((g: string | GeneratorReference) =>
            resolveGenerator(
              g,
              modelDir,
              modelIndex
            ).generate(model, modelIndex.output || '', pipelineRunner)
          )
        );
      })
    );

    if (workerPool) await workerPool.terminate();
    progress.done();
    if (!verbose) ui.suppress(false);

    indexFile.save();
    updateGitattributes('.');

    const models = modelsToExecute.map((m) => ({
      modelPath: m.path,
      outputPath: m.output || '',
    }));

    return {
      modelsProcessed: modelsToExecute.length - modelsSkipped,
      modelsSkipped,
      filesWritten: 0,
      filesUnchanged: 0,
      models,
    };
  } finally {
    process.chdir(originalCwd);
  }
}
