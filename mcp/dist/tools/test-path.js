/**
 * clay_test_path tool - Test JSONPath expressions
 */
import { validateInput, validateJSONPath } from '../shared/validation.js';
import { TestPathInputSchema } from '../shared/schemas.js';
import { getWorkspaceContext, resolvePath, } from '../shared/workspace-manager.js';
import { executeClayCommand } from '../shared/clay-wrapper.js';
export async function testPathTool(args) {
    const validation = validateInput(TestPathInputSchema, args);
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
    // Validate JSONPath
    const jsonPathValidation = validateJSONPath(input.json_path);
    if (!jsonPathValidation.valid) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        message: `Invalid JSONPath: ${jsonPathValidation.error}`,
                    }, null, 2),
                },
            ],
        };
    }
    try {
        const context = getWorkspaceContext(input.working_directory);
        const workingDir = context.workingDirectory;
        const modelPath = resolvePath(workingDir, input.model_path);
        const result = executeClayCommand('test-path', [modelPath, input.json_path], workingDir);
        if (!result.success) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            message: `Failed to test path: ${result.error}`,
                            output: result.output,
                        }, null, 2),
                    },
                ],
            };
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        results: [], // Would need to parse output
                        count: 0,
                        formatted_output: result.output,
                    }, null, 2),
                },
            ],
        };
    }
    catch (error) {
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
//# sourceMappingURL=test-path.js.map