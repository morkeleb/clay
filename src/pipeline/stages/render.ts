// src/pipeline/stages/render.ts
import path from 'path';
import fs from 'fs';
import handlebars from '../../template-engine';
import * as ui from '../../output';
import type { Stage, SelectItem, RenderedItem } from '../types';

const templateCache = new Map<string, HandlebarsTemplateDelegate>();
const MAX_TEMPLATE_CACHE_SIZE = 1000;
const fileNameTemplateCache = new Map<string, HandlebarsTemplateDelegate>();

export function clearRenderCache(): void {
  templateCache.clear();
  fileNameTemplateCache.clear();
}

function getTemplate(filePath: string): HandlebarsTemplateDelegate {
  if (!templateCache.has(filePath)) {
    if (templateCache.size >= MAX_TEMPLATE_CACHE_SIZE) {
      templateCache.clear();
    }
    const content = fs.readFileSync(filePath, 'utf8');
    templateCache.set(filePath, handlebars.compile(content));
  }
  return templateCache.get(filePath)!;
}

function getFileNameTemplate(pattern: string): HandlebarsTemplateDelegate {
  if (!fileNameTemplateCache.has(pattern)) {
    // Normalize to forward slashes to prevent Handlebars backslash escape issues on Windows
    const normalized = pattern.split(path.sep).join('/');
    fileNameTemplateCache.set(pattern, handlebars.compile(normalized));
  }
  return fileNameTemplateCache.get(pattern)!;
}

/**
 * Renders Handlebars template with model data.
 * Skips touch files that already exist on disk.
 * Input: SelectItem (model data + template path)
 * Output: RenderedItem (filename + rendered content)
 */
export function createRenderStage(
  onRender?: (filename: string) => void,
  onTouchSkip?: (filename: string) => void
): Stage<SelectItem, RenderedItem> {
  return async function* (input) {
    for await (const item of input) {
      const fileNameTemplate = getFileNameTemplate(item.fileNamePattern);
      const filename = path.resolve(fileNameTemplate(item.modelData));

      // Skip touch files that already exist — they're user-customizable scaffolds
      if (item.step.touch && fs.existsSync(filename)) {
        ui.info('skipping touch file:', filename);
        onTouchSkip?.(filename);
        continue;
      }

      const template = getTemplate(item.templatePath);
      const content = template(item.modelData);

      onRender?.(filename);
      yield {
        filename,
        content,
        step: item.step,
        modelIndex: item.modelIndex,
      };
    }
  };
}
