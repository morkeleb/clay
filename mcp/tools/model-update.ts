/**
 * clay_model_update tool - Update fields on items matched by JSONPath
 * Uses the raw model file (preserves include/mixin references)
 */
import { validateInput } from '../shared/validation.js';
import { ModelUpdateInputSchema } from '../shared/schemas.js';
import { readModelFile, writeModelFile } from '../shared/model-file.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';

export async function modelUpdateTool(args: unknown) {
  const validation = validateInput(ModelUpdateInputSchema, args);
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

    let matches: unknown[];
    try {
      matches = jp.query(modelData, input.json_path);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`,
        }, null, 2) }],
      };
    }

    if (matches.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `No items matched JSONPath: ${input.json_path}`,
        }, null, 2) }],
      };
    }

    let updated = 0;
    for (const match of matches) {
      if (typeof match === 'object' && match !== null && !Array.isArray(match)) {
        Object.assign(match, input.fields);
        updated++;
      }
    }

    writeModelFile(fullModelPath, modelData);

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true,
        message: `Updated ${updated} item(s) at ${input.json_path}`,
        matched: updated,
      }, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: errorMessage }, null, 2) }],
    };
  }
}
