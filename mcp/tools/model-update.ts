/**
 * clay_model_update tool - Update fields on items matched by JSONPath.
 * Include-aware: queries the expanded model, traces targets back to source files.
 */
import { validateInput } from '../shared/validation.js';
import { ModelUpdateInputSchema } from '../shared/schemas.js';
import { readModelFile, writeModelFile, readExpandedModelWithIncludeMap } from '../shared/model-file.js';
import { traceToSource, readIncludeFile, writeIncludeFile, resolveInInclude } from '../shared/include-writer.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';
import { checkConventions } from '../shared/conventions.js';

export async function modelUpdateTool(args: unknown) {
  const validation = validateInput(ModelUpdateInputSchema, args);
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

    let matches: unknown[];
    let matchPaths: (string | number)[][];
    try {
      matches = jp.query(expandedModel, input.json_path);
      matchPaths = jp.paths(expandedModel, input.json_path);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`,
        }, null, 2) }],
      };
    }

    if (matches.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `No items matched JSONPath: ${input.json_path}`,
        }, null, 2) }],
      };
    }

    // Group by source file
    const includeFileEdits = new Map<string, (string | number)[][]>();
    const mainFileMatchIndices: number[] = [];
    let updated = 0;

    for (let i = 0; i < matches.length; i++) {
      if (typeof matches[i] !== 'object' || matches[i] === null || Array.isArray(matches[i])) continue;

      const { filePath, relativePath } = traceToSource(
        expandedModel as unknown as Record<string, unknown>,
        includeMap,
        matchPaths[i]
      );

      if (filePath) {
        if (!includeFileEdits.has(filePath)) includeFileEdits.set(filePath, []);
        includeFileEdits.get(filePath)!.push(relativePath);
      } else {
        mainFileMatchIndices.push(i);
      }
    }

    const filesModified = new Set<string>();

    // Apply to included files
    for (const [filePath, relativePaths] of includeFileEdits) {
      const includeData = readIncludeFile(filePath);
      for (const relPath of relativePaths) {
        const relTargets = resolveInInclude(includeData, relPath);
        for (const t of relTargets) {
          if (typeof t === 'object' && t !== null && !Array.isArray(t)) {
            Object.assign(t, input.fields);
            updated++;
          }
        }
      }
      writeIncludeFile(filePath, includeData);
      filesModified.add(filePath);
    }

    // Apply to main file
    if (mainFileMatchIndices.length > 0) {
      const modelData = readModelFile(fullModelPath);
      const rawMatches = jp.query(modelData, input.json_path);
      for (const m of rawMatches) {
        if (typeof m === 'object' && m !== null && !Array.isArray(m)) {
          Object.assign(m, input.fields);
          updated++;
        }
      }
      writeModelFile(fullModelPath, modelData);
      filesModified.add(fullModelPath);
    }

    // Check conventions (warnings only — mutation already written)
    let conventionViolations: Array<{ generator: string; convention: string; errors: string[] }> | undefined;
    try {
      const violations = checkConventions(fullModelPath, context.workingDirectory);
      if (violations.length > 0) conventionViolations = violations;
    } catch { /* best-effort */ }

    const response: Record<string, unknown> = {
      success: true,
      message: `Updated ${updated} item(s) at ${input.json_path}`,
      matched: updated,
    };
    if (filesModified.size > 1) {
      response.files_modified = [...filesModified];
    } else if (includeFileEdits.size === 1) {
      response.source_file = [...includeFileEdits.keys()][0];
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
