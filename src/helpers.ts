/**
 * Extract Clay helpers as a plain object for use in EJS and TypeScript engines.
 * Handlebars registers helpers internally — this module provides them as callable functions.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import handlebars from './template-engine';
import type { ClayHelpers } from './code-generator';

let cachedHelpers: ClayHelpers | null = null;

/**
 * Returns all Clay helpers as a plain object.
 * Filters out Handlebars-specific block helpers that don't work outside of templates.
 */
export function getHelpers(): ClayHelpers {
  if (cachedHelpers) return cachedHelpers;

  const hbHelpers = (handlebars as any).helpers;
  const helpers: Record<string, (...args: any[]) => any> = {};

  // Block helpers that only work in Handlebars template context
  // (they use options.fn(this) / options.inverse(this) patterns)
  const blockHelpers = new Set([
    'helperMissing', 'blockHelperMissing', 'each', 'if', 'unless', 'with',
    'log', 'lookup', 'switch', 'case', 'default', 'times',
    'ifCond', 'eachUnique', 'eachUniqueJSONPath', 'group',
  ]);

  for (const [name, fn] of Object.entries(hbHelpers)) {
    if (typeof fn === 'function' && !blockHelpers.has(name)) {
      helpers[name] = fn as (...args: any[]) => any;
    }
  }

  // Override `and` and `or` — the Handlebars versions strip/include the
  // options hash argument, which breaks when called as plain functions
  helpers.and = (...args: any[]) => args.every(Boolean);
  helpers.or = (...args: any[]) => args.some(Boolean);

  cachedHelpers = helpers as ClayHelpers;
  return cachedHelpers;
}
