/**
 * clay_get_model_structure tool - Get model structure and metadata
 * Returns a structural summary (keys, array lengths, nested shape) instead of
 * the full model data to avoid exceeding MCP token limits on large models.
 */
import { validateInput } from '../shared/validation.js';
import { GetModelStructureInputSchema } from '../shared/schemas.js';
import { requireClayFile } from '../shared/workspace-manager.js';
import { readClayFile } from '../shared/clay-wrapper.js';
import fs from 'fs';
import path from 'path';

/**
 * Summarize a value's structure recursively.
 * Arrays: show length and summarize items (first element as representative).
 * Objects: show keys and recurse up to maxDepth.
 * Primitives: show type and value (truncated for strings).
 */
function summarizeStructure(value: unknown, depth: number, maxDepth: number): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    const summary: Record<string, unknown> = {
      _type: 'array',
      _length: value.length,
    };
    if (value.length > 0 && depth < maxDepth) {
      // Summarize first item as representative
      summary._items = summarizeStructure(value[0], depth + 1, maxDepth);
      // For arrays of objects, also list unique 'name' values if present
      if (typeof value[0] === 'object' && value[0] !== null && 'name' in value[0]) {
        summary._names = value
          .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null && 'name' in v)
          .map((v) => v.name);
      }
    }
    return summary;
  }

  if (typeof value === 'object') {
    if (depth >= maxDepth) {
      const keys = Object.keys(value as Record<string, unknown>);
      return { _type: 'object', _keys: keys };
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = summarizeStructure(v, depth + 1, maxDepth);
    }
    return result;
  }

  if (typeof value === 'string') {
    return value.length > 100 ? `${value.substring(0, 100)}...` : value;
  }

  return value;
}

export async function getModelStructureTool(args: unknown) {
  const validation = validateInput(GetModelStructureInputSchema, args);
  if (!validation.success) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              message: validation.error,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const input = validation.data;

  try {
    const context = requireClayFile(input.working_directory);
    const clayData = readClayFile(context.clayFilePath);

    const models = clayData.models.map((model) => {
      let modelKeys: string[] = [];
      let generators: string[] = [];
      let structure: unknown = null;

      try {
        const modelFilePath = path.isAbsolute(model.path)
          ? model.path
          : path.resolve(context.workingDirectory, model.path);

        if (fs.existsSync(modelFilePath)) {
          const modelContent = fs.readFileSync(modelFilePath, 'utf8');
          const modelData = JSON.parse(modelContent);

          // Extract top-level keys
          modelKeys = Object.keys(modelData);

          // Extract generators if present
          if (modelData.generators && Array.isArray(modelData.generators)) {
            generators = modelData.generators.map((g: any) =>
              typeof g === 'string' ? g : g.path || g.name || 'unknown'
            );
          }

          // Summarize structure instead of including raw data
          structure = summarizeStructure(modelData, 0, 4);
        }
      } catch (error) {
        // Model file couldn't be loaded, continue with partial data
      }

      return {
        path: model.path,
        output: model.output,
        name: model.path.split('/').pop()?.replace('.json', '') || 'unknown',
        generators,
        model_keys: modelKeys,
        structure,
        file_count: Object.keys(model.generated_files || {}).length,
        last_generated: model.last_generated,
      };
    });

    // If specific model requested, filter by matching path (handle both absolute and relative)
    let filteredModels = models;
    if (input.model_path) {
      const normalizedInputPath = path.normalize(input.model_path);
      filteredModels = models.filter((m) => {
        const modelAbsPath = path.isAbsolute(m.path)
          ? path.normalize(m.path)
          : path.normalize(path.resolve(context.workingDirectory, m.path));
        const inputAbsPath = path.isAbsolute(normalizedInputPath)
          ? normalizedInputPath
          : path.normalize(path.resolve(context.workingDirectory, normalizedInputPath));

        return modelAbsPath === inputAbsPath || path.normalize(m.path) === normalizedInputPath;
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              models: filteredModels,
              total_models: clayData.models.length,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              message: `Error: ${errorMessage}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
