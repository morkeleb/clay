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
import type { FormatterSpec, WrittenItem } from './types';
import type { PipelineProgress } from './progress';
import type { RenderWorkerPool } from './worker-pool';
import type { GeneratorStepGenerate } from '../types/generator';
import type { ClayModelEntry } from '../types/clay-file';

/**
 * Build the generate pipeline: select → render → hash → format → write.
 * TypeScript verifies the stage chain at compile time.
 *
 * When a workerPool is provided, template rendering runs on worker threads
 * for true multi-core parallelism. Otherwise renders on the main thread.
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
  partials: readonly string[],
  partialsDir: string
) => Promise<WrittenItem[]> {
  // Wire up the pipeline: render → hash → format → write
  // When worker pool is provided, rendering uses worker threads.
  // concurrent() wrapper handles dispatch of items to the render stage.
  const processingPipeline = pipeline(
    concurrent(
      createRenderStage(
        progress ? (f) => progress.onRender(f) : undefined,
        progress ? (f) => progress.onSkip(f) : undefined,
        workerPool
      ),
      { concurrency: workerPool ? 1 : 20 }
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

  return async (model, jsonPath, templateDir, templateFile, outputDir, modelIndex, step, formatters, partials, partialsDir) => {
    const templatePath = path.join(templateDir, templateFile);
    const fileNamePattern = path.join(outputDir, step.target || '', templateFile);

    const source = createSelectStage(
      model,
      jsonPath,
      templatePath,
      fileNamePattern,
      outputDir,
      step,
      modelIndex,
      formatters,
      partials,
      partialsDir,
      progress ? (f) => progress.onSelect(f) : undefined
    );

    const results: WrittenItem[] = [];
    for await (const item of processingPipeline(source)) {
      results.push(item);
    }
    return results;
  };
}
