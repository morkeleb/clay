// src/pipeline/stages/hash.ts
import crypto from 'crypto';
import type { Stage, RenderedItem, ChangedItem } from '../types';

/**
 * Computes MD5 hash and filters out items whose checksum hasn't changed.
 * Input: RenderedItem
 * Output: ChangedItem (only items that differ from stored checksum)
 */
export function createHashStage(
  onSkip?: (filename: string) => void
): Stage<RenderedItem, ChangedItem> {
  return async function* (input) {
    for await (const item of input) {
      const md5 = crypto.createHash('md5').update(item.content).digest('hex');
      const storedChecksum = item.modelIndex.getFileCheckSum(item.filename);

      if (storedChecksum !== md5) {
        yield {
          _brand: 'changed' as const,
          filename: item.filename,
          content: item.content,
          md5,
          step: item.step,
          modelIndex: item.modelIndex,
        };
      } else {
        onSkip?.(item.filename);
      }
    }
  };
}
