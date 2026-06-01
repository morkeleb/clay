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
            'Add an item to an array or property to an object in a model file. Appends to arrays, merges into objects. Include-aware: queries the expanded model (includes resolved) to find targets, then writes to the correct source file (main model or included file). Returns source_file when mutation goes to an included file. Validates against $schema if present.',
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
            'Update fields on all items matched by JSONPath. Merges provided fields into each match. Include-aware: queries the expanded model (includes resolved) to find targets, then writes to the correct source file(s). Returns source_file or files_modified when mutations span included files. Validates against $schema if present.',
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
            'Remove items matched by JSONPath from their parent arrays or objects. Include-aware: queries the expanded model (includes resolved) to find targets. Deleting inside an included entity edits the included file. Deleting an included entity itself removes the include reference from the main model. Validates against $schema if present.',
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
            'Rename a property key across all items matched by JSONPath. Include-aware: queries the expanded model (includes resolved) to find targets, then renames in the correct source file(s). Returns source_file or files_modified when mutations span included files. Validates against $schema if present.',
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
        {
          name: 'clay-architecture-mindset',
          description:
            'Learn how to think with Clay: model-first development, generated vs hand-written code, extension points, and pattern recognition',
          arguments: [],
        },
        {
          name: 'clay-analyze',
          description:
            'Analyze a codebase to identify repeating patterns and propose a Clay model and generators',
          arguments: [],
        },
        {
          name: 'clay-refactor-to-generator',
          description:
            'Extract a Clay generator from a set of similar files by identifying the common structure and variable parts',
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
Clay is a code generator that transforms JSON models into code using templates. It supports multiple template engines: Handlebars (.hbs) for simple templates, EJS (.ejs) for templates needing inline logic, and TypeScript/JavaScript (.ts/.js) via the CodeGenerator base class for fully programmatic generation. The architecture follows a simple pattern:

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
│       └── templates/     # Templates (Handlebars, EJS, or TypeScript)
│           ├── controller.hbs
│           └── service.ts
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

**templates/controller.hbs** (Handlebars — simple substitution):
\`\`\`typescript
export class {{pascalCase name}}Controller {
  {{#each fields}}
  private {{camelCase name}}: {{type}};
  {{/each}}
}
\`\`\`

**templates/service.ts** (TypeScript — programmatic generation):
\`\`\`typescript
import { CodeGenerator, type RenderContext } from 'clay-generator/types';

export default class extends CodeGenerator {
  render({ data, helpers }: RenderContext): string {
    const { pascalCase, camelCase } = helpers;
    return \\\`export class \${pascalCase(data.name)}Service {
  \${data.fields.map((f: any) => \\\`private \${camelCase(f.name)}: \${f.type};\\\`).join('\\n  ')}
}\\\`;
  }
}
\`\`\`

Generator steps use the optional \`engine\` field to select the template engine (\`"handlebars"\` is the default):
\`\`\`json
{ "generate": "controller.hbs", "select": "$.model.entities[*]", "target": "{{pascalCase name}}Controller.ts" }
{ "generate": "service.ts", "select": "$.model.entities[*]", "target": "{{pascalCase name}}Service.ts", "engine": "ts" }
{ "generate": "index.ejs", "select": "$.model", "target": "index.ts", "engine": "ejs" }
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

## Choosing a Template Engine

| Engine | Best for | Syntax |
|---|---|---|
| **Handlebars** (default) | Simple substitution, iteration, conditionals | \`{{pascalCase name}}\`, \`{{#each fields}}\` |
| **EJS** | Templates that need inline logic (filtering, computation) | \`<%= helpers.pascalCase(name) %>\`, \`<% if (...) { %>\` |
| **TypeScript** | Complex generation: cross-entity references, unique imports, graph traversal | \`CodeGenerator\` class with full JS/TS |

**Rules of thumb:**
- Start with Handlebars — it covers most templates
- Switch to EJS when you need a few lines of logic inside an otherwise template-like file
- Switch to TypeScript when the generation logic is more code than template (e.g., wiring files, DI containers, route registrations, index files that aggregate across entities)

TypeScript templates use the \`CodeGenerator\` base class:
\`\`\`typescript
import { CodeGenerator, type RenderContext } from 'clay-generator/types';

export default class extends CodeGenerator {
  render({ data, helpers, model }: RenderContext): string {
    // data: the selected model item
    // helpers: Clay helpers (pascalCase, camelCase, pluralize, etc.)
    // model: the full root model for cross-references
    return \\\`...\\\`;
  }
}
\`\`\`

TypeScript templates can also read the filesystem, making them ideal for barrel files and registrations that must reflect what actually exists on disk:
\`\`\`typescript
import { CodeGenerator, type RenderContext } from 'clay-generator/types';
import fs from 'fs';
import path from 'path';

export default class extends CodeGenerator {
  render({ data, helpers }: RenderContext): string {
    const dir = path.resolve('src/services');
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.ts') && f !== 'index.ts')
      .map(f => f.replace('.ts', ''));
    return files.map(f => \\\`export * from './\${f}';\\\`).join('\\n');
  }
}
\`\`\`

## Next Steps

Once comfortable with basics, explore:
- **Context Variables:** \`clay_key\`, \`clay_parent\`, \`clay_index\` (use \`clay_explain_concepts\`)
- **JSONPath Selectors:** Complex data queries (use \`clay_test_path\` to experiment)
- **Mixins:** Transform models before generation
- **Template Helpers:** 47+ helpers for string manipulation, logic, etc. (available in all engines)

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

        case 'clay-architecture-mindset':
          return {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `# Clay Architecture Mindset

## How to Think With Clay

Clay is not just a code generator — it is a way to encode architectural patterns so they stay consistent as a project grows. When working in a Clay project, adopt a **model-first** mindset: define the structure in the model, let generators produce the scaffolding, and focus your effort on the parts that require human judgment.

## The Core Principle

Every codebase has two kinds of code:

1. **Structural code** — follows repeating patterns. Controllers that all look the same, entities with the same base fields, event handlers wired up identically. This code is Clay's job.
2. **Business logic** — unique to each feature. Validation rules, calculations, domain-specific behavior. This is your job.

Clay generates the first kind. You fill in the second kind at designated **extension points**.

## Model First, Code Second

When adding a new feature to a Clay project:

1. **Update the model** — add the new entity, command, or event to the model JSON
2. **Run \`clay_generate({})\`** — let generators produce all the structural files
3. **Find the extension points** — look for touch files and fill in the business logic
4. **Never hand-write structural code** — if it follows a pattern that already has a generator, it belongs in the model

This is the opposite of the typical approach where you copy an existing file and modify it. With Clay, you declare the *what* (model) and the generators handle the *how* (code structure).

## Understanding What Clay Owns

### The .clay Inventory File

The \`.clay\` file tracks every generated file with its MD5 checksum. Use it to understand:
- **Which files are generated** — listed in \`generated_files\` with checksums
- **Which models produce which files** — each model entry maps to its outputs
- **When files were last generated** — \`last_generated\` timestamp

\`\`\`json
{
  "models": [
    {
      "path": "clay/model.json",
      "output": "src/",
      "generated_files": {
        "src/entities/Order.ts": { "md5": "abc123", "date": "..." },
        "src/entities/User.ts": { "md5": "def456", "date": "..." }
      }
    }
  ]
}
\`\`\`

**Rule: Never manually edit files tracked in \`.clay\`.** They will be overwritten on the next generation. If you need to change the structure, change the template. If you need to change the data, change the model.

### Touch Files — Extension Points

Generator steps with \`touch: true\` create files **once** but never overwrite them:

\`\`\`json
{
  "generate": "templates/service-impl.hbs",
  "select": "$.model.types[*]",
  "target": "src/services/{{pascalCase name}}Service.ts",
  "touch": true
}
\`\`\`

Touch files are **not tracked** in \`.clay\` (no checksum). This is the explicit contract:
- Clay creates the initial scaffold (imports, class skeleton, method stubs)
- You fill in the implementation (business logic, validation, custom behavior)
- Clay will never overwrite your work

**When you see a touch file, that is where business logic belongs.**

## Recognizing Patterns

When you encounter a codebase, look for these signals that code should be generated:

### Strong Signals
- **N files with identical structure** — only names and a few values differ
- **Copy-paste with find-replace** — developers duplicating files and changing names
- **Boilerplate that must stay in sync** — when changing a pattern means updating every instance
- **Structural code that matches a JSONPath query** — if you can describe "all X that have Y" in a path expression, it is probably a generator step

### What to Look For
- How are entities/types structured? Same fields appearing across files?
- Is there a naming convention? (PascalCase classes, kebab-case files, etc.)
- Are there parallel file sets? (entity + controller + test + migration per type)
- What parts vary between instances vs. what stays the same?

### What Does NOT Belong in a Generator
- One-off configuration files
- Business logic that differs meaningfully per instance
- Code that requires human judgment to write correctly

## Working With an Existing Clay Project

When you encounter a project that already uses Clay:

1. **Read \`.clay\`** to understand which models and generators exist
2. **Read the model files** to understand the domain structure
3. **Use \`clay_get_model_structure\`** to see the model shape
4. **Identify touch files** — files generated with \`touch: true\` that contain hand-written business logic
5. **Check \`generated_files\`** in \`.clay\` to know which files you should NOT edit directly

### Adding to an Existing Model

\`\`\`typescript
// 1. Add the new entity
clay_model_add({
  model_path: 'clay/model.json',
  json_path: '$.model.types',
  value: { "name": "Invoice", "fields": [...] }
})

// 2. Generate — new files appear
clay_generate({})

// 3. Find and fill in touch files (extension points)
\`\`\`

### Modifying Generated Structure

If the generated code needs a different structure:
- **Change the template**, not the generated file
- **Change the model**, not the generated file
- **Add a mixin** if you need to transform model data before generation
- **Add a convention** if you need to validate the model structure

## Choosing the Right Template Engine

Generator steps support an optional \`engine\` field: \`"handlebars"\` (default), \`"ejs"\`, or \`"ts"\`.

| Use case | Engine | Why |
|---|---|---|
| Entity files, DTOs, interfaces | Handlebars | Simple substitution, easy to read |
| Touch file scaffolds | Handlebars | Just a skeleton, simplicity wins |
| Files needing inline computation | EJS | Filter, deduplicate, compute inside template |
| Wiring files (DI, routes, registrations) | TypeScript | Need to compute across all entities |
| Complex structural files (sagas, pipelines) | TypeScript | Cross-references, conditional logic |

TypeScript templates use the \`CodeGenerator\` base class. All available data is passed via the \`RenderContext\` parameter:

\`\`\`typescript
import { CodeGenerator, type RenderContext } from 'clay-generator/types';

export default class extends CodeGenerator {
  render({ data, helpers, model, parent }: RenderContext): string {
    // data: the selected model item
    // helpers: all Clay helpers (pascalCase, camelCase, pluralize, etc.)
    // model: the full root model for cross-entity references
    // parent: parent object in the JSON hierarchy
    return \\\`...\\\`;
  }
}
\`\`\`

**Filesystem-aware generation:** Because TypeScript templates can read the filesystem, they are ideal for barrel files, route registrations, and DI containers that need to reflect what actually exists on disk:

\`\`\`typescript
import { CodeGenerator, type RenderContext } from 'clay-generator/types';
import fs from 'fs';
import path from 'path';

export default class extends CodeGenerator {
  render({ data, helpers }: RenderContext): string {
    const dir = path.resolve('src/services');
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.ts') && f !== 'index.ts')
      .map(f => f.replace('.ts', ''));

    return files.map(f => \\\`export * from './\${f}';\\\`).join('\\n');
  }
}
\`\`\`

This pattern ensures barrel files, route registrations, and module declarations always match what is actually on disk — no stale exports for deleted files, no missing exports for new ones.

**The key insight:** Handlebars handles the 80% of templates that are mostly output with simple substitution. TypeScript handles the 20% that are mostly logic — the architectural glue files that need to reason across the model or the filesystem.

## Using $schema for Validation

If a model has a \`$schema\` reference, all mutations are validated against it:

\`\`\`json
{
  "$schema": "./schemas/api-model.schema.json",
  "name": "my-api",
  "model": { ... }
}
\`\`\`

Use \`clay_model_set_schema\` to add schema validation to a model. This catches structural errors (typos, missing required fields) before generation runs.

## Post-Generation Hooks

Generators can define \`postGenerate\` hooks that run after all files are written to disk. Hooks are best-effort — failures are warnings, not errors.

### TypeScript hooks (PostGenerateHook)

The primary hook type. Uses the same pattern as \`CodeGenerator\` — a base class with a typed context:

\`\`\`json
{
  "steps": [...],
  "postGenerate": [
    { "run": "hooks/fill-services.ts", "select": "$.model.types[*]", "onlyNewTouchFiles": true },
    { "runCommand": "prettier --write src/" }
  ]
}
\`\`\`

\`\`\`typescript
import { PostGenerateHook, type HookContext } from 'clay-generator/types';
import { execSync } from 'child_process';
import fs from 'fs';

export default class extends PostGenerateHook {
  async run({ data, helpers, touchFiles, outputDir }: HookContext): Promise<void> {
    const { pascalCase } = helpers;

    // Read the generated interface for context
    const iface = fs.readFileSync(
      \\\`\${outputDir}/src/services/I\${pascalCase(data.name)}Service.ts\\\`, 'utf-8'
    );

    for (const file of touchFiles) {
      const prompt = \\\`Implement \${pascalCase(data.name)}ServiceImpl following this interface:\\n\${iface}\\\`;
      execSync(\\\`claude -p '\${prompt}'\\\`, { cwd: outputDir, timeout: 60000 });
    }
  }
}
\`\`\`

### HookContext

The \`run()\` method receives:
- \`data\` — the selected model item (same as CodeGenerator)
- \`helpers\` — Clay helpers (pascalCase, camelCase, etc.)
- \`model\` — full root model
- \`touchFiles\` — only files **newly created** this run (not previously existing)
- \`outputDir\` — generator output directory
- \`generatedFiles\` — all files generated this run

### Key flags
- \`onlyNewTouchFiles: true\` — skip items where no new touch files were created. This prevents re-running Claude on files the developer already customized.
- Hooks run **sequentially** (hook 2 waits for hook 1). Within a hook with \`select\`, per-item calls run **in parallel**.

### AI-assisted workflow

The intended workflow with a governing Claude process:
1. Governing Claude updates the Clay model
2. Runs \`clay generate\`
3. Clay generates structural files + touch file skeletons
4. Post-generate hooks fire — each spawns a focused \`claude -p\` with tight context (interface + entity data)
5. Governing Claude reviews the results

This is more effective than the governing Claude filling in every file because each worker Claude gets a **smaller, focused context** instead of the entire project.

## Summary

| Situation | Action |
|---|---|
| Adding a new entity/feature | Update the model, generate, fill in touch files |
| Fixing generated code structure | Edit the template, regenerate |
| Fixing business logic | Edit the touch file directly |
| See N similar files | Consider whether they should be a generator |
| Need to change model data | Use clay_model_update, not manual JSON editing |
| Not sure what is generated | Check .clay for the file's checksum |`,
                },
              },
            ],
          };

        case 'clay-analyze':
          return {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `# Clay Analyze — Identify Patterns in a Codebase

## Purpose

Analyze a codebase to discover repeating structural patterns that could be captured as Clay generators. The goal is to find code that follows consistent patterns and propose a model + generator structure that would produce it.

## Step-by-Step Workflow

### Step 1: Survey the Project Structure

Start by understanding the project layout:

\`\`\`
- List the top-level directories
- Identify where source code lives (src/, lib/, app/, etc.)
- Look for existing patterns in directory naming
- Check for an existing .clay file (project may already use Clay)
\`\`\`

**What to look for:**
- Parallel directory structures (e.g., \`controllers/\`, \`services/\`, \`repositories/\` each with matching files)
- Naming conventions in filenames (PascalCase, kebab-case, suffixes like Controller, Service, etc.)
- Configuration files that enumerate things (routes, DI containers, module registrations)

### Step 2: Identify Repeating File Sets

Find groups of files that follow the same pattern. For each group:

1. **Pick 3+ files** that look structurally similar
2. **Diff them mentally** — what stays the same vs. what changes?
3. **Categorize the variable parts:**
   - **Names** — entity/type names in different casings (PascalCase, camelCase, etc.)
   - **Fields/properties** — lists of attributes that vary per entity
   - **Relationships** — references to other entities
   - **Configuration** — flags, options, settings that differ per instance

**Example finding:**
\`\`\`
Found 8 files matching pattern: src/controllers/*Controller.ts
- All export a class named {Name}Controller
- All have the same CRUD methods (list, get, create, update, delete)
- All inject a {Name}Service in the constructor
- The fields in create/update DTOs vary per entity
→ This is a strong generator candidate
\`\`\`

### Step 3: Map Findings to a Model Structure

For each group of similar files, determine what model data would be needed to generate them:

\`\`\`json
{
  "model": {
    "types": [
      {
        "name": "Order",
        "fields": [
          { "name": "customerId", "type": "string" },
          { "name": "totalAmount", "type": "number" }
        ],
        "commands": [
          { "name": "create" },
          { "name": "cancel" }
        ]
      }
    ]
  }
}
\`\`\`

**Key questions:**
- What is the top-level grouping? (types, entities, resources, endpoints?)
- What properties does each item need? (name, fields, relationships, flags?)
- Are there nested structures? (fields within types, parameters within commands?)
- What JSONPath would select these items? (e.g., \`$.model.types[*]\`)

### Step 4: Map Each File Pattern to a Generator Step

For each repeating file pattern, define a generator step:

\`\`\`json
{
  "steps": [
    {
      "generate": "templates/controller.hbs",
      "select": "$.model.types[*]",
      "target": "src/controllers/{{pascalCase name}}Controller.ts"
    },
    {
      "generate": "templates/service.hbs",
      "select": "$.model.types[*]",
      "target": "src/services/{{pascalCase name}}Service.ts"
    },
    {
      "generate": "templates/service-impl.hbs",
      "select": "$.model.types[*]",
      "target": "src/services/impl/{{pascalCase name}}ServiceImpl.ts",
      "touch": true
    }
  ]
}
\`\`\`

**Deciding between generate and touch:**
- If the file is purely structural (same pattern every time) → \`generate\`
- If the file needs hand-written business logic → \`touch: true\`
- If unsure, look at the file: does it contain logic that differs meaningfully between instances, or just boilerplate with different names?

**Choosing the template engine:**

Generator steps support an optional \`engine\` field. Choose based on complexity:
- **Handlebars** (default, no \`engine\` field needed) — simple per-entity files where the output is mostly static with name substitution and field iteration
- **EJS** (\`"engine": "ejs"\`) — when you need a few lines of computation inside an otherwise template-like file
- **TypeScript** (\`"engine": "ts"\`) — when the file requires real logic: unique imports, cross-entity references, conditional wiring, aggregation

\`\`\`json
{ "generate": "templates/entity.hbs", "select": "$.model.types[*]", "target": "..." },
{ "generate": "templates/di-container.ts", "select": "$.model", "target": "...", "engine": "ts" }
\`\`\`

### Step 5: Identify Index/Registry/Wiring Files

Look for files that aggregate or register all instances:

- Route registrations (\`routes/index.ts\`)
- Module imports (\`index.ts\` barrel files)
- DI container registrations
- Configuration arrays

These files often need to compute across all entities (unique imports, conditional registrations). They are strong candidates for the **TypeScript engine** with the \`CodeGenerator\` base class:

\`\`\`json
{
  "generate": "templates/routes-index.ts",
  "select": "$.model",
  "target": "src/routes/index.ts",
  "engine": "ts"
}
\`\`\`

\`\`\`typescript
// templates/routes-index.ts
import { CodeGenerator, type RenderContext } from 'clay-generator/types';

export default class extends CodeGenerator {
  render({ data, helpers }: RenderContext): string {
    const { pascalCase, kebabCase } = helpers;
    const types = data.model.types;

    const imports = types
      .map((t: any) => \\\`import { \${pascalCase(t.name)}Controller } from './\${pascalCase(t.name)}Controller';\\\`)
      .join('\\n');

    const routes = types
      .map((t: any) => \\\`  router.use('/\${kebabCase(t.name)}', new \${pascalCase(t.name)}Controller().routes());\\\`)
      .join('\\n');

    return \\\`\${imports}\\n\\nexport function registerRoutes(router: Router) {\\n\${routes}\\n}\\\`;
  }
}
\`\`\`

For simple index files (barrel exports), Handlebars may still suffice. Use TypeScript when the file needs filtering, deduplication, or conditional logic.

### Step 6: Present Findings

Summarize your analysis as:

1. **Patterns found** — each group of similar files with the count and what varies
2. **Proposed model structure** — the JSON model that captures the domain
3. **Proposed generator steps** — which templates to create, with generate vs. touch decisions
4. **Extension points** — which files should be touch files where business logic goes
5. **What does NOT fit** — files that are unique and should remain hand-written

## Tips

- **Start with the most repeated pattern.** If there are 12 controllers and 3 utility files, focus on the controllers first.
- **Use \`clay_test_path\`** to validate your JSONPath expressions against the proposed model.
- **Check for existing generators** with \`clay_list_generators\` — the project may already have generators for some patterns.
- **Look at imports** — they often reveal relationships between entities that should be in the model.
- **Count the files** — if a pattern only appears twice, it might not be worth generating. Three or more is the sweet spot.`,
                },
              },
            ],
          };

        case 'clay-refactor-to-generator':
          return {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `# Clay Refactor to Generator — Extract a Generator From Similar Files

## Purpose

Take a set of similar files and extract a Clay generator: a template (Handlebars, EJS, or TypeScript) that produces all of them, a model that captures what varies, and a generator step that wires them together.

## Step-by-Step Workflow

### Step 1: Collect the Source Files

Gather 3 or more files that follow the same pattern. Read them all and confirm they are structurally similar.

**Good candidates:**
- Files with the same suffix (UserController.ts, OrderController.ts, ProductController.ts)
- Files in the same directory with matching structure
- Files that were clearly copy-pasted and modified

### Step 2: Create a Diff Table

For each file, identify what is **constant** (same across all files) vs. **variable** (differs per file).

\`\`\`
File: UserController.ts    OrderController.ts    ProductController.ts
──────────────────────────────────────────────────────────────────────
Class name:   UserController       OrderController       ProductController
              → {{pascalCase name}}Controller

Service:      UserService          OrderService          ProductService
              → {{pascalCase name}}Service

Fields:       id, email, name      id, total, status     id, title, price
              → {{#each fields}}

Methods:      getAll, getById,     getAll, getById,      getAll, getById,
              create, update       create, update,       create, update
                                   cancel
              → mostly constant, some vary → consider commands array
\`\`\`

### Step 3: Identify the Variable Types

Classify each variable part:

| Variable part | Template approach |
|---|---|
| Entity name in different casings | \`{{pascalCase name}}\`, \`{{camelCase name}}\`, \`{{kebabCase name}}\` |
| List of fields/properties | \`{{#each fields}}...{{/each}}\` |
| Optional sections | \`{{#if hasTimestamps}}...{{/if}}\` |
| Conditional logic | \`{{#eq type "string"}}...{{/eq}}\` |
| References to other entities | \`{{pascalCase type}}\` on field with type reference |
| Repeated sub-patterns | Handlebars partial: \`{{> fieldDeclaration}}\` |

### Step 4: Build the Template

Start from one of the source files and replace variable parts with Handlebars expressions:

**Before (UserController.ts):**
\`\`\`typescript
import { UserService } from '../services/UserService';

export class UserController {
  constructor(private service: UserService) {}

  async getAll(): Promise<User[]> {
    return this.service.findAll();
  }

  async getById(id: string): Promise<User> {
    return this.service.findById(id);
  }

  async create(data: CreateUserDTO): Promise<User> {
    return this.service.create(data);
  }
}
\`\`\`

**After (controller.hbs):**
\`\`\`typescript
import { {{pascalCase name}}Service } from '../services/{{pascalCase name}}Service';

export class {{pascalCase name}}Controller {
  constructor(private service: {{pascalCase name}}Service) {}

  async getAll(): Promise<{{pascalCase name}}[]> {
    return this.service.findAll();
  }

  async getById(id: string): Promise<{{pascalCase name}}> {
    return this.service.findById(id);
  }

  async create(data: Create{{pascalCase name}}DTO): Promise<{{pascalCase name}}> {
    return this.service.create(data);
  }
}
\`\`\`

### Step 5: Build the Model Entry

Define what data each instance needs:

\`\`\`json
{
  "model": {
    "types": [
      {
        "name": "user",
        "fields": [
          { "name": "id", "type": "string" },
          { "name": "email", "type": "string" },
          { "name": "name", "type": "string" }
        ]
      },
      {
        "name": "order",
        "fields": [
          { "name": "id", "type": "string" },
          { "name": "total", "type": "number" },
          { "name": "status", "type": "string" }
        ]
      }
    ]
  }
}
\`\`\`

### Step 6: Define the Generator Step

\`\`\`json
{
  "steps": [
    {
      "generate": "templates/controller.hbs",
      "select": "$.model.types[*]",
      "target": "src/controllers/{{pascalCase name}}Controller.ts"
    }
  ]
}
\`\`\`

### Step 7: Decide What Gets Generated vs. Touched

For each file in the set, ask: **"If I regenerate this, will I lose important work?"**

- **Pure scaffolding** (no hand-written logic inside) → \`generate\` (Clay owns it)
- **Skeleton with business logic** (hand-written implementations inside) → \`touch: true\` (Clay creates it once, you own it)
- **Mix of both** → split into two files: a generated base/interface + a touch implementation

**Common pattern:**
\`\`\`json
{
  "steps": [
    {
      "generate": "templates/service-interface.hbs",
      "select": "$.model.types[*]",
      "target": "src/services/I{{pascalCase name}}Service.ts"
    },
    {
      "generate": "templates/service-impl.hbs",
      "select": "$.model.types[*]",
      "target": "src/services/{{pascalCase name}}ServiceImpl.ts",
      "touch": true
    }
  ]
}
\`\`\`

### Step 8: Verify Round-Trip

After creating the template and model:

1. **Use \`clay_test_path\`** to verify the JSONPath selects the right items
2. **Run \`clay_generate\`** to produce the files
3. **Diff generated output against originals** — they should be structurally identical
4. If there are differences, adjust the template or model until they match

### Step 9: Handle Edge Cases

Things that commonly trip up template extraction:

- **Imports that vary** — may need a conditional or an imports array in the model
- **Optional sections** — use \`{{#if property}}...{{/if}}\` or \`{{#propertyExists this "property"}}...{{/propertyExists}}\`
- **Pluralization** — use \`{{pluralize name}}\` and \`{{singularize name}}\` helpers
- **Nested iterations** — \`{{#each fields}}...{{/each}}\` inside \`{{#each commands}}...{{/each}}\`
- **Cross-references** — use \`{{clay_model}}\` to access the full model from within a selected item

## Available Helpers

Use \`clay_list_helpers()\` for the complete list. The most commonly needed ones for refactoring:

- **Casing:** \`pascalCase\`, \`camelCase\`, \`kebabCase\`, \`snakeCase\`, \`constantCase\`
- **Pluralization:** \`pluralize\`, \`singularize\`
- **Conditionals:** \`eq\`, \`ne\`, \`propertyExists\`, \`and\`, \`or\`
- **Iteration:** \`eachUnique\`, \`times\`, \`group\`
- **Context:** \`clay_model\` (full model), \`clay_parent\` (parent object), \`clay_key\` (current key)`,
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
