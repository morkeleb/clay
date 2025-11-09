/**
 * clay_init tool - Initialize Clay projects or generators
 */
import { validateInput } from '../shared/validation.js';
import { InitInputSchema } from '../shared/schemas.js';
import { getWorkspaceContext } from '../shared/workspace-manager.js';
import { executeClayCommand } from '../shared/clay-wrapper.js';

export async function initTool(args: unknown) {
  const validation = validateInput(InitInputSchema, args);
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

  // Validate generator name if type is generator
  if (input.type === 'generator' && !input.name) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              message: 'Generator name is required when type is "generator"',
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

    const commandArgs =
      input.type === 'generator' && input.name
        ? ['init', 'generator', input.name]
        : ['init'];

    const result = executeClayCommand(
      commandArgs[0],
      commandArgs.slice(1),
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
                message: `Failed to initialize: ${result.error}`,
                output: result.output,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const nextSteps =
      input.type === 'project'
        ? [
            'Create your first model in ./clay/model.json',
            'Add generators to the model',
            'Run clay_generate to generate code',
          ]
        : [
            `Edit the generator at ./clay/generators/${input.name}/generator.json`,
            'Add template files',
            'Reference the generator in your model',
          ];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Successfully initialized ${input.type}`,
              created_files:
                input.type === 'project'
                  ? ['.clay']
                  : [`clay/generators/${input.name}/generator.json`],
              next_steps: nextSteps,
              raw_output: result.output,
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
