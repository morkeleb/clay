/**
 * clay_model_delete tool - Remove items matched by JSONPath.
 * Include-aware: queries the expanded model, traces targets back to source files.
 */
import { validateInput } from '../shared/validation.js';
import { ModelDeleteInputSchema } from '../shared/schemas.js';
import { readModelFile, writeModelFile, readExpandedModelWithIncludeMap } from '../shared/model-file.js';
import { traceToSource, readIncludeFile, writeIncludeFile } from '../shared/include-writer.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';
import { checkConventions } from '../shared/conventions.js';

export async function modelDeleteTool(args: unknown) {
  const validation = validateInput(ModelDeleteInputSchema, args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: validation.error }, null, 2) }],
    };
  }

  const input = validation.data;

  try {
    const context = getWorkspaceContext(input.working_directory);
    const fullModelPath = resolvePath(context.workingDirectory, input.model_path);
    const { model: expandedModel, includeMap } = readExpandedModelWithIncludeMap(fullModelPath);

    let targetPaths: (string | number)[][];
    try {
      targetPaths = jp.paths(expandedModel, input.json_path);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`,
        }, null, 2) }],
      };
    }

    if (targetPaths.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `No items matched JSONPath: ${input.json_path}`,
        }, null, 2) }],
      };
    }

    // Categorize each target
    // "includeRoot" = the target IS the included object (delete from main model raw)
    // "insideInclude" = the target is inside an included object (delete from include file)
    // "mainModel" = the target is in the main model (delete from main model raw)
    const includeRootPaths: (string | number)[][] = []; // paths in the expanded model to delete from raw main file
    const insideIncludeEdits = new Map<string, (string | number)[][]>(); // include file -> relative paths to delete
    const mainModelPaths: (string | number)[][] = []; // paths for raw main file deletion

    for (const tp of targetPaths) {
      const { filePath, relativePath } = traceToSource(
        expandedModel as unknown as Record<string, unknown>,
        includeMap,
        tp
      );

      if (filePath && relativePath.length === 1 && relativePath[0] === '$') {
        // Target IS the included object — delete the include ref from main model
        includeRootPaths.push(tp);
      } else if (filePath) {
        // Target is inside an included object — delete from include file
        if (!insideIncludeEdits.has(filePath)) insideIncludeEdits.set(filePath, []);
        insideIncludeEdits.get(filePath)!.push(relativePath);
      } else {
        // Target is in the main model
        mainModelPaths.push(tp);
      }
    }

    let removed = 0;

    // Handle deletions inside included files (reverse order for stable indices)
    for (const [filePath, relativePaths] of insideIncludeEdits) {
      const includeData = readIncludeFile(filePath);
      const sorted = [...relativePaths].reverse();
      for (const relPath of sorted) {
        const parentPath = relPath.slice(0, -1);
        const key = relPath[relPath.length - 1];
        const parent = jp.query(includeData, jp.stringify(parentPath))[0];
        if (Array.isArray(parent) && typeof key === 'number') {
          parent.splice(key, 1);
          removed++;
        } else if (typeof parent === 'object' && parent !== null) {
          delete (parent as Record<string, unknown>)[key as string];
          removed++;
        }
      }
      writeIncludeFile(filePath, includeData);
    }

    // Handle deletions from main model (both includeRoot and mainModel paths)
    const allMainPaths = [...includeRootPaths, ...mainModelPaths];
    if (allMainPaths.length > 0) {
      const modelData = readModelFile(fullModelPath);
      // For includeRootPaths, we need to find the raw include entries.
      // The expanded paths tell us the index in the array.
      // In the raw model, the same index has { "include": "..." }.
      // We also have regular mainModelPaths.
      // Process all in reverse order for stable array indices.
      const rawPaths = allMainPaths.map(expandedPath => {
        // Convert expanded model paths to raw model paths
        // The structure is the same for non-included items
        // For included items, the array index is the same (includes are at the same position)
        return expandedPath;
      });

      const sorted = [...rawPaths].reverse();
      for (const pathComponents of sorted) {
        const parentPath = pathComponents.slice(0, -1);
        const key = pathComponents[pathComponents.length - 1];
        const parent = jp.query(modelData, jp.stringify(parentPath))[0];
        if (Array.isArray(parent) && typeof key === 'number') {
          parent.splice(key, 1);
          removed++;
        } else if (typeof parent === 'object' && parent !== null) {
          delete (parent as Record<string, unknown>)[key as string];
          removed++;
        }
      }
      writeModelFile(fullModelPath, modelData);
    }

    // Check conventions
    let conventionViolations: Array<{ generator: string; convention: string; errors: string[] }> | undefined;
    try {
      const violations = checkConventions(fullModelPath, context.workingDirectory);
      if (violations.length > 0) conventionViolations = violations;
    } catch { /* best-effort */ }

    const response: Record<string, unknown> = {
      success: true,
      message: `Removed ${removed} item(s) at ${input.json_path}`,
      removed,
    };
    if (insideIncludeEdits.size === 1 && allMainPaths.length === 0) {
      response.source_file = [...insideIncludeEdits.keys()][0];
    }
    if (conventionViolations) response.convention_violations = conventionViolations;

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
