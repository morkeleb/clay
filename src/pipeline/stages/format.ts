// src/pipeline/stages/format.ts
import minimatch from 'minimatch';
import * as ui from '../../output';
import type { Stage, ChangedItem, FormattedItem } from '../types';
import type { Generator } from '../../types/generator';
import type { FormatterCache } from '../formatter-cache';

/**
 * Applies formatter chain to content.
 * Input: ChangedItem
 * Output: FormattedItem
 */
export function createFormatStage(
  generator: Generator,
  cache: FormatterCache,
  onFormat?: (filename: string) => void
): Stage<ChangedItem, FormattedItem> {
  const formatters = generator.formatters || [];

  return async function* (input) {
    for await (const item of input) {
      let content = item.content;

      for (const fmt of formatters) {
        const pkg = typeof fmt === 'string' ? fmt : (fmt as { package: string }).package;
        const options =
          typeof fmt === 'string' ? {} : ((fmt as { options?: Record<string, unknown> }).options || {});
        const isNew = typeof fmt !== 'string';

        const formatter = cache.get(pkg);

        const shouldApply = Array.isArray(formatter.extensions)
          ? formatter.extensions.some((ext) => minimatch(item.filename, ext))
          : true;

        if (!shouldApply) continue;

        try {
          if (isNew) {
            content = await formatter.apply(item.filename, content, options, item.step);
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
        _brand: 'formatted' as const,
        filename: item.filename,
        content,
        md5: item.md5,
        step: item.step,
        modelIndex: item.modelIndex,
      };
    }
  };
}
