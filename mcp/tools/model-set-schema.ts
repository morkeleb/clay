/**
 * clay_model_set_schema tool - Set $schema reference on a model file
 * Always writes the $schema reference, even if validation produces warnings.
 */
import { validateInput } from '../shared/validation.js';
import { ModelSetSchemaInputSchema } from '../shared/schemas.js';
import { readModelFile, validateAgainstSchema } from '../shared/model-file.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import fs from 'fs';
import path from 'path';

export async function modelSetSchemaTool(args: unknown) {
  const validation = validateInput(ModelSetSchemaInputSchema, args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: validation.error }, null, 2) }],
    };
  }

  const input = validation.data;

  try {
    const context = getWorkspaceContext(input.working_directory);
    const fullModelPath = resolvePath(context.workingDirectory, input.model_path);
    const modelData = readModelFile(fullModelPath);

    // Resolve schema path relative to model directory or absolute
    const resolvedSchema = path.isAbsolute(input.schema_path)
      ? input.schema_path
      : path.resolve(path.dirname(fullModelPath), input.schema_path);

    if (!fs.existsSync(resolvedSchema)) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Schema file not found: ${resolvedSchema}`,
        }, null, 2) }],
      };
    }

    // Validate current model against schema for warnings (not errors)
    const warnings = validateAgainstSchema(modelData.model, resolvedSchema);

    // Always set $schema using the original path as given
    modelData['$schema'] = input.schema_path;

    // Write directly with fs.writeFileSync to bypass writeModelFile's validation rejection
    fs.writeFileSync(
      path.resolve(fullModelPath),
      JSON.stringify(modelData, null, 2) + '\n',
      'utf-8'
    );

    const result: Record<string, unknown> = {
      success: true,
      message: `Set $schema to ${input.schema_path}`,
    };

    if (warnings.length > 0) {
      result.validation_warnings = warnings;
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: errorMessage }, null, 2) }],
    };
  }
}
