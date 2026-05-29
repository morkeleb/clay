/**
 * Post-generation hook execution.
 * Hooks run after all generator steps complete and files are on disk.
 * They are best-effort — failures are logged as warnings, never fail generation.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import path from 'path';
import handlebars from '../template-engine';
import * as jph from '../jsonpath-helper';
import * as ui from '../output';
import { getHelpers } from '../helpers';
import { executeCommand } from './stages/command';
import type { WrittenItem } from './types';
import type { PostGenerateStep } from '../types/generator';
import type { HookContext } from '../code-generator';

// Lazy-loaded jiti instance
let jitiInstance: any = null;

function getJiti(): any {
  if (!jitiInstance) {
    const { createJiti } = require('jiti');
    jitiInstance = createJiti(__filename, { interopDefault: true });
  }
  return jitiInstance;
}

/**
 * Execute all post-generation hooks for a generator.
 * Hooks run sequentially. Within a hook that has `select`, per-item
 * calls run in parallel with a concurrency limit.
 */
export async function executePostGenerateHooks(
  hooks: PostGenerateStep[],
  model: any,
  writtenItems: WrittenItem[],
  outputDir: string,
  generatorDir: string
): Promise<void> {
  const allGeneratedFiles = writtenItems.map(item => item.filename);
  const newTouchFiles = writtenItems
    .filter(item => item.step.touch)
    .map(item => item.filename);

  for (const hook of hooks) {
    try {
      if ('run' in hook) {
        await executeTsHook(hook, model, allGeneratedFiles, newTouchFiles, outputDir, generatorDir);
      } else if ('runCommand' in hook) {
        await executeCommandHook(hook, model, outputDir);
      }
    } catch (e) {
      const hookName = 'run' in hook ? hook.run : hook.runCommand;
      ui.warn(`Post-generate hook failed: ${hookName} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

/**
 * Execute a TypeScript PostGenerateHook.
 */
async function executeTsHook(
  hook: { run: string; select?: string; onlyNewTouchFiles?: boolean },
  model: any,
  allGeneratedFiles: string[],
  newTouchFiles: string[],
  outputDir: string,
  generatorDir: string
): Promise<void> {
  const hookPath = path.resolve(path.join(generatorDir, hook.run));
  const jiti = getJiti();
  const mod = await jiti.import(hookPath);
  const HookClass = (mod as any).default ?? mod;

  if (typeof HookClass !== 'function') {
    throw new Error(`Hook ${hookPath} must export a default class extending PostGenerateHook`);
  }

  const instance = new HookClass();

  if (typeof instance.run !== 'function') {
    throw new Error(`Hook ${hookPath} must export a class with a run(context: HookContext) method`);
  }

  const helpers = getHelpers();

  if (hook.select) {
    const items = jph.select(model, hook.select);
    const CONCURRENCY = 5;

    // Process items in batches for parallel execution
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (item: any) => {
          // Pass all new touch files to the hook — the hook has the model
          // item data and can determine which files are relevant.
          // We cannot reliably match files to items here without provenance
          // tracking through the pipeline.
          const itemTouchFiles = newTouchFiles;

          // Skip if onlyNewTouchFiles and no new touch files at all
          if (hook.onlyNewTouchFiles && itemTouchFiles.length === 0) {
            return;
          }

          const context: HookContext = {
            data: item,
            helpers,
            model: item.clay_model ?? model,
            parent: item.clay_parent,
            touchFiles: itemTouchFiles,
            outputDir,
            generatedFiles: allGeneratedFiles,
          };

          try {
            await instance.run(context);
          } catch (e) {
            ui.warn(`Post-generate hook ${hook.run} failed for ${item.name || 'item'}: ${e instanceof Error ? e.message : String(e)}`);
          }
        })
      );
    }
  } else {
    // No select — run once with full model
    if (hook.onlyNewTouchFiles && newTouchFiles.length === 0) {
      return;
    }

    const context: HookContext = {
      data: model,
      helpers,
      model,
      parent: undefined,
      touchFiles: newTouchFiles,
      outputDir,
      generatedFiles: allGeneratedFiles,
    };

    await instance.run(context);
  }
}

/**
 * Execute a shell command hook.
 */
async function executeCommandHook(
  hook: { runCommand: string; select?: string; verbose?: boolean },
  model: any,
  outputDir: string
): Promise<void> {
  const verbose = hook.verbose ?? !!process.env.VERBOSE;

  if (hook.select) {
    const command = handlebars.compile(hook.runCommand);
    const items = jph.select(model, hook.select);
    for (const item of items) {
      try {
        await executeCommand(command(item), outputDir, { verbose });
      } catch (e) {
        ui.warn(`Post-generate command failed: ${command(item)} — ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } else {
    try {
      await executeCommand(hook.runCommand, outputDir, { verbose });
    } catch (e) {
      ui.warn(`Post-generate command failed: ${hook.runCommand} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
