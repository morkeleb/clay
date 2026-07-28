// src/pipeline/stages/hash.ts
import crypto from 'crypto';
import fs from 'fs';
import type { Stage, RenderedItem, ChangedItem } from '../types';
import type { ClayModelEntry } from '../../types/clay-file';

/**
 * Computes MD5 hash and filters out items whose checksum hasn't changed.
 * Input: RenderedItem
 * Output: ChangedItem (only items that differ from stored checksum)
 *
 * onOwnedPath is invoked for every item that reaches this stage (including
 * hash-skipped unchanged files and touch outputs that were rendered as new).
 * Callers should mark both touch and non-touch into the expected/protected set.
 *
 * Items whose checksum matches but are missing on disk are not skipped — that
 * is ledger drift and must rewrite the file.
 */
export function createHashStage(
  onSkip?: (filename: string) => void,
  onOwnedPath?: (
    filename: string,
    isTouch: boolean,
    modelIndex: ClayModelEntry
  ) => void
): Stage<RenderedItem, ChangedItem> {
  return async function* (input) {
    for await (const item of input) {
      onOwnedPath?.(item.filename, !!item.step.touch, item.modelIndex);

      const md5 = crypto.createHash('md5').update(item.content).digest('hex');
      const storedChecksum = item.modelIndex.getFileCheckSum(item.filename);
      const missingOnDisk = !fs.existsSync(item.filename);

      if (storedChecksum !== md5 || missingOnDisk) {
        yield {
          filename: item.filename,
          content: item.content,
          md5,
          step: item.step,
          modelIndex: item.modelIndex,
          formatters: item.formatters,
        };
      } else {
        onSkip?.(item.filename);
      }
    }
  };
}
