/**
 * Zod schemas for MCP tool parameters and responses
 */
import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

export const WorkingDirectorySchema = z
  .string()
  .optional()
  .describe(
    'Directory containing .clay file (defaults to current working directory)'
  );

export const ModelPathSchema = z
  .string()
  .describe('Path to model.json file (relative to working directory)');

export const OutputPathSchema = z
  .string()
  .describe(
    'Output directory for generated files (relative to working directory)'
  );

// ============================================================================
// clay_generate schemas
// ============================================================================

export const GenerateInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema.optional(),
    output_path: OutputPathSchema.optional(),
  })
  .describe('Generate code from Clay models');

export const GenerateOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  models_processed: z.number(),
  total_files_generated: z.number(),
  total_files_updated: z.number(),
  total_files_unchanged: z.number(),
  details: z.array(
    z.object({
      model_path: z.string(),
      output_path: z.string(),
      files_generated: z.number(),
      files_updated: z.number(),
      files_unchanged: z.number(),
    })
  ),
});

export type GenerateInput = z.infer<typeof GenerateInputSchema>;
export type GenerateOutput = z.infer<typeof GenerateOutputSchema>;

// ============================================================================
// clay_clean schemas
// ============================================================================

export const CleanInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema.optional(),
    output_path: OutputPathSchema.optional(),
  })
  .describe('Clean generated files tracked in .clay file');

export const CleanOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  models_cleaned: z.number(),
  total_files_removed: z.number(),
  details: z.array(
    z.object({
      model_path: z.string(),
      files_removed: z.number(),
      files: z.array(z.string()),
    })
  ),
});

export type CleanInput = z.infer<typeof CleanInputSchema>;
export type CleanOutput = z.infer<typeof CleanOutputSchema>;

// ============================================================================
// clay_test_path schemas
// ============================================================================

export const TestPathInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema,
    json_path: z
      .string()
      .describe('JSONPath expression to test against the model'),
  })
  .describe('Test JSONPath expressions against a Clay model');

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

export const InitInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    type: z
      .enum(['project', 'generator'])
      .default('project')
      .describe(
        'What to initialize: project creates .clay file, generator creates generator structure'
      ),
    name: z
      .string()
      .optional()
      .describe('Generator name (required when type=generator)'),
  })
  .describe('Initialize a Clay project or generator');

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

export const ListGeneratorsInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    show_details: z
      .boolean()
      .default(false)
      .describe('Include detailed information about generator steps'),
  })
  .describe('List all generators used in the project');

export const ListGeneratorsOutputSchema = z.object({
  success: z.boolean(),
  generators: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      used_by_models: z.array(z.string()),
      steps_count: z.number(),
      has_formatters: z.boolean(),
      has_partials: z.boolean(),
      steps: z.array(z.any()).optional(),
    })
  ),
});

export type ListGeneratorsInput = z.infer<typeof ListGeneratorsInputSchema>;
export type ListGeneratorsOutput = z.infer<typeof ListGeneratorsOutputSchema>;

// ============================================================================
// clay_get_model_structure schemas
// ============================================================================

export const GetModelStructureInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema.optional(),
  })
  .describe('Get the structure of Clay models');

export const GetModelStructureOutputSchema = z.object({
  success: z.boolean(),
  models: z.array(
    z.object({
      path: z.string(),
      output: z.string(),
      name: z.string(),
      generators: z.array(z.string()),
      model_keys: z.array(z.string()),
      structure: z.any().optional(),
      file_count: z.number().optional(),
      last_generated: z.string().optional(),
    })
  ),
});

export type GetModelStructureInput = z.infer<
  typeof GetModelStructureInputSchema
>;
export type GetModelStructureOutput = z.infer<
  typeof GetModelStructureOutputSchema
>;

// ============================================================================
// clay_list_helpers schemas
// ============================================================================

export const ListHelpersInputSchema = z
  .object({
    category: z
      .enum([
        'string',
        'comparison',
        'logic',
        'iteration',
        'formatting',
        'math',
        'type-check',
        'utility',
      ])
      .optional()
      .describe(
        'Filter helpers by category (optional - returns all if not specified)'
      ),
    include_examples: z
      .boolean()
      .default(false)
      .describe('Include usage examples for each helper'),
  })
  .describe('List all available Handlebars helpers for Clay templates');

export const ListHelpersOutputSchema = z.object({
  success: z.boolean(),
  total_helpers: z.number(),
  categories: z.array(
    z.object({
      category: z.string(),
      helpers: z.array(
        z.object({
          name: z.string(),
          category: z.string(),
          description: z.string(),
          syntax: z.string(),
          example: z.string().optional(),
        })
      ),
    })
  ),
  available_categories: z.array(z.string()),
  context_variables: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      example: z.string(),
    })
  ),
});

export type ListHelpersInput = z.infer<typeof ListHelpersInputSchema>;
export type ListHelpersOutput = z.infer<typeof ListHelpersOutputSchema>;

// ============================================================================
// clay_explain_concepts schemas
// ============================================================================

export const ExplainConceptsInputSchema = z
  .object({
    topic: z
      .enum([
        'overview',
        'models',
        'generators',
        'templates',
        'context-variables',
        'jsonpath',
        'mixins',
        'all',
      ])
      .optional()
      .describe('Specific topic to explain (defaults to overview)'),
    include_examples: z
      .boolean()
      .default(true)
      .describe('Include code examples'),
  })
  .describe('Get comprehensive Clay documentation and best practices');

export const ExplainConceptsOutputSchema = z.object({
  success: z.boolean(),
  topic: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  concepts: z
    .array(
      z.object({
        topic: z.string(),
        title: z.string(),
        content: z.string(),
      })
    )
    .optional(),
  available_topics: z.array(z.string()),
  related_tools: z.array(z.string()).optional(),
  note: z.string().optional(),
  message: z.string().optional(),
});

export type ExplainConceptsInput = z.infer<typeof ExplainConceptsInputSchema>;
export type ExplainConceptsOutput = z.infer<typeof ExplainConceptsOutputSchema>;

// ============================================================================
// clay_model_query schemas
// ============================================================================

export const ModelQueryInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema,
    json_path: z.string().describe('JSONPath expression to query (e.g., "$.model.entities[?(@.name==\'User\')]")'),
  })
  .describe('Query model data using JSONPath. Returns matched items only.');

export type ModelQueryInput = z.infer<typeof ModelQueryInputSchema>;

// ============================================================================
// clay_model_add schemas
// ============================================================================

export const ModelAddInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema,
    json_path: z.string().describe('JSONPath to the target array or object'),
    value: z.any().describe('Value to add: appended if target is array, merged if target is object'),
  })
  .describe('Add an item to an array or property to an object at a JSONPath location.');

export type ModelAddInput = z.infer<typeof ModelAddInputSchema>;

// ============================================================================
// clay_model_update schemas
// ============================================================================

export const ModelUpdateInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema,
    json_path: z.string().describe('JSONPath expression matching items to update'),
    fields: z.record(z.any()).describe('Fields to merge into each matched item'),
  })
  .describe('Update fields on all items matched by JSONPath.');

export type ModelUpdateInput = z.infer<typeof ModelUpdateInputSchema>;

// ============================================================================
// clay_model_delete schemas
// ============================================================================

export const ModelDeleteInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema,
    json_path: z.string().describe('JSONPath expression matching items to remove'),
  })
  .describe('Remove items matched by JSONPath from their parent arrays/objects.');

export type ModelDeleteInput = z.infer<typeof ModelDeleteInputSchema>;

// ============================================================================
// clay_model_rename schemas
// ============================================================================

export const ModelRenameInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema,
    json_path: z.string().describe('JSONPath expression matching items whose property to rename'),
    old_name: z.string().describe('Current property name to rename'),
    new_name: z.string().describe('New property name'),
  })
  .describe('Rename a property key across all items matched by JSONPath.');

export type ModelRenameInput = z.infer<typeof ModelRenameInputSchema>;

// ============================================================================
// clay_model_set_schema schemas
// ============================================================================

export const ModelSetSchemaInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema,
    schema_path: z.string().describe('Path to JSON Schema file (relative to model file or absolute)'),
  })
  .describe('Set or update the $schema reference on a model file.');

export type ModelSetSchemaInput = z.infer<typeof ModelSetSchemaInputSchema>;
