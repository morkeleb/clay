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
import type { GeneratorStepGenerate } from '../types/generator';
import type { ClayModelEntry } from '../types/clay-file';

/**
 * Build the generate pipeline: select → render → hash → format → write.
 * TypeScript verifies the stage chain at compile time.
 *
 * This pipeline is generator-agnostic — each item carries its own formatter
 * config, so one pipeline serves all generators.
 */
export function buildGeneratePipeline(
  formatterCache: FormatterCache,
  progress?: PipelineProgress
): (
  model: unknown,
  jsonPath: string,
  templateDir: string,
  templateFile: string,
  outputDir: string,
  modelIndex: ClayModelEntry,
  step: GeneratorStepGenerate,
  formatters: readonly FormatterSpec[]
) => Promise<WrittenItem[]> {
  // Wire up the pipeline: render → hash → format → write
  // Select is a source, not a transform, so it's called separately
  const processingPipeline = pipeline(
    createRenderStage(
      progress ? (f) => progress.onRender(f) : undefined,
      progress ? (f) => progress.onSkip(f) : undefined
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

  return async (model, jsonPath, templateDir, templateFile, outputDir, modelIndex, step, formatters) => {
    const templatePath = path.join(templateDir, templateFile);
    const fileNamePattern = path.join(outputDir, step.target || '', templateFile);

    // Select stage produces the source items
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

    // Run through the pipeline
    const results: WrittenItem[] = [];
    for await (const item of processingPipeline(source)) {
      results.push(item);
    }
    return results;
  };
}
