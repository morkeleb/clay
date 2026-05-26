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
export { createHashStage } from './stages/hash';
export { createFormatStage } from './stages/format';
export { createWriteStage } from './stages/write';
export { executeCopy } from './stages/copy';
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

/**
 * Build the generate pipeline.
 *
 * When a workerPool is provided, workers handle select+render in batch
 * (loading models from disk in each thread). Results feed into
 * hash → format → write on the main thread.
 *
 * Without workers, the full pipeline runs on the main thread:
 * select → render → hash → format → write.
 */
export function buildGeneratePipeline(
  formatterCache: FormatterCache,
  progress?: PipelineProgress,
  workerPool?: RenderWorkerPool
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

  // Post-render pipeline: hash → format → write (shared by both paths)
  const postRenderPipeline = pipeline(
    createHashStage(progress ? (f) => progress.onSkip(f) : undefined)
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
        progress ? (f) => progress.onSkip(f) : undefined
      ),
      { concurrency: 20 }
    )
  )
    .pipe(createHashStage(progress ? (f) => progress.onSkip(f) : undefined))
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
    const fileNamePattern = path.join(outputDir, step.target || '', templateFile);

    // Worker path: batch select+render in a worker thread
    if (workerPool && modelPath) {
      const rendered = await workerPool.renderBatch(
        modelPath,
        jsonPath,
        templatePath,
        fileNamePattern,
        (partials || []) as string[],
        partialsDir || '',
        !!step.touch
      );

      // Report progress for worker results
      if (progress) {
        for (const r of rendered) {
          progress.onSelect(r.filename);
          progress.onRender(r.filename);
        }
      }

      // Feed worker results into post-render pipeline (hash → format → write)
      async function* workerResults(): AsyncGenerator<RenderedItem> {
        for (const r of rendered) {
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
