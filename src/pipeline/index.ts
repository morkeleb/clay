// src/pipeline/index.ts
export { pipeline, compose, PipelineBuilder } from './types';
export type {
  Stage,
  SelectItem,
  RenderedItem,
  ChangedItem,
  FormattedItem,
  FormatterSpec,
  WrittenItem,
} from './types';
export { concurrent } from './concurrent';
export { FormatterCache, createFormatterCache } from './formatter-cache';
export { createSelectStage } from './stages/select';
export { createRenderStage } from './stages/render';
export { clearTemplateCache } from './template-cache';
export { clearEngineCaches } from './engines';
export { createHashStage } from './stages/hash';
export { createFormatStage } from './stages/format';
export { createWriteStage } from './stages/write';
export { executeCommand } from './stages/command';
export { createProgress } from './progress';
export { RenderWorkerPool } from './worker-pool';
export type { PipelineProgress } from './progress';

import path from 'path';
import { pipeline } from './types';
import { concurrent } from './concurrent';
import { createSelectStage } from './stages/select';
import { createRenderStage } from './stages/render';
import { createHashStage } from './stages/hash';
import { createFormatStage } from './stages/format';
import { createWriteStage } from './stages/write';
import type { FormatterCache } from './formatter-cache';
import type { RenderedItem, FormatterSpec, WrittenItem } from './types';
import type { PipelineProgress } from './progress';
import type { RenderWorkerPool } from './worker-pool';
import type { GeneratorStepGenerate } from '../types/generator';
import type { ClayModelEntry } from '../types/clay-file';

/** Called for every rendered path that reaches the hash stage (incl. hash-skipped). */
export type OwnedPathCallback = (
  filename: string,
  isTouch: boolean,
  modelIndex: ClayModelEntry
) => void;

/**
 * Build the generate pipeline.
 *
 * When a workerPool is provided, workers handle select+render in batch
 * (loading models from disk in each thread). Results feed into
 * hash → format → write on the main thread.
 *
 * Without workers, the full pipeline runs on the main thread:
 * select → render → hash → format → write.
 *
 * onOwnedPath is invoked for every file that reaches hashing (including
 * unchanged hash-skipped files) so callers can build the expected set for
 * per-model orphan cleanup. Parallel models are safe if the callback keys
 * by modelIndex.
 */
export function buildGeneratePipeline(
  formatterCache: FormatterCache,
  progress?: PipelineProgress,
  workerPool?: RenderWorkerPool,
  onOwnedPath?: OwnedPathCallback
): (
  model: unknown,
  jsonPath: string,
  templateDir: string,
  templateFile: string,
  outputDir: string,
  modelIndex: ClayModelEntry,
  step: GeneratorStepGenerate,
  formatters: readonly FormatterSpec[],
  modelPath?: string,
  partials?: readonly string[],
  partialsDir?: string
) => Promise<WrittenItem[]> {
  const onSkip = progress ? (f: string) => progress.onSkip(f) : undefined;

  // Post-render pipeline: hash → format → write (shared by both paths)
  const postRenderPipeline = pipeline(
    createHashStage(onSkip, onOwnedPath)
  )
    .pipe(
      createFormatStage(
        formatterCache,
        progress ? (f) => progress.onFormat(f) : undefined
      )
    )
    .pipe(
      concurrent(
        createWriteStage(progress ? (f) => progress.onWrite(f) : undefined),
        { concurrency: 10 }
      )
    )
    .build();

  // Full main-thread pipeline: select → render → hash → format → write
  const fullPipeline = pipeline(
    concurrent(
      createRenderStage(
        progress ? (f) => progress.onRender(f) : undefined,
        progress ? (f) => progress.onSkip(f) : undefined,
        onOwnedPath
      ),
      { concurrency: 20 }
    )
  )
    .pipe(createHashStage(onSkip, onOwnedPath))
    .pipe(
      createFormatStage(
        formatterCache,
        progress ? (f) => progress.onFormat(f) : undefined
      )
    )
    .pipe(
      concurrent(
        createWriteStage(progress ? (f) => progress.onWrite(f) : undefined),
        { concurrency: 10 }
      )
    )
    .build();

  return async (model, jsonPath, templateDir, templateFile, outputDir, modelIndex, step, formatters, modelPath, partials, partialsDir) => {
    const templatePath = path.join(templateDir, templateFile);
    // The generated file is named after the template's own filename. A trailing
    // template-engine extension (.hbs/.ejs) is stripped from the OUTPUT name so a
    // template named e.g. `{{pascalCase name}}Controller.ts.hbs` writes
    // `...Controller.ts`, not `...Controller.ts.hbs`. The engine is chosen by the
    // step's `engine` field, not the extension, so this never affects rendering.
    const outputName = templateFile.replace(/\.(hbs|ejs)$/i, '');
    const fileNamePattern = path.join(outputDir, step.target || '', outputName);

    // Worker path: batch select+render in a worker thread
    if (workerPool && modelPath) {
      const batch = await workerPool.renderBatch(
        modelPath,
        jsonPath,
        templatePath,
        fileNamePattern,
        (partials || []) as string[],
        partialsDir || '',
        !!step.touch,
        step.engine
      );

      // Existing touch scaffolds never reach the hash stage — mark them protected.
      for (const touchFile of batch.skippedTouch) {
        onOwnedPath?.(touchFile, true, modelIndex);
        if (progress) progress.onSkip(touchFile);
      }

      // Report progress for worker results
      if (progress) {
        for (const r of batch.results) {
          progress.onSelect(r.filename);
          progress.onRender(r.filename);
        }
      }

      // Feed worker results into post-render pipeline (hash → format → write)
      async function* workerResults(): AsyncGenerator<RenderedItem> {
        for (const r of batch.results) {
          yield {
            filename: r.filename,
            content: r.content,
            step,
            modelIndex,
            formatters,
          };
        }
      }

      const results: WrittenItem[] = [];
      for await (const item of postRenderPipeline(workerResults())) {
        results.push(item);
      }
      return results;
    }

    // Main-thread path: full pipeline
    const source = createSelectStage(
      model,
      jsonPath,
      templatePath,
      fileNamePattern,
      outputDir,
      step,
      modelIndex,
      formatters,
      progress ? (f) => progress.onSelect(f) : undefined
    );

    const results: WrittenItem[] = [];
    for await (const item of fullPipeline(source)) {
      results.push(item);
    }
    return results;
  };
}
