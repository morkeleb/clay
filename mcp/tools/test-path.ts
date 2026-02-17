/**
 * clay_test_path tool - Test JSONPath expressions
 * Uses the expanded model (includes resolved, mixins applied) for consistency
 * with clay_model_query and clay_model_update.
 */
import { validateInput, validateJSONPath } from '../shared/validation.js';
import { TestPathInputSchema } from '../shared/schemas.js';
import {
  getWorkspaceContext,
  resolvePath,
} from '../shared/workspace-manager.js';
import { readExpandedModel } from '../shared/model-file.js';
import jp from 'jsonpath';

export async function testPathTool(args: unknown) {
  const validation = validateInput(TestPathInputSchema, args);
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

  // Validate JSONPath
  const jsonPathValidation = validateJSONPath(input.json_path);
  if (!jsonPathValidation.valid) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              message: `Invalid JSONPath: ${jsonPathValidation.error}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  try {
    const context = getWorkspaceContext(input.working_directory);
    const workingDir = context.workingDirectory;
    const modelPath = resolvePath(workingDir, input.model_path);
    const modelData = readExpandedModel(modelPath);

    let results: unknown[];
    try {
      results = jp.query(modelData, input.json_path);
    } catch (e) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              count: results.length,
              results,
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
