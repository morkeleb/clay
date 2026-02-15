/**
 * clay_model_add tool - Add items to arrays or properties to objects at a JSONPath location.
 * Include-aware: queries the expanded model, traces targets back to source files.
 */
import { validateInput } from '../shared/validation.js';
import { ModelAddInputSchema } from '../shared/schemas.js';
import { readModelFile, writeModelFile, readExpandedModelWithIncludeMap } from '../shared/model-file.js';
import { traceToSource, readIncludeFile, writeIncludeFile, resolveInInclude } from '../shared/include-writer.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';
import { checkConventions } from '../shared/conventions.js';

export async function modelAddTool(args: unknown) {
  const validation = validateInput(ModelAddInputSchema, args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: validation.error }, null, 2) }],
    };
  }

  const input = validation.data;

  try {
    const context = getWorkspaceContext(input.working_directory);
    const fullModelPath = resolvePath(context.workingDirectory, input.model_path);

    // Load expanded model with include tracking
    const { model: expandedModel, includeMap } = readExpandedModelWithIncludeMap(fullModelPath);

    let targets: unknown[];
    let targetPaths: (string | number)[][];
    try {
      targets = jp.query(expandedModel, input.json_path);
      targetPaths = jp.paths(expandedModel, input.json_path);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`,
        }, null, 2) }],
      };
    }

    if (targets.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `No items matched JSONPath: ${input.json_path}`,
        }, null, 2) }],
      };
    }

    const target = targets[0];
    const targetPath = targetPaths[0];

    // Trace target to source file
    const { filePath: includeFile, relativePath } = traceToSource(
      expandedModel as unknown as Record<string, unknown>,
      includeMap,
      targetPath
    );

    let sourceFile: string | undefined;

    if (includeFile) {
      // Edit the included file
      const includeData = readIncludeFile(includeFile);
      const relTargets = resolveInInclude(includeData, relativePath);
      if (relTargets.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: false,
            message: 'Target not found in included file',
          }, null, 2) }],
        };
      }
      const relTarget = relTargets[0];
      if (Array.isArray(relTarget)) {
        relTarget.push(input.value);
      } else if (typeof relTarget === 'object' && relTarget !== null) {
        Object.assign(relTarget, input.value);
      } else {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: false,
            message: 'Target is not an array or object',
          }, null, 2) }],
        };
      }
      writeIncludeFile(includeFile, includeData);
      sourceFile = includeFile;
    } else {
      // Edit the main model file (raw, preserving includes)
      const modelData = readModelFile(fullModelPath);
      let rawTargets: unknown[];
      try {
        rawTargets = jp.query(modelData, input.json_path);
      } catch {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: false,
            message: 'Target not found in raw model file',
          }, null, 2) }],
        };
      }
      if (rawTargets.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: false,
            message: `No items matched in raw model: ${input.json_path}`,
          }, null, 2) }],
        };
      }
      const rawTarget = rawTargets[0];
      if (Array.isArray(rawTarget)) {
        rawTarget.push(input.value);
      } else if (typeof rawTarget === 'object' && rawTarget !== null) {
        Object.assign(rawTarget, input.value);
      } else {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: false,
            message: 'Target is not an array or object',
          }, null, 2) }],
        };
      }
      writeModelFile(fullModelPath, modelData);
    }

    // Check conventions (warnings only)
    let conventionViolations: Array<{ generator: string; convention: string; errors: string[] }> | undefined;
    try {
      const violations = checkConventions(fullModelPath, context.workingDirectory);
      if (violations.length > 0) {
        conventionViolations = violations;
      }
    } catch {
      // Convention checking is best-effort
    }

    const response: Record<string, unknown> = {
      success: true,
      message: `Added value at ${input.json_path}`,
      path: input.json_path,
    };
    if (sourceFile) {
      response.source_file = sourceFile;
    }
    if (conventionViolations) {
      response.convention_violations = conventionViolations;
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: errorMessage }, null, 2) }],
    };
  }
}
