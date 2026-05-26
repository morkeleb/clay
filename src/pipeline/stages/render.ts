// src/pipeline/stages/render.ts
import fs from 'fs';
import * as ui from '../../output';
import { getCompiledTemplate, compileTemplate } from '../template-cache';
import type { Stage, SelectItem, RenderedItem } from '../types';
import type { RenderWorkerPool } from '../worker-pool';

/**
 * Renders Handlebars template with model data.
 * Skips touch files that already exist on disk.
 *
 * When a worker pool is provided, rendering is dispatched to worker threads
 * for true multi-core parallelism. Otherwise falls back to main-thread rendering.
 *
 * Input: SelectItem (model data + template path)
 * Output: RenderedItem (filename + rendered content + formatters)
 */
export function createRenderStage(
  onRender?: (filename: string) => void,
  onTouchSkip?: (filename: string) => void,
  workerPool?: RenderWorkerPool
): Stage<SelectItem, RenderedItem> {
  return async function* (input) {
    for await (const item of input) {
      // Resolve filename first (fast, main thread) for touch check
      const fileNameTemplate = compileTemplate(
        item.fileNamePattern,
        `filename:${item.fileNamePattern}`
      );
      const filename = fileNameTemplate(item.modelData);
      const resolvedFilename = require('path').resolve(filename);

      // Skip touch files that already exist
      if (item.step.touch && fs.existsSync(resolvedFilename)) {
        if (onTouchSkip) {
          onTouchSkip(resolvedFilename);
        } else {
          ui.info('skipping touch file:', resolvedFilename);
        }
        continue;
      }

      let content: string;

      if (workerPool) {
        // Dispatch to worker thread for parallel rendering
        const result = await workerPool.render(
          item.templatePath,
          item.fileNamePattern,
          item.modelData,
          item.partials as string[],
          item.partialsDir
        );
        content = result.content;
      } else {
        // Fallback: render on main thread
        const template = getCompiledTemplate(item.templatePath);
        content = template(item.modelData);
      }

      onRender?.(resolvedFilename);
      yield {
        filename: resolvedFilename,
        content,
        step: item.step,
        modelIndex: item.modelIndex,
        formatters: item.formatters,
      };
    }
  };
}
