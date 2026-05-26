// src/pipeline/stages/format.ts
import minimatch from 'minimatch';
import * as ui from '../../output';
import type { Stage, ChangedItem, FormattedItem } from '../types';
import type { FormatterCache } from '../formatter-cache';

/**
 * Applies formatter chain to content.
 * Reads formatter config from each item (carried from the generator).
 * Input: ChangedItem (has formatters)
 * Output: FormattedItem (formatters consumed — no longer carried)
 */
export function createFormatStage(
  cache: FormatterCache,
  onFormat?: (filename: string) => void
): Stage<ChangedItem, FormattedItem> {
  return async function* (input) {
    for await (const item of input) {
      let content = item.content;

      for (const spec of item.formatters) {
        const formatter = cache.get(spec.pkg);

        const shouldApply = Array.isArray(formatter.extensions)
          ? formatter.extensions.some((ext) => minimatch(item.filename, ext))
          : true;

        if (!shouldApply) continue;

        try {
          if (spec.isNew) {
            content = await formatter.apply(item.filename, content, spec.options, item.step);
          } else {
            content = await formatter.apply(item.filename, content);
          }
        } catch (e) {
          ui.warn(
            'Failed to apply formatter for:',
            item.filename,
            'This is probably not due to Clay but the formatter itself',
            e
          );
          throw e;
        }
      }

      onFormat?.(item.filename);
      yield {
        filename: item.filename,
        content,
        md5: item.md5,
        step: item.step,
        modelIndex: item.modelIndex,
      };
    }
  };
}
