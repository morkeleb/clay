// src/pipeline/stages/render.ts
import path from 'path';
import fs from 'fs';
import * as ui from '../../output';
import { getCompiledTemplate, compileTemplate } from '../template-cache';
import type { Stage, SelectItem, RenderedItem } from '../types';

/**
 * Renders Handlebars template with model data.
 * Skips touch files that already exist on disk.
 * Input: SelectItem (model data + template path)
 * Output: RenderedItem (filename + rendered content + formatters)
 */
export function createRenderStage(
  onRender?: (filename: string) => void,
  onTouchSkip?: (filename: string) => void
): Stage<SelectItem, RenderedItem> {
  return async function* (input) {
    for await (const item of input) {
      const fileNameTemplate = compileTemplate(
        item.fileNamePattern,
        `filename:${item.fileNamePattern}`
      );
      const filename = path.resolve(fileNameTemplate(item.modelData));

      // Skip touch files that already exist — they're user-customizable scaffolds
      if (item.step.touch && fs.existsSync(filename)) {
        if (onTouchSkip) {
          onTouchSkip(filename);
        } else {
          ui.info('skipping touch file:', filename);
        }
        continue;
      }

      const template = getCompiledTemplate(item.templatePath);
      const content = template(item.modelData);

      onRender?.(filename);
      yield {
        filename,
        content,
        step: item.step,
        modelIndex: item.modelIndex,
        formatters: item.formatters,
      };
    }
  };
}
