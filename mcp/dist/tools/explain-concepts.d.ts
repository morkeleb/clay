/**
 * clay_explain_concepts tool - Explain Clay concepts, capabilities, and best practices
 *
 * This tool provides comprehensive documentation to help LLMs understand how to:
 * - Create generators from scratch
 * - Write models effectively
 * - Use template context variables (clay_key, clay_parent, etc.)
 * - Leverage all available features
 */
import { ExplainConceptsInput } from '../shared/schemas.js';
/**
 * Get comprehensive Clay documentation
 */
export declare function explainConcepts(input: ExplainConceptsInput): Promise<{
    success: boolean;
    concepts: ({
        title: string;
        content: string;
        topic: string;
    } | {
        title: string;
        content: string;
        topic: string;
    } | {
        title: string;
        content: string;
        topic: string;
    } | {
        title: string;
        content: string;
        topic: string;
    } | {
        title: string;
        content: string;
        topic: string;
    } | {
        title: string;
        content: string;
        topic: string;
    } | {
        title: string;
        content: string;
        topic: string;
    })[];
    available_topics: string[];
    note: string;
    message?: undefined;
} | {
    success: boolean;
    message: string;
    available_topics: string[];
    concepts?: undefined;
    note?: undefined;
} | {
    available_topics: string[];
    related_tools: string[];
    title: string;
    content: string;
    success: boolean;
    topic: "generators" | "models" | "overview" | "templates" | "context-variables" | "jsonpath" | "mixins";
    concepts?: undefined;
    note?: undefined;
    message?: undefined;
}>;
/**
 * MCP tool handler
 */
export declare function explainConceptsTool(args: unknown): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
//# sourceMappingURL=explain-concepts.d.ts.map