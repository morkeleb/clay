/**
 * clay_model_query tool - Query model data using JSONPath
 * Uses the expanded model (includes resolved, mixins applied)
 */
import { validateInput } from '../shared/validation.js';
import { ModelQueryInputSchema } from '../shared/schemas.js';
import { readExpandedModel } from '../shared/model-file.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';

export async function modelQueryTool(args: unknown) {
  const validation = validateInput(ModelQueryInputSchema, args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: validation.error }, null, 2) }],
    };
  }

  const input = validation.data;

  try {
    const context = getWorkspaceContext(input.working_directory);
    const fullModelPath = resolvePath(context.workingDirectory, input.model_path);
    const modelData = readExpandedModel(fullModelPath);

    let results: unknown[];
    try {
      results = jp.query(modelData, input.json_path);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`,
        }, null, 2) }],
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true,
        count: results.length,
        results,
      }, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: errorMessage }, null, 2) }],
    };
  }
}
