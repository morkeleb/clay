#!/usr/bin/env node
/**
 * Clay MCP Server
 * Model Context Protocol server for Clay code generator
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tools
import { generateTool } from './tools/generate.js';
import { cleanTool } from './tools/clean.js';
import { testPathTool } from './tools/test-path.js';
import { initTool } from './tools/init.js';
import { listGeneratorsTool } from './tools/list-generators.js';
import { getModelStructureTool } from './tools/get-model-structure.js';
import { listHelpersTool } from './tools/list-helpers.js';
import { explainConceptsTool } from './tools/explain-concepts.js';
import { modelQueryTool } from './tools/model-query.js';
import { modelAddTool } from './tools/model-add.js';
import { modelUpdateTool } from './tools/model-update.js';
import { modelDeleteTool } from './tools/model-delete.js';
import { modelRenameTool } from './tools/model-rename.js';
import { modelSetSchemaTool } from './tools/model-set-schema.js';

// Import utilities
import { isClayAvailable, getClayVersion } from './shared/clay-wrapper.js';

/**
 * Main MCP server class
 */
class ClayMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'clay-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupPromptHandlers();
    this.setupErrorHandling();
  }

  /**
   * Setup tool request handlers
   */
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'clay_generate',
          description:
            'Generate code from Clay models. Call without parameters to regenerate all models tracked in .clay file, or specify model_path and output_path for a specific model.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description:
                  'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description:
                  'Path to model.json file (optional - if omitted, all models in .clay are regenerated)',
              },
              output_path: {
                type: 'string',
                description:
                  'Output directory for generated files (required if model_path is specified)',
              },
            },
          },
        },
        {
          name: 'clay_clean',
          description:
            'Clean up generated files tracked in the .clay file. Removes all tracked files or files from a specific model.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description:
                  'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description:
                  'Optional: clean only files from this specific model',
              },
              output_path: {
                type: 'string',
                description: 'Required if model_path is specified',
              },
            },
          },
        },
        {
          name: 'clay_test_path',
          description:
            'Test JSONPath expressions against a Clay model to see what data they select.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description:
                  'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              json_path: {
                type: 'string',
                description:
                  'JSONPath expression to test (e.g., "$.model.types[*].name")',
              },
            },
            required: ['model_path', 'json_path'],
          },
        },
        {
          name: 'clay_init',
          description:
            'Initialize a Clay project (create .clay file) or a new generator structure.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description:
                  'Directory where to create .clay file or generator (defaults to current working directory)',
              },
              type: {
                type: 'string',
                enum: ['project', 'generator'],
                default: 'project',
                description:
                  'What to initialize: project creates .clay file, generator creates generator structure',
              },
              name: {
                type: 'string',
                description: 'Generator name (required when type=generator)',
              },
            },
          },
        },
        {
          name: 'clay_list_generators',
          description: 'List all generators used in the project models.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description:
                  'Directory containing .clay file (defaults to current working directory)',
              },
              show_details: {
                type: 'boolean',
                default: false,
                description:
                  'Include detailed information about generator steps',
              },
            },
          },
        },
        {
          name: 'clay_get_model_structure',
          description:
            'Get the structure of Clay models in the project. Shows model metadata and optionally the full structure.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description:
                  'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description:
                  'Specific model to inspect (if omitted, shows all models)',
              },
              include_mixins: {
                type: 'boolean',
                default: false,
                description: 'Execute mixins before returning model structure',
              },
            },
          },
        },
        {
          name: 'clay_list_helpers',
          description:
            'List all available Handlebars helpers for Clay templates. Helps when creating or modifying templates by showing available helpers, their syntax, and usage examples.',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                enum: [
                  'string',
                  'comparison',
                  'logic',
                  'iteration',
                  'formatting',
                  'math',
                  'type-check',
                  'utility',
                ],
                description:
                  'Filter helpers by category (optional - returns all if not specified)',
              },
              include_examples: {
                type: 'boolean',
                default: false,
                description: 'Include usage examples for each helper',
              },
            },
          },
        },
        {
          name: 'clay_explain_concepts',
          description:
            'Get comprehensive Clay documentation explaining how to create models, generators, and templates. Essential for understanding Clay capabilities including hidden features like clay_key, clay_parent, and other template context variables.',
          inputSchema: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                enum: [
                  'overview',
                  'models',
                  'generators',
                  'templates',
                  'context-variables',
                  'jsonpath',
                  'mixins',
                  'all',
                ],
                description:
                  'Specific topic to explain: overview (Clay basics), models (creating models), generators (creating generators), templates (writing templates), context-variables (clay_key, clay_parent, etc.), jsonpath (selectors), mixins (model transformations), or all (everything)',
              },
              include_examples: {
                type: 'boolean',
                default: true,
                description: 'Include code examples in explanations',
              },
            },
          },
        },
        {
          name: 'clay_model_query',
          description:
            'Query model data using JSONPath. Returns only matched items, keeping context small. Uses the expanded model (includes resolved, mixins applied). Use this instead of reading the entire model file.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              json_path: {
                type: 'string',
                description: 'JSONPath expression (e.g., "$.model.entities[?(@.name==\'User\')]")',
              },
            },
            required: ['model_path', 'json_path'],
          },
        },
        {
          name: 'clay_model_add',
          description:
            'Add an item to an array or property to an object in a model file. Appends to arrays, merges into objects. Operates on raw file (preserves includes/mixins). Validates against $schema if present.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              json_path: {
                type: 'string',
                description: 'JSONPath to target array or object (e.g., "$.model.entities")',
              },
              value: {
                description: 'Value to add: appended if target is array, merged if target is object',
              },
            },
            required: ['model_path', 'json_path', 'value'],
          },
        },
        {
          name: 'clay_model_update',
          description:
            'Update fields on all items matched by JSONPath. Merges provided fields into each match. Operates on raw file (preserves includes/mixins). Validates against $schema if present.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              json_path: {
                type: 'string',
                description: 'JSONPath expression matching items to update',
              },
              fields: {
                type: 'object',
                description: 'Fields to merge into each matched item',
              },
            },
            required: ['model_path', 'json_path', 'fields'],
          },
        },
        {
          name: 'clay_model_delete',
          description:
            'Remove items matched by JSONPath from their parent arrays or objects. Operates on raw file (preserves includes/mixins). Validates against $schema if present.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              json_path: {
                type: 'string',
                description: 'JSONPath expression matching items to remove',
              },
            },
            required: ['model_path', 'json_path'],
          },
        },
        {
          name: 'clay_model_rename',
          description:
            'Rename a property key across all items matched by JSONPath. Operates on raw file (preserves includes/mixins). Validates against $schema if present.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              json_path: {
                type: 'string',
                description: 'JSONPath expression matching items whose property to rename',
              },
              old_name: {
                type: 'string',
                description: 'Current property name to rename',
              },
              new_name: {
                type: 'string',
                description: 'New property name',
              },
            },
            required: ['model_path', 'json_path', 'old_name', 'new_name'],
          },
        },
        {
          name: 'clay_model_set_schema',
          description:
            'Set or update the $schema reference on a model file. Validates current model against the schema and warns of violations (still writes the reference).',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              schema_path: {
                type: 'string',
                description: 'Path to JSON Schema file (relative to model file or absolute)',
              },
            },
            required: ['model_path', 'schema_path'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'clay_generate':
            return await generateTool(args || {});
          case 'clay_clean':
            return await cleanTool(args || {});
          case 'clay_test_path':
            return await testPathTool(args || {});
          case 'clay_init':
            return await initTool(args || {});
          case 'clay_list_generators':
            return await listGeneratorsTool(args || {});
          case 'clay_get_model_structure':
            return await getModelStructureTool(args || {});
          case 'clay_list_helpers':
            return await listHelpersTool(args || {});
          case 'clay_explain_concepts':
            return await explainConceptsTool(args || {});
          case 'clay_model_query':
            return await modelQueryTool(args || {});
          case 'clay_model_add':
            return await modelAddTool(args || {});
          case 'clay_model_update':
            return await modelUpdateTool(args || {});
          case 'clay_model_delete':
            return await modelDeleteTool(args || {});
          case 'clay_model_rename':
            return await modelRenameTool(args || {});
          case 'clay_model_set_schema':
            return await modelSetSchemaTool(args || {});
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message: `Error executing ${name}: ${errorMessage}`,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    });
  }

  /**
   * Setup prompt request handlers
   */
  private setupPromptHandlers(): void {
    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [
        {
          name: 'clay-getting-started',
          description:
            'Learn how to set up a Clay architecture and use the basic tools (clean and generate)',
          arguments: [],
        },
        {
          name: 'clay-workflow',
          description:
            'Understand the typical Clay workflow from creating models to generating code',
          arguments: [],
        },
      ],
    }));

    // Handle prompt requests
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name } = request.params;

      switch (name) {
        case 'clay-getting-started':
          return {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `# Clay Architecture and Basic Tools

## Overview
Clay is a code generator that transforms JSON models into code using Handlebars templates. The architecture follows a simple pattern:

**Model → Generator → Generated Code**

## Project Structure

A typical Clay project has this structure:

\`\`\`
project/
├── .clay                  # Tracks all models and generated files
├── models/                # Your JSON data models
│   └── api.model.json
├── generators/            # Template-based generators
│   └── typescript-api/
│       ├── generator.json # Generator configuration
│       └── templates/     # Handlebars templates
│           └── controller.hbs
└── output/                # Generated code (git-ignored)
    └── controllers/
        └── UserController.ts
\`\`\`

## Core Concepts

### 1. Models (JSON files)
Models contain your data structure in JSON format:

\`\`\`json
{
  "model": {
    "name": "UserAPI",
    "entities": [
      {
        "name": "User",
        "fields": [
          { "name": "id", "type": "number" },
          { "name": "email", "type": "string" }
        ]
      }
    ]
  }
}
\`\`\`

### 2. Generators (Configuration + Templates)
Generators define how to transform models into code:

**generator.json:**
\`\`\`json
{
  "name": "typescript-api",
  "description": "Generate TypeScript API code",
  "steps": [
    {
      "type": "each",
      "jsonPath": "$.model.entities[*]",
      "command": {
        "template": "controller.hbs",
        "output": "{{pascalCase name}}Controller.ts"
      }
    }
  ]
}
\`\`\`

**templates/controller.hbs:**
\`\`\`typescript
export class {{pascalCase name}}Controller {
  {{#each fields}}
  private {{camelCase name}}: {{type}};
  {{/each}}
}
\`\`\`

### 3. The .clay File
The \`.clay\` file tracks your project:
- All model paths and their associated generators
- All generated files for cleanup
- Generated automatically, committed to git

## Basic Tools

### clay_init - Initialize a Project
**Purpose:** Create a new Clay project or generator

\`\`\`typescript
// Initialize a Clay project (creates .clay file)
clay_init({ type: 'project' })

// Create a new generator structure
clay_init({ 
  type: 'generator',
  name: 'my-generator' 
})
\`\`\`

### clay_generate - Generate Code
**Purpose:** Transform models into code using generators

\`\`\`typescript
// Regenerate ALL models tracked in .clay (recommended)
clay_generate({})

// Generate from a specific model
clay_generate({
  model_path: 'models/api.model.json',
  output_path: 'output/api'
})
\`\`\`

**Key Points:**
- Parameterless \`clay_generate({})\` regenerates everything
- Updates .clay file to track generated files
- Idempotent - safe to run multiple times
- Generated files should be git-ignored

### clay_clean - Remove Generated Files
**Purpose:** Clean up all files tracked in .clay

\`\`\`typescript
// Clean ALL generated files
clay_clean({})

// Clean files from a specific model
clay_clean({
  model_path: 'models/api.model.json',
  output_path: 'output/api'
})
\`\`\`

**Key Points:**
- Only removes files tracked in .clay
- Safe - won't delete untracked files
- Run before major refactoring
- Useful when changing generator structure

## Typical Workflow

### 1. Initial Setup
\`\`\`typescript
// Step 1: Initialize project
clay_init({ type: 'project' })

// Step 2: Create a generator
clay_init({ 
  type: 'generator',
  name: 'typescript-api' 
})
\`\`\`

### 2. Create Your First Model
Create \`models/users.model.json\`:
\`\`\`json
{
  "model": {
    "name": "Users",
    "entities": [
      { "name": "User", "type": "entity" },
      { "name": "Admin", "type": "entity" }
    ]
  },
  "generator": "typescript-api",
  "outputPath": "output/users"
}
\`\`\`

### 3. Configure Generator
Edit \`generators/typescript-api/generator.json\` and create templates in \`templates/\`

### 4. Generate Code
\`\`\`typescript
// Generate from your model
clay_generate({
  model_path: 'models/users.model.json',
  output_path: 'output/users'
})
\`\`\`

This creates files and updates .clay to track them.

### 5. Make Changes and Regenerate
Edit your model or templates, then:
\`\`\`typescript
// Regenerate everything
clay_generate({})
\`\`\`

### 6. Clean Up When Needed
\`\`\`typescript
// Remove all generated files
clay_clean({})
\`\`\`

## Best Practices

1. **Always use .clay tracking:**
   - Run \`clay_generate\` with model and output paths first time
   - Use parameterless \`clay_generate({})\` for subsequent runs

2. **Git ignore generated files:**
   \`\`\`gitignore
   output/
   generated/
   \`\`\`
   But commit \`.clay\` to track what gets generated

3. **Use clay_clean before major changes:**
   - Changing generator structure
   - Renaming models
   - Refactoring output paths

4. **Keep models simple:**
   - Pure data structures
   - Use mixins for transformations (see clay_explain_concepts)

5. **Leverage available tools:**
   - \`clay_test_path\` - Test JSONPath expressions
   - \`clay_get_model_structure\` - Inspect model data
   - \`clay_list_helpers\` - See available template helpers
   - \`clay_explain_concepts\` - Get detailed documentation

## Common Patterns

### Pattern 1: Multiple Files per Entity
\`\`\`json
{
  "steps": [
    {
      "type": "each",
      "jsonPath": "$.model.entities[*]",
      "command": [
        { "template": "entity.hbs", "output": "{{name}}.ts" },
        { "template": "test.hbs", "output": "{{name}}.test.ts" }
      ]
    }
  ]
}
\`\`\`

### Pattern 2: Single File for All Data
\`\`\`json
{
  "steps": [
    {
      "type": "command",
      "command": {
        "template": "index.hbs",
        "output": "index.ts"
      }
    }
  ]
}
\`\`\`

### Pattern 3: Copy Static Files
\`\`\`json
{
  "steps": [
    {
      "type": "copy",
      "copy": "assets/logo.png",
      "output": "logo.png"
    }
  ]
}
\`\`\`

## Next Steps

Once comfortable with basics, explore:
- **Context Variables:** \`clay_key\`, \`clay_parent\`, \`clay_index\` (use \`clay_explain_concepts\`)
- **JSONPath Selectors:** Complex data queries (use \`clay_test_path\` to experiment)
- **Mixins:** Transform models before generation
- **Handlebars Helpers:** 47+ helpers for string manipulation, logic, etc.

Use \`clay_explain_concepts({ topic: 'all' })\` for comprehensive documentation!`,
                },
              },
            ],
          };

        case 'clay-workflow':
          return {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `# Clay Workflow Guide

This guide walks through a complete workflow from start to finish.

## The Development Cycle

### Phase 1: Project Setup

1. **Initialize Clay project:**
   \`\`\`typescript
   clay_init({ type: 'project' })
   \`\`\`
   Creates \`.clay\` file in current directory.

2. **Create directory structure:**
   \`\`\`
   mkdir -p models generators output
   \`\`\`

3. **Set up .gitignore:**
   \`\`\`gitignore
   output/
   generated/
   \`\`\`

### Phase 2: Generator Creation

1. **Initialize generator:**
   \`\`\`typescript
   clay_init({ 
     type: 'generator',
     name: 'api-generator' 
   })
   \`\`\`
   Creates \`generators/api-generator/\` structure.

2. **Configure generator.json:**
   \`\`\`json
   {
     "name": "api-generator",
     "description": "Generate API code",
     "steps": [
       {
         "type": "each",
         "jsonPath": "$.model.endpoints[*]",
         "command": {
           "template": "endpoint.hbs",
           "output": "{{pascalCase name}}.ts"
         }
       }
     ]
   }
   \`\`\`

3. **Create templates:**
   Create \`generators/api-generator/templates/endpoint.hbs\`
   
   Use \`clay_list_helpers()\` to discover available helpers.

### Phase 3: Model Creation

1. **Create your data model:**
   \`\`\`json
   {
     "model": {
       "name": "UserAPI",
       "endpoints": [
         { "name": "getUser", "method": "GET" },
         { "name": "createUser", "method": "POST" }
       ]
     },
     "generator": "api-generator",
     "outputPath": "output/api"
   }
   \`\`\`

2. **Validate model structure:**
   \`\`\`typescript
   clay_get_model_structure({
     model_path: 'models/api.model.json'
   })
   \`\`\`

3. **Test JSONPath expressions:**
   \`\`\`typescript
   clay_test_path({
     model_path: 'models/api.model.json',
     json_path: '$.model.endpoints[*].name'
   })
   // Returns: ["getUser", "createUser"]
   \`\`\`

### Phase 4: First Generation

1. **Generate code:**
   \`\`\`typescript
   clay_generate({
     model_path: 'models/api.model.json',
     output_path: 'output/api'
   })
   \`\`\`

2. **Review output:**
   Check \`output/api/\` for generated files.

3. **Verify .clay tracking:**
   The \`.clay\` file now tracks your model and generated files.

### Phase 5: Iteration

1. **Modify your model** (add fields, change data):
   Edit \`models/api.model.json\`

2. **Update templates** (improve formatting, add logic):
   Edit \`generators/api-generator/templates/\`

3. **Regenerate everything:**
   \`\`\`typescript
   clay_generate({})
   \`\`\`
   This regenerates ALL models tracked in .clay.

4. **Review changes:**
   Generated files are updated automatically.

### Phase 6: Clean Up

When you need to remove generated files:

1. **Clean everything:**
   \`\`\`typescript
   clay_clean({})
   \`\`\`

2. **Or clean specific model:**
   \`\`\`typescript
   clay_clean({
     model_path: 'models/api.model.json',
     output_path: 'output/api'
   })
   \`\`\`

## Real-World Example

Let's build a TypeScript DTO generator:

### 1. Setup
\`\`\`typescript
clay_init({ type: 'project' })
clay_init({ type: 'generator', name: 'typescript-dto' })
\`\`\`

### 2. Configure Generator
\`generators/typescript-dto/generator.json\`:
\`\`\`json
{
  "name": "typescript-dto",
  "steps": [
    {
      "type": "each",
      "jsonPath": "$.model.entities[*]",
      "command": {
        "template": "dto.hbs",
        "output": "{{pascalCase name}}DTO.ts"
      }
    },
    {
      "type": "command",
      "command": {
        "template": "index.hbs",
        "output": "index.ts"
      }
    }
  ]
}
\`\`\`

### 3. Create Templates
\`generators/typescript-dto/templates/dto.hbs\`:
\`\`\`typescript
export interface {{pascalCase name}}DTO {
  {{#each fields}}
  {{camelCase name}}: {{type}};
  {{/each}}
}
\`\`\`

\`generators/typescript-dto/templates/index.hbs\`:
\`\`\`typescript
{{#each model.entities}}
export * from './{{pascalCase name}}DTO';
{{/each}}
\`\`\`

### 4. Create Model
\`models/user.model.json\`:
\`\`\`json
{
  "model": {
    "entities": [
      {
        "name": "User",
        "fields": [
          { "name": "id", "type": "string" },
          { "name": "email", "type": "string" },
          { "name": "created_at", "type": "Date" }
        ]
      },
      {
        "name": "Post",
        "fields": [
          { "name": "id", "type": "string" },
          { "name": "title", "type": "string" },
          { "name": "author_id", "type": "string" }
        ]
      }
    ]
  },
  "generator": "typescript-dto",
  "outputPath": "output/dtos"
}
\`\`\`

### 5. Generate
\`\`\`typescript
clay_generate({
  model_path: 'models/user.model.json',
  output_path: 'output/dtos'
})
\`\`\`

**Result:**
- \`output/dtos/UserDTO.ts\`
- \`output/dtos/PostDTO.ts\`
- \`output/dtos/index.ts\`

### 6. Add More Entities
Edit \`models/user.model.json\`, add \`Comment\` entity.

\`\`\`typescript
clay_generate({})  // Regenerates everything
\`\`\`

**Result:**
- All previous files updated
- New \`CommentDTO.ts\` created
- \`index.ts\` updated with new export

## Tips for Productive Workflow

1. **Use parameterless generate:** After initial setup, always use \`clay_generate({})\`

2. **Test as you build:** Use \`clay_test_path\` to verify JSONPath expressions

3. **Discover helpers:** Use \`clay_list_helpers\` when writing templates

4. **Inspect models:** Use \`clay_get_model_structure\` to understand data

5. **Learn incrementally:** Use \`clay_explain_concepts\` for specific topics

6. **Clean before restructuring:** Run \`clay_clean({})\` before major changes

## Common Scenarios

### Scenario: Adding a New Model
1. Create model JSON file
2. \`clay_generate({ model_path: '...', output_path: '...' })\`
3. From now on: \`clay_generate({})\` regenerates all

### Scenario: Changing Generator Templates
1. Edit template files
2. \`clay_generate({})\` to regenerate all models

### Scenario: Renaming Output Directory
1. \`clay_clean({})\` to remove old files
2. Update model's \`outputPath\`
3. \`clay_generate({ model_path: '...', output_path: '...' })\`

### Scenario: Starting Over
1. \`clay_clean({})\` to remove all generated files
2. Delete \`.clay\` file
3. \`clay_init({ type: 'project' })\`
4. Regenerate: \`clay_generate({ model_path: '...', output_path: '...' })\` for each model

## Advanced Topics

For more advanced usage, explore:
- **Context variables** (\`clay_key\`, \`clay_parent\`, etc.)
- **Mixins** for model transformations
- **Partials** for template reuse
- **Conditional generation** with helpers

Use \`clay_explain_concepts({ topic: 'all' })\` for complete documentation.`,
                },
              },
            ],
          };

        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Check if Clay is available
    if (!isClayAvailable()) {
      console.error('ERROR: Clay CLI is not available in PATH');
      console.error(
        'Please install Clay globally: npm install -g clay-generator'
      );
      process.exit(1);
    }

    const version = getClayVersion();
    console.error(`Clay MCP Server starting (Clay version: ${version})...`);

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('Clay MCP Server running on stdio');
  }
}

// Start the server
const server = new ClayMCPServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
