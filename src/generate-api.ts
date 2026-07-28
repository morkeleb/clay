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
  clearEngineCaches,
  RenderWorkerPool,
} from './pipeline/index';
import {
  collectModelDependencies,
  collectGeneratorDependencies,
  checkInputHash,
} from './pipeline/input-hash';
import { clearHookCaches } from './pipeline/hooks';
import { clearPrecheckCaches } from './pipeline/prechecks';
import { validateGeneratorsPreflight } from './pipeline/preflight';
import {
  resolveGeneratorPaths,
  type GeneratorReference,
} from './generator-resolver';
import {
  hasMissingGeneratedFiles,
  markOwnedPath,
  removeOrphanGeneratedFiles,
} from './orphan-cleanup';
import type { ModelIndex, ClayModelEntry } from './types/clay-file';
import type { DecoratedGenerator } from './types/generator';

// Read Clay version for input hash (catches upgrades)
let clayVersion = '0.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  clayVersion = pkg.version;
} catch {
  // Fallback if package.json not found
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
  models: Array<{ modelPath: string; outputPath: string }>;
}

interface PendingSweep {
  modelIndex: ClayModelEntry;
  expected: Set<string>;
  /** For second pass after orphan disk deletes (disk-dependent templates). */
  model: any;
  generators: DecoratedGenerator[];
}

/**
 * Run code generation for the given directory.
 * This is the core API that both CLI and MCP server use.
 *
 * Input hashing: before running the pipeline, all dependency files
 * (model, includes, generators, templates, partials) are hashed.
 * If the hash matches the stored value, the model is skipped entirely —
 * unless tracked generated_files are missing on disk (ledger drift).
 *
 * Orphan cleanup runs only after *all* selected models finish successfully
 * (no concurrent sweeps). The post-sweep ledger is saved before any refresh
 * second pass so durable unlinks never leave an unsaved .clay.
 * If any orphans are deleted from disk, *all* models that ran generators are
 * regenerated once (skipping postGenerate hooks) so filesystem-dependent
 * templates (e.g. TS engine aggregates) recompute against the cleaned tree.
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
  const verbose = options?.verbose ?? !!process.env.VERBOSE;
  let workerPool: InstanceType<typeof RenderWorkerPool> | undefined;
  let progressTracker: ReturnType<typeof createProgress> | undefined;

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

    if (!verbose) ui.suppress(true);

    // Pre-flight: fail fast (before spawning workers) if any referenced
    // generator can't be resolved or any step's template/copy source is
    // missing. Aggregates every problem into one clear error. Runs over ALL
    // models regardless of input-hash — the checks are cheap and we want
    // deterministic fail-fast rather than a mid-flight worker crash.
    validateGeneratorsPreflight(modelsToExecute);

    clearTemplateCache();
    clearEngineCaches();
    clearHookCaches();
    clearPrecheckCaches();
    const formatterCache = createFormatterCache();
    progressTracker = createProgress('generate', verbose);

    const useWorkers = options?.workers ?? (process.env.CLAY_WORKERS !== '0');
    const poolSize = options?.workerCount
      ?? (process.env.CLAY_WORKERS && parseInt(process.env.CLAY_WORKERS, 10) > 0
        ? parseInt(process.env.CLAY_WORKERS, 10)
        : RenderWorkerPool.defaultPoolSize());
    workerPool = useWorkers ? new RenderWorkerPool(poolSize, verbose) : undefined;

    // Per-model expected/protected sets — keyed by modelIndex so parallel
    // model runs never mix marks (multi-model isolation).
    const expectedByModel = new WeakMap<ClayModelEntry, Set<string>>();
    const allModels = indexFile.models;
    const pendingSweeps: PendingSweep[] = [];

    const buildRunner = (
      pool: InstanceType<typeof RenderWorkerPool> | undefined
    ) =>
      buildGeneratePipeline(
        formatterCache,
        progressTracker,
        pool,
        (filename, _isTouch, modelIndex) => {
          const expected = expectedByModel.get(modelIndex);
          if (!expected) {
            throw new Error(
              `orphan mark for unknown modelIndex (${modelIndex.path}); expected set not registered`
            );
          }
          markOwnedPath(expected, filename);
        }
      );

    let pipelineRunner = buildRunner(workerPool);

    let modelsSkipped = 0;

    const modelResults = await Promise.allSettled(
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

        // Missing tracked files are not covered by input_hash (model/templates
        // unchanged). Force a full pass so inventory/md5 can reconverge.
        const ledgerDrift = hasMissingGeneratedFiles(modelIndex);

        if (!force && !changed && !ledgerDrift) {
          modelsSkipped++;
          if (verbose) {
            ui.info(`skipping ${modelIndex.path} (unchanged)`);
          }
          return;
        }

        if (verbose && ledgerDrift && !changed && !force) {
          ui.info(
            `regenerating ${modelIndex.path} (tracked generated_files missing on disk)`
          );
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

        // Track expected + protected paths for this model only (incl. hash-skipped & touch).
        const expected = new Set<string>();
        expectedByModel.set(modelIndex, expected);
        const markOwned = (filePath: string) => {
          markOwnedPath(expected, filePath);
        };

        // Resolve all generators first. If one is missing we fail before any
        // worker tasks are posted, so the pool can be terminated cleanly.
        const generators: DecoratedGenerator[] = model.generators.map((g: string | GeneratorReference) =>
          resolveGenerator(g, modelDir, modelIndex)
        );

        // Run all generators and let every one finish before throwing, so that a
        // single broken generator does not leave unrelated worker tasks in flight.
        const generatorResults = await Promise.allSettled(
          generators.map((gen) =>
            gen.generate(model, modelIndex.output || '', pipelineRunner, { markOwned })
          )
        );
        const generatorError = generatorResults.find(
          (r): r is PromiseRejectedResult => r.status === 'rejected'
        )?.reason;
        if (generatorError) throw generatorError;

        // Defer orphan sweep until every selected model has finished successfully.
        pendingSweeps.push({
          modelIndex,
          expected,
          model,
          generators,
        });
      })
    );

    const firstModelError = modelResults.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    )?.reason;
    if (firstModelError) {
      // Do not sweep or save: no durable orphan deletes with a stale ledger.
      throw firstModelError;
    }

    // Barrier: all models that ran succeeded. Sweep serially.
    let anyDiskDeletes = false;
    for (const sweep of pendingSweeps) {
      const { removedFromIndex, deletedFromDisk } = removeOrphanGeneratedFiles({
        modelIndex: sweep.modelIndex,
        expected: sweep.expected,
        allModels,
      });
      if (verbose && (removedFromIndex.length > 0 || deletedFromDisk.length > 0)) {
        ui.info(
          `orphan cleanup ${sweep.modelIndex.path}: ` +
            `${removedFromIndex.length} dropped from index, ` +
            `${deletedFromDisk.length} deleted from disk`
        );
      }
      if (deletedFromDisk.length > 0) {
        anyDiskDeletes = true;
      }
    }

    // Persist swept ledger *before* refresh so durable unlinks always match .clay
    // even if the second pass fails.
    if (pendingSweeps.length > 0) {
      indexFile.save();
      updateGitattributes('.');
    }

    // Filesystem-dependent generators (TS engine aggregates / readdir barrels)
    // render before orphans are deleted. When *any* model deleted orphans, re-run
    // *all* models that generated this pass so sibling aggregates also refresh.
    if (anyDiskDeletes && pendingSweeps.length > 0) {
      if (verbose) {
        ui.info(
          `re-running ${pendingSweeps.length} model(s) after orphan deletes (refresh disk-dependent outputs)`
        );
      }

      // Cold caches so TS modules re-import (and workers drop jiti/model caches).
      clearTemplateCache();
      clearEngineCaches();
      clearHookCaches();
      clearPrecheckCaches();
      if (workerPool) {
        await workerPool.restart();
        pipelineRunner = buildRunner(workerPool);
      }

      try {
        for (const sweep of pendingSweeps) {
          const expected = new Set<string>();
          expectedByModel.set(sweep.modelIndex, expected);
          const markOwned = (filePath: string) => {
            markOwnedPath(expected, filePath);
          };

          const generatorResults = await Promise.allSettled(
            sweep.generators.map((gen) =>
              gen.generate(sweep.model, sweep.modelIndex.output || '', pipelineRunner, {
                markOwned,
                skipPostGenerate: true,
              })
            )
          );
          const generatorError = generatorResults.find(
            (r): r is PromiseRejectedResult => r.status === 'rejected'
          )?.reason;
          if (generatorError) throw generatorError;

          removeOrphanGeneratedFiles({
            modelIndex: sweep.modelIndex,
            expected,
            allModels,
          });
        }
      } catch (secondPassError) {
        // Ledger already saved post-sweep. Invalidate input_hash so the next
        // generate cannot skip and freeze stale aggregates.
        for (const sweep of pendingSweeps) {
          sweep.modelIndex.input_hash = undefined;
        }
        indexFile.save();
        updateGitattributes('.');
        throw secondPassError;
      }

      indexFile.save();
      updateGitattributes('.');
    } else if (pendingSweeps.length === 0) {
      // Only skipped models (or nothing ran) — still save if input_hash updates
      // were applied on skip path (hashes are stored even when skipping).
      indexFile.save();
      updateGitattributes('.');
    }
    // else: pendingSweeps non-empty, no disk deletes — already saved after sweep

    const models = modelsToExecute.map((m) => ({
      modelPath: m.path,
      outputPath: m.output || '',
    }));

    return {
      modelsProcessed: modelsToExecute.length - modelsSkipped,
      modelsSkipped,
      models,
    };
  } finally {
    // Cleanup in finally to handle errors in MCP server (persistent process)
    if (workerPool) await workerPool.terminate();
    progressTracker?.done();
    if (!verbose) ui.suppress(false);
    process.chdir(originalCwd);
  }
}
