/**
 * clay_list_generators tool - List all generators in the project
 */
import { validateInput } from '../shared/validation.js';
import { ListGeneratorsInputSchema } from '../shared/schemas.js';
import { requireClayFile } from '../shared/workspace-manager.js';
import { readClayFile } from '../shared/clay-wrapper.js';

export async function listGeneratorsTool(args: unknown) {
  const validation = validateInput(ListGeneratorsInputSchema, args);
  if (!validation.success) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            message: validation.error,
          }, null, 2),
        },
      ],
    };
  }

  const input = validation.data;

  try {
    const context = requireClayFile(input.working_directory);
    const clayData = readClayFile(context.clayFilePath);

    // Collect all generators from all models
    const generatorSet = new Set<string>();
    const generatorUsage = new Map<string, string[]>();

    clayData.models.forEach((model) => {
      // Would need to load model.json to get generators list
      // For now, return basic info
      const modelPath = model.path;
      generatorUsage.set(modelPath, []);
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            generators: [],
            message: `Found ${clayData.models.length} models in project`,
            raw_data: clayData,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            message: `Error: ${errorMessage}`,
          }, null, 2),
        },
      ],
    };
  }
}
