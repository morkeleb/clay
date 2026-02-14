/**
 * clay_model_delete tool - Remove items matched by JSONPath
 * Uses the raw model file (preserves include/mixin references)
 */
import { validateInput } from '../shared/validation.js';
import { ModelDeleteInputSchema } from '../shared/schemas.js';
import { readModelFile, writeModelFile } from '../shared/model-file.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';

export async function modelDeleteTool(args: unknown) {
  const validation = validateInput(ModelDeleteInputSchema, args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: validation.error }, null, 2) }],
    };
  }

  const input = validation.data;

  try {
    const context = getWorkspaceContext(input.working_directory);
    const fullModelPath = resolvePath(context.workingDirectory, input.model_path);
    const modelData = readModelFile(fullModelPath);

    let paths: (string | number)[][];
    try {
      paths = jp.paths(modelData, input.json_path);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`,
        }, null, 2) }],
      };
    }

    if (paths.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `No items matched JSONPath: ${input.json_path}`,
        }, null, 2) }],
      };
    }

    // Sort in reverse order so array indices stay valid during removal
    const sorted = [...paths].reverse();
    let removed = 0;

    for (const pathComponents of sorted) {
      const parentPath = pathComponents.slice(0, -1);
      const key = pathComponents[pathComponents.length - 1];
      const parent = jp.query(modelData, jp.stringify(parentPath))[0];

      if (Array.isArray(parent) && typeof key === 'number') {
        parent.splice(key, 1);
        removed++;
      } else if (typeof parent === 'object' && parent !== null) {
        delete (parent as Record<string, unknown>)[key as string];
        removed++;
      }
    }

    writeModelFile(fullModelPath, modelData);

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true,
        message: `Removed ${removed} item(s) at ${input.json_path}`,
        removed,
      }, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: errorMessage }, null, 2) }],
    };
  }
}
