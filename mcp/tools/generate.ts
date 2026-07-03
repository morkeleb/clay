/**
 * clay_generate tool - Generate code from Clay models
 * Calls the pipeline API directly for performance (no subprocess).
 */
import type { GenerateInput } from '../shared/schemas.js';
import { validateInput } from '../shared/validation.js';
import { GenerateInputSchema } from '../shared/schemas.js';
import path from 'path';
import { createRequire } from 'node:module';
import {
  requireClayFile,
  resolvePath,
} from '../shared/workspace-manager.js';
import { readClayFile } from '../shared/clay-wrapper.js';

const require = createRequire(import.meta.url);

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

    // Load the generate API from the main Clay package
    const { generate } = require('clay-generator/generate-api');

    if (input.model_path && input.output_path) {
      // Generate specific model
      const userDir = input.working_directory
        ? path.resolve(input.working_directory)
        : process.cwd();
      const absoluteModelPath = resolvePath(userDir, input.model_path);
      const absoluteOutputPath = resolvePath(userDir, input.output_path);
      const modelPath = path.relative(clayRoot, absoluteModelPath);
      const outputPath = path.relative(clayRoot, absoluteOutputPath);

      const result = await generate(clayRoot, {
        modelPath,
        outputPath,
        workers: true,
        force: input.force,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Successfully generated code',
                stats: {
                  modelsProcessed: result.modelsProcessed,
                  modelsSkipped: result.modelsSkipped,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } else {
      // Generate all models
      const result = await generate(clayRoot, { workers: true, force: input.force });

      // Read .clay file for model metadata
      const clayData = readClayFile(context.clayFilePath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Successfully regenerated all models`,
                models_processed: result.modelsProcessed,
                models_skipped: result.modelsSkipped,
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
    // PreCheckFailedError carries the aggregated violations — surface them
    // as structured data so callers see every violation, not just a string.
    const violations = (error as { violations?: unknown })?.violations;
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              message: `Error: ${errorMessage}`,
              ...(Array.isArray(violations)
                ? { precheck_violations: violations }
                : {}),
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
