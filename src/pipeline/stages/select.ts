// src/pipeline/stages/select.ts
import * as jph from '../../jsonpath-helper';
import type { SelectItem } from '../types';
import type { GeneratorStepGenerate } from '../../types/generator';
import type { ClayModelEntry } from '../../types/clay-file';

/**
 * Creates an async generator that yields one SelectItem per JSONPath match.
 * This is a source stage — it doesn't take input, it produces output.
 */
export function createSelectStage(
  model: unknown,
  jsonPath: string,
  templatePath: string,
  fileNamePattern: string,
  outputDir: string,
  step: GeneratorStepGenerate,
  modelIndex: ClayModelEntry
): AsyncGenerator<SelectItem> {
  const matches = jph.select(model, jsonPath);

  async function* generate(): AsyncGenerator<SelectItem> {
    for (const modelData of matches) {
      yield {
        modelData,
        templatePath,
        fileNamePattern,
        outputDir,
        step,
        modelIndex,
      };
    }
  }

  return generate();
}
