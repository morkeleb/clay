/**
 * clay_get_model_structure tool - Get model structure and metadata
 */
import { validateInput } from '../shared/validation.js';
import { GetModelStructureInputSchema } from '../shared/schemas.js';
import { requireClayFile } from '../shared/workspace-manager.js';
import { readClayFile } from '../shared/clay-wrapper.js';
import fs from 'fs';
import path from 'path';

export async function getModelStructureTool(args: unknown) {
  const validation = validateInput(GetModelStructureInputSchema, args);
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
    const clayData = readClayFile(context.clayFilePath);

    const models = clayData.models.map((model) => {
      // Load the actual model file to get structure
      let modelData: any = null;
      let modelKeys: string[] = [];
      let generators: string[] = [];
      
      try {
        const modelFilePath = path.isAbsolute(model.path) 
          ? model.path 
          : path.resolve(context.workingDirectory, model.path);
        
        if (fs.existsSync(modelFilePath)) {
          const modelContent = fs.readFileSync(modelFilePath, 'utf8');
          modelData = JSON.parse(modelContent);
          
          // Extract top-level keys
          modelKeys = Object.keys(modelData);
          
          // Extract generators if present
          if (modelData.generators && Array.isArray(modelData.generators)) {
            generators = modelData.generators.map((g: any) => 
              typeof g === 'string' ? g : g.path || g.name || 'unknown'
            );
          }
        }
      } catch (error) {
        // Model file couldn't be loaded, continue with partial data
      }

      return {
        path: model.path,
        output: model.output,
        name: model.path.split('/').pop()?.replace('.json', '') || 'unknown',
        generators,
        model_keys: modelKeys,
        structure: modelData,
        file_count: Object.keys(model.generated_files || {}).length,
        last_generated: model.last_generated,
      };
    });

    // If specific model requested, filter by matching path (handle both absolute and relative)
    let filteredModels = models;
    if (input.model_path) {
      const normalizedInputPath = path.normalize(input.model_path);
      filteredModels = models.filter((m) => {
        const modelAbsPath = path.isAbsolute(m.path)
          ? path.normalize(m.path)
          : path.normalize(path.resolve(context.workingDirectory, m.path));
        const inputAbsPath = path.isAbsolute(normalizedInputPath)
          ? normalizedInputPath
          : path.normalize(path.resolve(context.workingDirectory, normalizedInputPath));
        
        return modelAbsPath === inputAbsPath || path.normalize(m.path) === normalizedInputPath;
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              models: filteredModels,
              total_models: clayData.models.length,
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
