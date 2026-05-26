// src/pipeline/stages/render.ts
import path from 'path';
import fs from 'fs';
import handlebars from '../../template-engine';
import type { Stage, SelectItem, RenderedItem } from '../types';

const templateCache = new Map<string, HandlebarsTemplateDelegate>();

export function clearRenderCache(): void {
  templateCache.clear();
}

function getTemplate(filePath: string): HandlebarsTemplateDelegate {
  if (!templateCache.has(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    templateCache.set(filePath, handlebars.compile(content));
  }
  return templateCache.get(filePath)!;
}

/**
 * Renders Handlebars template with model data.
 * Input: SelectItem (model data + template path)
 * Output: RenderedItem (filename + rendered content)
 */
export function createRenderStage(): Stage<SelectItem, RenderedItem> {
  return async function* (input) {
    for await (const item of input) {
      const template = getTemplate(item.templatePath);
      const fileNameTemplate = handlebars.compile(item.fileNamePattern);
      const filename = path.resolve(fileNameTemplate(item.modelData));
      const content = template(item.modelData);

      yield {
        filename,
        content,
        step: item.step,
        modelIndex: item.modelIndex,
      };
    }
  };
}
