/**
 * clay_explain_concepts tool - Explain Clay concepts, capabilities, and best practices
 *
 * This tool provides comprehensive documentation to help LLMs understand how to:
 * - Create generators from scratch
 * - Write models effectively
 * - Use template context variables (clay_key, clay_parent, etc.)
 * - Leverage all available features
 */

import { validateInput } from '../shared/validation.js';
import {
  ExplainConceptsInput,
  ExplainConceptsInputSchema,
} from '../shared/schemas.js';

/**
 * Comprehensive Clay documentation for LLMs
 */
const concepts = {
  overview: {
    title: 'Clay Overview',
    content: `Clay is a template-focused code generator that transforms JSON models into code. Templates can be written in any of three engines (Handlebars, EJS, or TypeScript) — see the 'templates' topic.

**Core Components:**
1. Models (model.json) - Define your domain structure
2. Generators (generator.json) - Define transformation steps
3. Templates - Handlebars/EJS/TypeScript files that generate code
4. Pre-checks (preChecks) - Validators that run against the resolved model BEFORE generation and abort it on any violation (see the 'generators' topic)
5. .clay file - Tracks generated files for regeneration and cleanup

**Workflow:**
1. Create a model.json describing your domain
2. Reference generators in the model
3. On generate, any preChecks validate the model first (a failure aborts before any file is touched)
4. Generators execute steps (generate templates, run commands, copy files)
5. Clay tracks everything in .clay file for easy regeneration/cleanup`,
  },

  models: {
    title: 'Creating Models',
    content: `Models are JSON files that describe your domain structure.

**Basic Structure:**
\`\`\`json
{
  "name": "myproject",
  "generators": ["backend", "frontend"],
  "model": {
    "types": [
      {
        "name": "User",
        "fields": [
          { "name": "email", "type": "string" },
          { "name": "age", "type": "number" }
        ],
        "commands": [
          {
            "name": "createUser",
            "parameters": [
              { "name": "email", "type": "string" }
            ]
          }
        ]
      }
    ]
  }
}
\`\`\`

**Special Properties:**

1. **include** - Split models across files:
   \`\`\`json
   {
     "model": {
       "events": [
         { "include": "events/user-events.json" }
       ]
     }
   }
   \`\`\`

2. **mixin** - Apply functions to transform model parts:
   \`\`\`json
   {
     "model": {
       "types": [
         {
           "name": "User",
           "mixin": ["has_timestamps.js", "has_audit_fields.js"]
         }
       ]
     }
   }
   \`\`\`

**Best Practices:**
- Use clear, descriptive property names
- Structure models to match your intended output
- Use mixins for common patterns (timestamps, audit fields, etc.)
- Split large models using includes
- Keep models focused on domain structure, not implementation`,
  },

  generators: {
    title: 'Creating Generators',
    content: `Generators define the steps to transform models into code.

**generator.json Structure:**
\`\`\`json
{
  "partials": ["header.hbs", "footer.hbs"],
  "formatters": ["clay-generator-formatter-prettier"],
  "preChecks": [
    { "run": "checks/invariants.ts" },
    { "runCommand": "node checks/naming.mjs", "select": "$.model.types[*]" }
  ],
  "steps": [
    {
      "generate": "templates/{{pascalCase name}}.java",
      "select": "$.model.types[*]",
      "target": "src/main/java/"
    },
    {
      "copy": "foundation/",
      "target": "src/foundation/"
    },
    {
      "runCommand": "npm install",
      "npxCommand": false
    }
  ]
}
\`\`\`

**Step Types:**

1. **Generate from Template:**
   \`\`\`json
   {
     "generate": "templates/{{kebabCase name}}.controller.ts",
     "select": "$.model.types[*]",
     "target": "controllers/",
     "touch": false
   }
   \`\`\`
   - \`generate\`: Path to the template. Its FILENAME (Handlebars-rendered) becomes the output filename — so put the per-entity name and final extension here, e.g. \`{{kebabCase name}}.controller.ts\`. Don't add \`.hbs\`/\`.ejs\` (it's stripped); pick the engine with \`engine\`.
   - \`select\`: JSONPath to filter model (optional)
   - \`target\`: Optional output SUBDIRECTORY (supports Handlebars) — a directory prefix, NOT the filename
   - \`touch\`: If true, only create if file doesn't exist

2. **Copy Files:**
   \`\`\`json
   {
     "copy": "foundation/base-class.ts",
     "select": "$.model.types[*]",
     "target": "{{kebabCase name}}/base.ts"
   }
   \`\`\`

3. **Run Commands:**
   \`\`\`json
   {
     "runCommand": "npm install {{name}}",
     "select": "$.model.dependencies[*]",
     "npxCommand": false
   }
   \`\`\`

**Pre-Generation Checks (preChecks):**
Validate the fully resolved model (after includes and mixins) BEFORE any step runs.
Prechecks are pure validators — they must not write files or mutate the model.
Any violation aborts the generation for that model: nothing is rendered, written,
copied, or executed. All prechecks run even if an early one fails; every violation
is aggregated into a single error.

1. **TypeScript check** — a default-exported class extending \`PreCheck\` with a
   \`check(context)\` method. Return a non-empty array of violation strings (or
   throw) to fail; return an empty array or nothing to pass:
   \`\`\`typescript
   import { PreCheck, type PreCheckContext } from 'clay-generator/types';

   export default class extends PreCheck {
     check({ data }: PreCheckContext): string[] | void {
       if (!data.name) return ['every type needs a name'];
     }
   }
   \`\`\`
   The context carries \`data\`, \`helpers\`, \`model\`, and \`parent\` — the same
   shape as \`CodeGenerator.render()\`.

2. **Command check** — \`runCommand\` receives the model path as its last argument
   and fails the generation on non-zero exit (stderr is surfaced). Note this is
   stricter than \`runCommand\` steps and postGenerate hooks, which warn and continue.

With \`select\`, a check runs once per selected item (with clay_parent/clay_model
context injected as usual); without it, once against the root model.

**Partials:**
Reusable template fragments:
\`\`\`handlebars
{{!-- partials/header.hbs --}}
/**
 * Generated by Clay
 * Model: {{clay_model.name}}
 * Date: {{currentDate}}
 */
\`\`\`

Use in templates: \`{{>header}}\`

**Formatters:**
External tools to format generated code (e.g., prettier, eslint --fix)`,
  },

  templates: {
    title: 'Writing Templates',
    content: `Clay supports THREE template engines, selected per generator step via the optional \`engine\` field on a generate step (\`"handlebars"\` is the default). All three have access to Clay's 47+ helpers.

**Choosing an Engine:**
| Engine | \`engine\` value | Best for | Helper syntax |
|--------|----------------|----------|---------------|
| Handlebars (default) | \`"handlebars"\` or omit | Simple substitution, iteration, conditionals | \`{{pascalCase name}}\`, \`{{#each fields}}\` |
| EJS | \`"ejs"\` | Templates needing a few lines of inline logic (filter, compute, dedupe) | \`<%= helpers.pascalCase(name) %>\`, \`<% if (...) { %>\` |
| TypeScript | \`"ts"\` | Programmatic generation: cross-entity references, filesystem-aware barrel/registration files, graph traversal | \`CodeGenerator\` class; \`helpers.pascalCase(name)\` |

Rule of thumb: start with Handlebars; switch to EJS when an otherwise template-like file needs a little logic; switch to TypeScript when the file is more code than template (DI wiring, route registration, index/barrel files that aggregate across entities or read the filesystem).

**IMPORTANT — output filename comes from the TEMPLATE filename, not from \`target\`:**
The generated file is named after the \`generate\` template's own filename, rendered as a Handlebars template. \`target\` is an optional output SUBDIRECTORY, not the output filename. So:
- Name the template file with the FINAL extension you want, with Handlebars in the name — e.g. \`{{pascalCase name}}Controller.ts\`. Do NOT add \`.hbs\`/\`.ejs\` — that extension would end up on the generated file (a common mistake). Pick the engine with the \`engine\` field, not the file extension.
- Output path = \`<output dir>/<target>/<rendered template filename>\`.

\`\`\`json
{ "generate": "templates/{{pascalCase name}}Controller.ts", "select": "$.model.types[*]" },
{ "generate": "templates/{{pascalCase name}}Service.ts",    "select": "$.model.types[*]", "engine": "ejs" },
{ "generate": "templates/routes.ts", "select": "$.model", "target": "routes/", "engine": "ts" }
\`\`\`
The first step writes \`UserController.ts\`; the third writes \`routes/routes.ts\`.

The examples below use Handlebars (the default). Use \`clay_explain_concepts\` with topic 'generators' for the TypeScript \`CodeGenerator\` API.

**Basic Template:**
\`\`\`handlebars
{{>header}}

export class {{pascalCase name}} {
  {{#each fields}}
  private {{camelCase name}}: {{type}};
  {{/each}}

  constructor(
    {{#each fields}}
    {{camelCase name}}: {{type}}{{#unless @last}},{{/unless}}
    {{/each}}
  ) {
    {{#each fields}}
    this.{{camelCase name}} = {{camelCase name}};
    {{/each}}
  }

  {{#each commands}}
  {{camelCase name}}(
    {{#each parameters}}
    {{camelCase name}}: {{type}}{{#unless @last}},{{/unless}}
    {{/each}}
  ): void {
    // Implementation for {{name}}
  }
  {{/each}}
}
\`\`\`

**File Paths as Templates:**
Paths support Handlebars:
\`\`\`
templates/{{pascalCase name}}Controller.ts
output/{{kebabCase name}}/{{snakeCase name}}.model.ts
\`\`\`

**Common Helpers:**
- Casing: \`pascalCase\`, \`camelCase\`, \`kebabCase\`, \`snakeCase\`, \`startCase\`
- String: \`pluralize\`, \`singularize\`, \`capitalize\`, \`upperCase\`, \`lowerCase\`
- Logic: \`if\`, \`unless\`, \`eq\`, \`ne\`, \`gt\`, \`lt\`, \`and\`, \`or\`, \`switch/case\`
- Iteration: \`each\`, \`eachUnique\`, \`eachUniqueJSONPath\`, \`times\`, \`group\`
- Utility: \`json\`, \`markdown\`, \`inc\`, \`propertyExists\`

Use \`clay_list_helpers\` tool to get complete list with examples.`,
  },

  'context-variables': {
    title: 'Template Context Variables (Hidden Capabilities)',
    content: `Clay automatically adds special variables to template contexts when using JSONPath selectors.

**Available Context Variables:**

1. **clay_model** - Complete root model
   \`\`\`handlebars
   {{!-- Access root model from anywhere --}}
   Project: {{clay_model.name}}
   Total types: {{clay_model.model.types.length}}
   
   {{!-- Cross-reference other parts of the model --}}
   {{#each clay_model.model.types}}
     {{#if (eq ../name this.relatedType)}}
       Found related type: {{this.name}}
     {{/if}}
   {{/each}}
   \`\`\`

2. **clay_parent** - Parent element in JSON structure
   \`\`\`handlebars
   {{!-- Current field --}}
   Field: {{name}}
   
   {{!-- Parent type --}}
   Type: {{clay_parent.name}}
   
   {{!-- Grandparent (navigate up multiple levels) --}}
   Model: {{clay_parent.clay_parent.name}}
   
   {{!-- Parent's JSONPath --}}
   Parent path: {{clay_parent.json_path}}
   \`\`\`

3. **clay_key** - JSON property name of current element
   \`\`\`handlebars
   {{!-- If iterating over object properties --}}
   Property name: {{clay_key}}
   Property value: {{this}}
   \`\`\`

4. **clay_json_key** - Alternative to clay_key
   \`\`\`handlebars
   Key: {{clay_json_key}}
   \`\`\`

**Practical Example:**

Model:
\`\`\`json
{
  "name": "UserService",
  "model": {
    "types": [
      {
        "name": "User",
        "category": "entity",
        "commands": [
          {
            "name": "createUser",
            "raises": "UserCreated"
          }
        ]
      }
    ]
  }
}
\`\`\`

Generator step with JSONPath \`$.model.types[*].commands[*]\`:
\`\`\`handlebars
// Command: {{name}}
// Type: {{clay_parent.name}}
// Category: {{clay_parent.category}}
// Service: {{clay_model.name}}
// Event: {{raises}}

export function {{camelCase name}}Handler() {
  // Handler for {{clay_parent.name}}.{{name}}
  // Raises: {{raises}}
  // Service: {{clay_model.name}}
}
\`\`\`

Output:
\`\`\`typescript
// Command: createUser
// Type: User
// Category: entity
// Service: UserService
// Event: UserCreated

export function createUserHandler() {
  // Handler for User.createUser
  // Raises: UserCreated
  // Service: UserService
}
\`\`\`

**When to Use Each:**

- **clay_model**: Cross-references, lookups, global metadata
- **clay_parent**: Access parent properties, understand context hierarchy
- **clay_key**: When iterating over object properties (not arrays)
- **Standard context**: Current selected element's properties

**Important Notes:**
- These variables are automatically injected when using JSONPath \`select\`
- They provide powerful navigation capabilities without manual passing
- They enable templates to be context-aware and make intelligent decisions
- Use them to avoid hardcoding and enable dynamic template behavior`,
  },

  jsonpath: {
    title: 'JSONPath Selectors',
    content: `JSONPath expressions select parts of the model for processing.

**Syntax:**

- \`$\` - Root element
- \`.\` - Child property
- \`[*]\` - All array elements
- \`[?(@.property == 'value')]\` - Filter
- \`..\` - Recursive descent

**Common Patterns:**

\`\`\`javascript
// All types
"$.model.types[*]"

// All fields in all types
"$.model.types[*].fields[*]"

// All commands across all types
"$.model.types[*].commands[*]"

// All parameters in all commands
"$.model.types[*].commands[*].parameters[*]"

// Filter: only string type parameters
"$.model.types[*].commands[*].parameters[?(@.type == 'string')]"

// Filter: only types with category 'entity'
"$.model.types[?(@.category == 'entity')]"

// Filter: commands that raise events
"$.model.types[*].commands[?(@.raises)]"

// Get all unique categories (use with eachUniqueJSONPath)
"$.model.types[*].category"
\`\`\`

**Testing JSONPath:**
Use \`clay_test_path\` tool to verify expressions:
\`\`\`javascript
clay_test_path({
  model_path: "./model.json",
  json_path: "$.model.types[?(@.category == 'entity')]"
})
\`\`\`

**In Generator Steps:**
\`\`\`json
{
  "generate": "templates/{{kebabCase name}}.entity.ts",
  "select": "$.model.types[?(@.category == 'entity')]",
  "target": "entities/"
}
\`\`\`

This runs the template once for each matching element.`,
  },

  mixins: {
    title: 'Mixins - Model Transformations',
    content: `Mixins are JavaScript functions that transform parts of the model.

**Use Cases:**
- Add conventional fields (timestamps, audit fields)
- Calculate derived properties
- Inject common patterns
- Transform model structure

**Example Mixin:**
\`\`\`javascript
// mixins/has_timestamps.js
module.exports = function(modelPart) {
  // Add timestamp fields if not present
  if (!modelPart.fields) {
    modelPart.fields = [];
  }
  
  modelPart.fields.push(
    { name: 'createdAt', type: 'Date', readonly: true },
    { name: 'updatedAt', type: 'Date', readonly: true }
  );
  
  return modelPart;
};
\`\`\`

**Using in Models:**
\`\`\`json
{
  "model": {
    "types": [
      {
        "name": "User",
        "mixin": ["has_timestamps.js"],
        "fields": [
          { "name": "email", "type": "string" }
        ]
      }
    ]
  }
}
\`\`\`

After mixin execution, User type will have email, createdAt, and updatedAt fields.

**Advanced Mixin:**
\`\`\`javascript
// mixins/add_crud_commands.js
module.exports = function(type) {
  type.commands = type.commands || [];
  
  const entityName = type.name;
  
  type.commands.push(
    {
      name: \`create\${entityName}\`,
      parameters: type.fields.filter(f => !f.readonly),
      raises: \`\${entityName}Created\`
    },
    {
      name: \`update\${entityName}\`,
      parameters: [
        { name: 'id', type: 'string' },
        ...type.fields.filter(f => !f.readonly)
      ],
      raises: \`\${entityName}Updated\`
    },
    {
      name: \`delete\${entityName}\`,
      parameters: [{ name: 'id', type: 'string' }],
      raises: \`\${entityName}Deleted\`
    }
  );
  
  return type;
};
\`\`\`

This mixin automatically generates CRUD commands based on the type's fields.

**Best Practices:**
- Keep mixins focused on a single concern
- Make mixins reusable across projects
- Document what each mixin does
- Test mixins with different model structures
- Use mixins to enforce conventions`,
  },
};

/**
 * Get comprehensive Clay documentation
 */
export async function explainConcepts(input: ExplainConceptsInput) {
  const topic = input.topic || 'overview';
  const includeExamples = input.include_examples;

  if (topic === 'all') {
    // Return all concepts
    return {
      success: true,
      concepts: Object.entries(concepts).map(([key, value]) => ({
        topic: key,
        ...value,
      })),
      available_topics: Object.keys(concepts),
      note: 'This provides comprehensive documentation for creating generators and models. Use specific topics for focused information.',
    };
  }

  const concept = concepts[topic as keyof typeof concepts];
  if (!concept) {
    return {
      success: false,
      message: `Unknown topic: ${topic}`,
      available_topics: Object.keys(concepts),
    };
  }

  return {
    success: true,
    topic,
    ...concept,
    available_topics: Object.keys(concepts),
    related_tools: getRelatedTools(topic),
  };
}

/**
 * Get related MCP tools for a topic
 */
function getRelatedTools(topic: string): string[] {
  const toolMap: Record<string, string[]> = {
    overview: ['clay_init', 'clay_generate', 'clay_get_model_structure'],
    models: ['clay_get_model_structure', 'clay_test_path', 'clay_init'],
    generators: ['clay_list_generators', 'clay_init'],
    templates: ['clay_list_helpers', 'clay_test_path'],
    'context-variables': ['clay_test_path', 'clay_get_model_structure'],
    jsonpath: ['clay_test_path'],
    mixins: ['clay_get_model_structure'],
  };

  return toolMap[topic] || [];
}

/**
 * MCP tool handler
 */
export async function explainConceptsTool(args: unknown) {
  const validation = validateInput(ExplainConceptsInputSchema, args);
  if (!validation.success) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              message: validation.error,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const input = {
    ...validation.data,
    include_examples: validation.data.include_examples ?? true,
  };

  const result = await explainConcepts(input);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
