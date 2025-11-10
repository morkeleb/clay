/**
 * Zod schemas for MCP tool parameters and responses
 */
import { z } from 'zod';
export declare const WorkingDirectorySchema: z.ZodOptional<z.ZodString>;
export declare const ModelPathSchema: z.ZodString;
export declare const OutputPathSchema: z.ZodString;
export declare const GenerateInputSchema: z.ZodObject<{
    working_directory: z.ZodOptional<z.ZodString>;
    model_path: z.ZodOptional<z.ZodString>;
    output_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    working_directory?: string | undefined;
    model_path?: string | undefined;
    output_path?: string | undefined;
}, {
    working_directory?: string | undefined;
    model_path?: string | undefined;
    output_path?: string | undefined;
}>;
export declare const GenerateOutputSchema: z.ZodObject<{
    success: z.ZodBoolean;
    message: z.ZodString;
    models_processed: z.ZodNumber;
    total_files_generated: z.ZodNumber;
    total_files_updated: z.ZodNumber;
    total_files_unchanged: z.ZodNumber;
    details: z.ZodArray<z.ZodObject<{
        model_path: z.ZodString;
        output_path: z.ZodString;
        files_generated: z.ZodNumber;
        files_updated: z.ZodNumber;
        files_unchanged: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        model_path: string;
        output_path: string;
        files_generated: number;
        files_updated: number;
        files_unchanged: number;
    }, {
        model_path: string;
        output_path: string;
        files_generated: number;
        files_updated: number;
        files_unchanged: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: boolean;
    models_processed: number;
    total_files_generated: number;
    total_files_updated: number;
    total_files_unchanged: number;
    details: {
        model_path: string;
        output_path: string;
        files_generated: number;
        files_updated: number;
        files_unchanged: number;
    }[];
}, {
    message: string;
    success: boolean;
    models_processed: number;
    total_files_generated: number;
    total_files_updated: number;
    total_files_unchanged: number;
    details: {
        model_path: string;
        output_path: string;
        files_generated: number;
        files_updated: number;
        files_unchanged: number;
    }[];
}>;
export type GenerateInput = z.infer<typeof GenerateInputSchema>;
export type GenerateOutput = z.infer<typeof GenerateOutputSchema>;
export declare const CleanInputSchema: z.ZodObject<{
    working_directory: z.ZodOptional<z.ZodString>;
    model_path: z.ZodOptional<z.ZodString>;
    output_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    working_directory?: string | undefined;
    model_path?: string | undefined;
    output_path?: string | undefined;
}, {
    working_directory?: string | undefined;
    model_path?: string | undefined;
    output_path?: string | undefined;
}>;
export declare const CleanOutputSchema: z.ZodObject<{
    success: z.ZodBoolean;
    message: z.ZodString;
    models_cleaned: z.ZodNumber;
    total_files_removed: z.ZodNumber;
    details: z.ZodArray<z.ZodObject<{
        model_path: z.ZodString;
        files_removed: z.ZodNumber;
        files: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        model_path: string;
        files_removed: number;
        files: string[];
    }, {
        model_path: string;
        files_removed: number;
        files: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: boolean;
    details: {
        model_path: string;
        files_removed: number;
        files: string[];
    }[];
    models_cleaned: number;
    total_files_removed: number;
}, {
    message: string;
    success: boolean;
    details: {
        model_path: string;
        files_removed: number;
        files: string[];
    }[];
    models_cleaned: number;
    total_files_removed: number;
}>;
export type CleanInput = z.infer<typeof CleanInputSchema>;
export type CleanOutput = z.infer<typeof CleanOutputSchema>;
export declare const TestPathInputSchema: z.ZodObject<{
    working_directory: z.ZodOptional<z.ZodString>;
    model_path: z.ZodString;
    json_path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    model_path: string;
    json_path: string;
    working_directory?: string | undefined;
}, {
    model_path: string;
    json_path: string;
    working_directory?: string | undefined;
}>;
export declare const TestPathOutputSchema: z.ZodObject<{
    success: z.ZodBoolean;
    results: z.ZodArray<z.ZodAny, "many">;
    count: z.ZodNumber;
    formatted_output: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    results: any[];
    count: number;
    formatted_output: string;
}, {
    success: boolean;
    results: any[];
    count: number;
    formatted_output: string;
}>;
export type TestPathInput = z.infer<typeof TestPathInputSchema>;
export type TestPathOutput = z.infer<typeof TestPathOutputSchema>;
export declare const InitInputSchema: z.ZodObject<{
    working_directory: z.ZodOptional<z.ZodString>;
    type: z.ZodDefault<z.ZodEnum<["project", "generator"]>>;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "project" | "generator";
    working_directory?: string | undefined;
    name?: string | undefined;
}, {
    working_directory?: string | undefined;
    type?: "project" | "generator" | undefined;
    name?: string | undefined;
}>;
export declare const InitOutputSchema: z.ZodObject<{
    success: z.ZodBoolean;
    message: z.ZodString;
    created_files: z.ZodArray<z.ZodString, "many">;
    next_steps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: boolean;
    created_files: string[];
    next_steps?: string[] | undefined;
}, {
    message: string;
    success: boolean;
    created_files: string[];
    next_steps?: string[] | undefined;
}>;
export type InitInput = z.infer<typeof InitInputSchema>;
export type InitOutput = z.infer<typeof InitOutputSchema>;
export declare const ListGeneratorsInputSchema: z.ZodObject<{
    working_directory: z.ZodOptional<z.ZodString>;
    show_details: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    show_details: boolean;
    working_directory?: string | undefined;
}, {
    working_directory?: string | undefined;
    show_details?: boolean | undefined;
}>;
export declare const ListGeneratorsOutputSchema: z.ZodObject<{
    success: z.ZodBoolean;
    generators: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
        used_by_models: z.ZodArray<z.ZodString, "many">;
        steps_count: z.ZodNumber;
        has_formatters: z.ZodBoolean;
        has_partials: z.ZodBoolean;
        steps: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        name: string;
        used_by_models: string[];
        steps_count: number;
        has_formatters: boolean;
        has_partials: boolean;
        steps?: any[] | undefined;
    }, {
        path: string;
        name: string;
        used_by_models: string[];
        steps_count: number;
        has_formatters: boolean;
        has_partials: boolean;
        steps?: any[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    generators: {
        path: string;
        name: string;
        used_by_models: string[];
        steps_count: number;
        has_formatters: boolean;
        has_partials: boolean;
        steps?: any[] | undefined;
    }[];
}, {
    success: boolean;
    generators: {
        path: string;
        name: string;
        used_by_models: string[];
        steps_count: number;
        has_formatters: boolean;
        has_partials: boolean;
        steps?: any[] | undefined;
    }[];
}>;
export type ListGeneratorsInput = z.infer<typeof ListGeneratorsInputSchema>;
export type ListGeneratorsOutput = z.infer<typeof ListGeneratorsOutputSchema>;
export declare const GetModelStructureInputSchema: z.ZodObject<{
    working_directory: z.ZodOptional<z.ZodString>;
    model_path: z.ZodOptional<z.ZodString>;
    include_mixins: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    include_mixins: boolean;
    working_directory?: string | undefined;
    model_path?: string | undefined;
}, {
    working_directory?: string | undefined;
    model_path?: string | undefined;
    include_mixins?: boolean | undefined;
}>;
export declare const GetModelStructureOutputSchema: z.ZodObject<{
    success: z.ZodBoolean;
    models: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        output: z.ZodString;
        name: z.ZodString;
        generators: z.ZodArray<z.ZodString, "many">;
        model_keys: z.ZodArray<z.ZodString, "many">;
        structure: z.ZodOptional<z.ZodAny>;
        file_count: z.ZodOptional<z.ZodNumber>;
        last_generated: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        name: string;
        generators: string[];
        output: string;
        model_keys: string[];
        structure?: any;
        file_count?: number | undefined;
        last_generated?: string | undefined;
    }, {
        path: string;
        name: string;
        generators: string[];
        output: string;
        model_keys: string[];
        structure?: any;
        file_count?: number | undefined;
        last_generated?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    models: {
        path: string;
        name: string;
        generators: string[];
        output: string;
        model_keys: string[];
        structure?: any;
        file_count?: number | undefined;
        last_generated?: string | undefined;
    }[];
}, {
    success: boolean;
    models: {
        path: string;
        name: string;
        generators: string[];
        output: string;
        model_keys: string[];
        structure?: any;
        file_count?: number | undefined;
        last_generated?: string | undefined;
    }[];
}>;
export type GetModelStructureInput = z.infer<typeof GetModelStructureInputSchema>;
export type GetModelStructureOutput = z.infer<typeof GetModelStructureOutputSchema>;
export declare const ListHelpersInputSchema: z.ZodObject<{
    category: z.ZodOptional<z.ZodEnum<["string", "comparison", "logic", "iteration", "formatting", "math", "type-check", "utility"]>>;
    include_examples: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    include_examples: boolean;
    category?: "string" | "comparison" | "logic" | "iteration" | "formatting" | "math" | "type-check" | "utility" | undefined;
}, {
    category?: "string" | "comparison" | "logic" | "iteration" | "formatting" | "math" | "type-check" | "utility" | undefined;
    include_examples?: boolean | undefined;
}>;
export declare const ListHelpersOutputSchema: z.ZodObject<{
    success: z.ZodBoolean;
    total_helpers: z.ZodNumber;
    categories: z.ZodArray<z.ZodObject<{
        category: z.ZodString;
        helpers: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            category: z.ZodString;
            description: z.ZodString;
            syntax: z.ZodString;
            example: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            category: string;
            description: string;
            syntax: string;
            example?: string | undefined;
        }, {
            name: string;
            category: string;
            description: string;
            syntax: string;
            example?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        category: string;
        helpers: {
            name: string;
            category: string;
            description: string;
            syntax: string;
            example?: string | undefined;
        }[];
    }, {
        category: string;
        helpers: {
            name: string;
            category: string;
            description: string;
            syntax: string;
            example?: string | undefined;
        }[];
    }>, "many">;
    available_categories: z.ZodArray<z.ZodString, "many">;
    context_variables: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        example: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        example: string;
    }, {
        name: string;
        description: string;
        example: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    total_helpers: number;
    categories: {
        category: string;
        helpers: {
            name: string;
            category: string;
            description: string;
            syntax: string;
            example?: string | undefined;
        }[];
    }[];
    available_categories: string[];
    context_variables: {
        name: string;
        description: string;
        example: string;
    }[];
}, {
    success: boolean;
    total_helpers: number;
    categories: {
        category: string;
        helpers: {
            name: string;
            category: string;
            description: string;
            syntax: string;
            example?: string | undefined;
        }[];
    }[];
    available_categories: string[];
    context_variables: {
        name: string;
        description: string;
        example: string;
    }[];
}>;
export type ListHelpersInput = z.infer<typeof ListHelpersInputSchema>;
export type ListHelpersOutput = z.infer<typeof ListHelpersOutputSchema>;
export declare const ExplainConceptsInputSchema: z.ZodObject<{
    topic: z.ZodOptional<z.ZodEnum<["overview", "models", "generators", "templates", "context-variables", "jsonpath", "mixins", "all"]>>;
    include_examples: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    include_examples: boolean;
    topic?: "generators" | "models" | "overview" | "templates" | "context-variables" | "jsonpath" | "mixins" | "all" | undefined;
}, {
    include_examples?: boolean | undefined;
    topic?: "generators" | "models" | "overview" | "templates" | "context-variables" | "jsonpath" | "mixins" | "all" | undefined;
}>;
export declare const ExplainConceptsOutputSchema: z.ZodObject<{
    success: z.ZodBoolean;
    topic: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    concepts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        topic: z.ZodString;
        title: z.ZodString;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        topic: string;
        title: string;
        content: string;
    }, {
        topic: string;
        title: string;
        content: string;
    }>, "many">>;
    available_topics: z.ZodArray<z.ZodString, "many">;
    related_tools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    note: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    available_topics: string[];
    message?: string | undefined;
    topic?: string | undefined;
    title?: string | undefined;
    content?: string | undefined;
    concepts?: {
        topic: string;
        title: string;
        content: string;
    }[] | undefined;
    related_tools?: string[] | undefined;
    note?: string | undefined;
}, {
    success: boolean;
    available_topics: string[];
    message?: string | undefined;
    topic?: string | undefined;
    title?: string | undefined;
    content?: string | undefined;
    concepts?: {
        topic: string;
        title: string;
        content: string;
    }[] | undefined;
    related_tools?: string[] | undefined;
    note?: string | undefined;
}>;
export type ExplainConceptsInput = z.infer<typeof ExplainConceptsInputSchema>;
export type ExplainConceptsOutput = z.infer<typeof ExplainConceptsOutputSchema>;
//# sourceMappingURL=schemas.d.ts.map