// src/pipeline/stages/write.ts
import fs from 'fs/promises';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';
import * as ui from '../../output';
import type { Stage, FormattedItem, WrittenItem } from '../types';

/**
 * Writes formatted content to disk and updates checksum.
 * Input: FormattedItem
 * Output: WrittenItem
 */
export function createWriteStage(
  onWrite?: (filename: string) => void
): Stage<FormattedItem, WrittenItem> {
  return async function* (input) {
    for await (const item of input) {
      const dir = path.dirname(item.filename);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      ui.write(item.filename);
      await fs.writeFile(item.filename, item.content, 'utf8');
      onWrite?.(item.filename);

      if (!item.step.touch) {
        item.modelIndex.setFileCheckSum(item.filename, item.md5);
      }

      yield {
        filename: item.filename,
        md5: item.md5,
        step: item.step,
        modelIndex: item.modelIndex,
      };
    }
  };
}
