/**
 * Shared helpers for reading, writing, and validating Clay model files.
 *
 * - readModelFile: raw JSON.parse (preserves includes/mixins)
 * - readExpandedModel: uses Clay's model.load() to resolve includes & mixins
 * - writeModelFile: optionally validates against $schema, then writes formatted JSON
 * - validateAgainstSchema: validates data against a JSON Schema using Ajv
 */

import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv from 'ajv';

const require = createRequire(import.meta.url);
const ajv = new Ajv({ allErrors: true });

/**
 * Raw JSON.parse of a model file.
 * Used by mutation tools to preserve include references and mixin definitions.
 */
export function readModelFile(modelPath: string): Record<string, unknown> {
  const resolved = path.resolve(modelPath);
  const content = fs.readFileSync(resolved, 'utf-8');
  const parsed = JSON.parse(content);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Model file ${modelPath} must contain a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Uses Clay's model.load() to resolve includes and apply mixins.
 * Returns the fully expanded model object.
 */
export function readExpandedModel(modelPath: string): {
  name: string;
  generators: string[];
  mixins?: unknown[];
  model: Record<string, unknown>;
} {
  const clayModel = require('../../dist/src/model.js');
  return clayModel.load(modelPath);
}

/**
 * Uses Clay's model.loadWithIncludeMap() to resolve includes (with tracking) and apply mixins.
 * Returns the expanded model plus a map of object references to their source file paths.
 */
export function readExpandedModelWithIncludeMap(modelPath: string): {
  model: { name: string; generators: string[]; mixins?: unknown[]; model: Record<string, unknown> };
  includeMap: Map<object, string>;
} {
  const clayModel = require('../../dist/src/model.js');
  return clayModel.loadWithIncludeMap(modelPath);
}

/**
 * Validate data against a JSON Schema file using Ajv.
 * @returns Array of error strings (empty if valid).
 */
export function validateAgainstSchema(
  data: unknown,
  schemaPath: string
): string[] {
  const resolved = path.resolve(schemaPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Schema file not found: ${resolved}`);
  }

  const schemaContent = fs.readFileSync(resolved, 'utf-8');
  const schema = JSON.parse(schemaContent);

  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return [];
  }

  return (validate.errors ?? []).map((err) => {
    return `${err.instancePath}: ${err.message}`;
  });
}

/**
 * Write a model file as formatted JSON.
 * If the data contains a `$schema` property, validates data.model against it first.
 */
export function writeModelFile(
  modelPath: string,
  data: Record<string, unknown>
): void {
  if (data['$schema'] && typeof data['$schema'] === 'string') {
    const schemaRelative = data['$schema'] as string;
    const resolvedSchema = path.resolve(
      path.dirname(modelPath),
      schemaRelative
    );
    const errors = validateAgainstSchema(data.model, resolvedSchema);
    if (errors.length > 0) {
      throw new Error(
        'Schema validation failed:\n' + errors.join('\n')
      );
    }
  }

  const resolved = path.resolve(modelPath);
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
