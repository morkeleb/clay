/**
 * clay_clean tool - Clean up generated files
 */
import { validateInput } from '../shared/validation.js';
import { CleanInputSchema } from '../shared/schemas.js';
import path from 'path';
import {
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
    const context = requireClayFile(input.working_directory);
    const clayRoot = context.workingDirectory;

    let commandArgs: string[] = [];
    if (input.model_path && input.output_path) {
      const userDir = input.working_directory
        ? path.resolve(input.working_directory)
        : process.cwd();
      const absoluteModelPath = resolvePath(userDir, input.model_path);
      const absoluteOutputPath = resolvePath(userDir, input.output_path);
      commandArgs = [
        path.relative(clayRoot, absoluteModelPath),
        path.relative(clayRoot, absoluteOutputPath),
      ];
    }

    const result = executeClayCommand('clean', commandArgs, clayRoot);

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
