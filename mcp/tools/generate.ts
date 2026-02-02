/**
 * clay_generate tool - Generate code from Clay models
 */
import type { GenerateInput } from '../shared/schemas.js';
import { validateInput } from '../shared/validation.js';
import { GenerateInputSchema } from '../shared/schemas.js';
import {
  getWorkspaceContext,
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
    // Get workspace context
    const context = input.model_path
      ? getWorkspaceContext(input.working_directory)
      : requireClayFile(input.working_directory);

    const workingDir = context.workingDirectory;

    // Determine what to generate
    if (input.model_path && input.output_path) {
      // Generate specific model
      const modelPath = resolvePath(workingDir, input.model_path);
      const outputPath = resolvePath(workingDir, input.output_path);

      const result = executeClayCommand(
        'generate',
        [modelPath, outputPath],
        workingDir
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
      if (!context.hasClayFile) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message:
                    'No .clay file found and no model_path provided. Run clay_init first to create a .clay file.',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const result = executeClayCommand('generate', [], workingDir);

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
