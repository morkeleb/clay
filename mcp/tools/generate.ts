/**
 * clay_generate tool - Generate code from Clay models
 */
import type { GenerateInput } from '../shared/schemas.js';
import { validateInput } from '../shared/validation.js';
import { GenerateInputSchema } from '../shared/schemas.js';
import path from 'path';
import {
  requireClayFile,
  resolvePath,
} from '../shared/workspace-manager.js';
import {
  executeClayCommand,
  readClayFile,
  parseGenerateOutput,
} from '../shared/clay-wrapper.js';

export async function generateTool(args: unknown) {
  // Validate input
  const validation = validateInput(GenerateInputSchema, args);
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
    // Resolve to the nearest directory containing .clay (walks up the tree)
    const context = requireClayFile(input.working_directory);
    const clayRoot = context.workingDirectory;

    // Determine what to generate
    if (input.model_path && input.output_path) {
      // Generate specific model — resolve from user's working directory,
      // then make relative to the .clay root so the CLI stores clean paths
      const userDir = input.working_directory
        ? path.resolve(input.working_directory)
        : process.cwd();
      const absoluteModelPath = resolvePath(userDir, input.model_path);
      const absoluteOutputPath = resolvePath(userDir, input.output_path);
      const modelPath = path.relative(clayRoot, absoluteModelPath);
      const outputPath = path.relative(clayRoot, absoluteOutputPath);

      const result = executeClayCommand(
        'generate',
        [modelPath, outputPath],
        clayRoot
      );

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message: `Failed to generate: ${result.error}`,
                  output: result.output,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const stats = parseGenerateOutput(result.output);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Successfully generated code',
                stats: {
                  filesGenerated: stats.filesGenerated,
                  filesCopied: stats.filesCopied,
                  commandsExecuted: stats.commandsExecuted,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } else {
      // Generate all models from .clay file
      const result = executeClayCommand('generate', [], clayRoot);

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message: `Failed to generate: ${result.error}`,
                  output: result.output,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Read .clay file to get model count
      const clayData = readClayFile(context.clayFilePath);
      const stats = parseGenerateOutput(result.output);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Successfully regenerated all models`,
                models_processed: clayData.models.length,
                total_files_generated: stats.filesGenerated,
                total_files_copied: stats.filesCopied,
                total_commands_executed: stats.commandsExecuted,
                models: clayData.models.map((m) => ({
                  model_path: m.path,
                  output_path: m.output,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
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
