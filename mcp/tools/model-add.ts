/**
 * clay_model_add tool - Add items to arrays or properties to objects at a JSONPath location
 * Uses the raw model file (preserves include/mixin references)
 */
import { validateInput } from '../shared/validation.js';
import { ModelAddInputSchema } from '../shared/schemas.js';
import { readModelFile, writeModelFile } from '../shared/model-file.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';

export async function modelAddTool(args: unknown) {
  const validation = validateInput(ModelAddInputSchema, args);
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

    let targets: unknown[];
    try {
      targets = jp.query(modelData, input.json_path);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`,
        }, null, 2) }],
      };
    }

    if (targets.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `No items matched JSONPath: ${input.json_path}`,
        }, null, 2) }],
      };
    }

    const target = targets[0];
    if (Array.isArray(target)) {
      target.push(input.value);
    } else if (typeof target === 'object' && target !== null) {
      Object.assign(target, input.value);
    } else {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: 'Target is not an array or object',
        }, null, 2) }],
      };
    }

    writeModelFile(fullModelPath, modelData);

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true,
        message: `Added value at ${input.json_path}`,
        path: input.json_path,
      }, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: errorMessage }, null, 2) }],
    };
  }
}
