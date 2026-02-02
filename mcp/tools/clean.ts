/**
 * clay_clean tool - Clean up generated files
 */
import { validateInput } from '../shared/validation.js';
import { CleanInputSchema } from '../shared/schemas.js';
import {
  getWorkspaceContext,
  requireClayFile,
  resolvePath,
} from '../shared/workspace-manager.js';
import { executeClayCommand, readClayFile } from '../shared/clay-wrapper.js';

export async function cleanTool(args: unknown) {
  const validation = validateInput(CleanInputSchema, args);
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
    const context = input.model_path
      ? getWorkspaceContext(input.working_directory)
      : requireClayFile(input.working_directory);

    const workingDir = context.workingDirectory;

    const commandArgs =
      input.model_path && input.output_path
        ? [
            resolvePath(workingDir, input.model_path),
            resolvePath(workingDir, input.output_path),
          ]
        : [];

    const result = executeClayCommand('clean', commandArgs, workingDir);

    if (!result.success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: `Failed to clean: ${result.error}`,
                output: result.output,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const clayData = context.hasClayFile
      ? readClayFile(context.clayFilePath)
      : null;
    const modelsCount = input.model_path ? 1 : (clayData?.models.length ?? 0);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Successfully cleaned generated files',
              models_cleaned: modelsCount,
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
