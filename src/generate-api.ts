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
import type { ModelIndex } from './types/clay-file';
import type { DecoratedGenerator } from './types/generator';

interface GeneratorReference {
  generator?: string;
  output?: string;
}

function resolveGenerator(
  name: string | GeneratorReference,
  modelPath: string,
  indexFile: ModelIndex
): DecoratedGenerator {
  const generatorName = typeof name === 'string' ? name : name.generator || '';
  const output = typeof name === 'object' ? name.output : undefined;

  const generatorPaths = [
    generatorName + '.json',
    path.resolve(generatorName + '.json'),
    path.resolve(path.join(modelPath, generatorName + '.json')),
    path.resolve(path.join(modelPath, generatorName, 'generator.json')),
    path.resolve(path.join('clay', 'generators', generatorName, 'generator.json')),
    generatorName,
    path.resolve(generatorName),
    path.resolve(path.join(modelPath, generatorName)),
  ].filter(fs.existsSync);

  if (generatorPaths.length < 1) {
    throw new Error('generator not found for: ' + generatorName);
  }

  ui.log('loading generator: ', generatorPaths[0]);

  return requireNew('./generator').load(generatorPaths[0], output, indexFile);
}

export interface GenerateResult {
  modelsProcessed: number;
  filesWritten: number;
  filesUnchanged: number;
  models: Array<{ modelPath: string; outputPath: string }>;
}

/**
 * Run code generation for the given directory.
 * This is the core API that both CLI and MCP server use.
 */
export async function generate(
  directory: string,
  options?: {
    modelPath?: string;
    outputPath?: string;
    verbose?: boolean;
    workers?: boolean;
    workerCount?: number;
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

    let totalWritten = 0;
    let totalUnchanged = 0;

    await Promise.all(
      modelsToExecute.map(async (modelIndex) => {
        const model = modelIndex.load();

        // Check conventions
        const allViolations: Array<{ generator: string; convention: string; description: string; errors: string[] }> = [];
        for (const g of model.generators) {
          const generatorName = typeof g === 'string' ? g : (g as GeneratorReference).generator || '';
          const generatorPaths = [
            generatorName + '.json',
            path.resolve(generatorName + '.json'),
            path.resolve(path.join(path.dirname(modelIndex.path), generatorName + '.json')),
            path.resolve(path.join(path.dirname(modelIndex.path), generatorName, 'generator.json')),
            path.resolve(path.join('clay', 'generators', generatorName, 'generator.json')),
            generatorName,
            path.resolve(generatorName),
            path.resolve(path.join(path.dirname(modelIndex.path), generatorName)),
          ].filter(fs.existsSync);

          if (generatorPaths.length > 0) {
            try {
              const conventions = loadConventions(generatorPaths[0]);
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
              path.dirname(modelIndex.path),
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
      modelsProcessed: modelsToExecute.length,
      filesWritten: totalWritten,
      filesUnchanged: totalUnchanged,
      models,
    };
  } finally {
    process.chdir(originalCwd);
  }
}
