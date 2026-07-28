// src/pipeline/stages/render.ts
import path from 'path';
import fs from 'fs';
import * as ui from '../../output';
import { compileTemplate } from '../template-cache';
import { renderWithEngine } from '../engines';
import type { Stage, SelectItem, RenderedItem } from '../types';
import type { ClayModelEntry } from '../../types/clay-file';

/**
 * Renders templates with model data using the configured engine.
 * Skips touch files that already exist on disk.
 * Input: SelectItem (model data + template path)
 * Output: RenderedItem (filename + rendered content + formatters)
 *
 * Existing touch files are reported via onOwnedPath so orphan cleanup never
 * deletes a scaffold that is still selected this pass.
 */
export function createRenderStage(
  onRender?: (filename: string) => void,
  onTouchSkip?: (filename: string) => void,
  onOwnedPath?: (
    filename: string,
    isTouch: boolean,
    modelIndex: ClayModelEntry
  ) => void
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
        onOwnedPath?.(filename, true, item.modelIndex);
        if (onTouchSkip) {
          onTouchSkip(filename);
        } else {
          ui.info('skipping touch file:', filename);
        }
        continue;
      }

      const engine = item.step.engine ?? 'handlebars';
      const content = await renderWithEngine(
        engine,
        item.templatePath,
        item.modelData
      );

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
