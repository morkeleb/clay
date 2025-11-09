/**
 * Zod schemas for MCP tool parameters and responses
 */
import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

export const WorkingDirectorySchema = z.string().optional().describe(
  'Directory containing .clay file (defaults to current working directory)'
);

export const ModelPathSchema = z.string().describe(
  'Path to model.json file (relative to working directory)'
);

export const OutputPathSchema = z.string().describe(
  'Output directory for generated files (relative to working directory)'
);

// ============================================================================
// clay_generate schemas
// ============================================================================

export const GenerateInputSchema = z.object({
  working_directory: WorkingDirectorySchema,
  model_path: ModelPathSchema.optional(),
  output_path: OutputPathSchema.optional(),
}).describe('Generate code from Clay models');

export const GenerateOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  models_processed: z.number(),
  total_files_generated: z.number(),
  total_files_updated: z.number(),
  total_files_unchanged: z.number(),
  details: z.array(z.object({
    model_path: z.string(),
    output_path: z.string(),
    files_generated: z.number(),
    files_updated: z.number(),
    files_unchanged: z.number(),
  })),
});

export type GenerateInput = z.infer<typeof GenerateInputSchema>;
export type GenerateOutput = z.infer<typeof GenerateOutputSchema>;

// ============================================================================
// clay_clean schemas
// ============================================================================

export const CleanInputSchema = z.object({
  working_directory: WorkingDirectorySchema,
  model_path: ModelPathSchema.optional(),
  output_path: OutputPathSchema.optional(),
}).describe('Clean generated files tracked in .clay file');

export const CleanOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  models_cleaned: z.number(),
  total_files_removed: z.number(),
  details: z.array(z.object({
    model_path: z.string(),
    files_removed: z.number(),
    files: z.array(z.string()),
  })),
});

export type CleanInput = z.infer<typeof CleanInputSchema>;
export type CleanOutput = z.infer<typeof CleanOutputSchema>;

// ============================================================================
// clay_test_path schemas
// ============================================================================

export const TestPathInputSchema = z.object({
  working_directory: WorkingDirectorySchema,
  model_path: ModelPathSchema,
  json_path: z.string().describe('JSONPath expression to test against the model'),
}).describe('Test JSONPath expressions against a Clay model');

export const TestPathOutputSchema = z.object({
  success: z.boolean(),
  results: z.array(z.any()),
  count: z.number(),
  formatted_output: z.string(),
});

export type TestPathInput = z.infer<typeof TestPathInputSchema>;
export type TestPathOutput = z.infer<typeof TestPathOutputSchema>;

// ============================================================================
// clay_init schemas
// ============================================================================

export const InitInputSchema = z.object({
  working_directory: WorkingDirectorySchema,
  type: z.enum(['project', 'generator']).default('project').describe(
    'What to initialize: project creates .clay file, generator creates generator structure'
  ),
  name: z.string().optional().describe(
    'Generator name (required when type=generator)'
  ),
}).describe('Initialize a Clay project or generator');

export const InitOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  created_files: z.array(z.string()),
  next_steps: z.array(z.string()).optional(),
});

export type InitInput = z.infer<typeof InitInputSchema>;
export type InitOutput = z.infer<typeof InitOutputSchema>;

// ============================================================================
// clay_list_generators schemas
// ============================================================================

export const ListGeneratorsInputSchema = z.object({
  working_directory: WorkingDirectorySchema,
  show_details: z.boolean().default(false).describe(
    'Include detailed information about generator steps'
  ),
}).describe('List all generators used in the project');

export const ListGeneratorsOutputSchema = z.object({
  success: z.boolean(),
  generators: z.array(z.object({
    name: z.string(),
    path: z.string(),
    used_by_models: z.array(z.string()),
    steps_count: z.number(),
    has_formatters: z.boolean(),
    has_partials: z.boolean(),
    steps: z.array(z.any()).optional(),
  })),
});

export type ListGeneratorsInput = z.infer<typeof ListGeneratorsInputSchema>;
export type ListGeneratorsOutput = z.infer<typeof ListGeneratorsOutputSchema>;

// ============================================================================
// clay_get_model_structure schemas
// ============================================================================

export const GetModelStructureInputSchema = z.object({
  working_directory: WorkingDirectorySchema,
  model_path: ModelPathSchema.optional(),
  include_mixins: z.boolean().default(false).describe(
    'Execute mixins before returning model structure'
  ),
}).describe('Get the structure of Clay models');

export const GetModelStructureOutputSchema = z.object({
  success: z.boolean(),
  models: z.array(z.object({
    path: z.string(),
    output: z.string(),
    name: z.string(),
    generators: z.array(z.string()),
    model_keys: z.array(z.string()),
    structure: z.any().optional(),
    file_count: z.number().optional(),
    last_generated: z.string().optional(),
  })),
});

export type GetModelStructureInput = z.infer<typeof GetModelStructureInputSchema>;
export type GetModelStructureOutput = z.infer<typeof GetModelStructureOutputSchema>;
