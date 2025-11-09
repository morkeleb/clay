/**
 * clay_get_model_structure tool - Get model structure and metadata
 */
import { validateInput } from '../shared/validation.js';
import { GetModelStructureInputSchema } from '../shared/schemas.js';
import { requireClayFile } from '../shared/workspace-manager.js';
import { readClayFile } from '../shared/clay-wrapper.js';

export async function getModelStructureTool(args: unknown) {
  const validation = validateInput(GetModelStructureInputSchema, args);
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

    const models = clayData.models.map((model) => ({
      path: model.path,
      output: model.output,
      name: model.path.split('/').pop()?.replace('.json', '') || 'unknown',
      generators: [], // Would need to load model.json
      model_keys: [],
      file_count: Object.keys(model.generated_files || {}).length,
      last_generated: model.last_generated,
    }));

    // If specific model requested, filter
    const filteredModels = input.model_path
      ? models.filter(m => m.path === input.model_path)
      : models;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            models: filteredModels,
            total_models: clayData.models.length,
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
