/**
 * MCP Tool: clay_list_helpers
 *
 * Lists all available Handlebars helpers that can be used in Clay templates.
 * This helps LLMs understand which helpers are available when creating or
 * modifying templates.
 */
import { ListHelpersInput, ListHelpersOutput } from '../shared/schemas.js';
/**
 * List all available Handlebars helpers with documentation
 */
export declare function listHelpers(input: ListHelpersInput): Promise<ListHelpersOutput>;
/**
 * MCP tool handler for clay_list_helpers
 */
export declare function listHelpersTool(args: unknown): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
//# sourceMappingURL=list-helpers.d.ts.map