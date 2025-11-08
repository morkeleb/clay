> The original Greek word "model" means "misshapen ball of clay", and I try to think about that every time I go in front of the camera. - Derek Zoolander

# What is Clay

Clay is a template focused code generator. Used to take a model represented in JSON and konvert it to actual code matching the model through a set of generators using handlebar templates, shell commands and file operations.

The goal is to have a consistent implementation of all model related operations in a system. Similar to how Ruby On Rails scaffolds work but backed using files, so you can with confident change the model and have all files updated.

**Built with TypeScript** - Clay is written in TypeScript, providing type safety and excellent IDE support for both the core tool and custom generator development.

## Talks

- [A short concept overview in Swedish @ Agila sverige 2019](https://agilasverige.solidtango.com/video/varfor-skriver-vi-repetativ-kod-for-hand)

# Usage

## Installation

I use clay as a globally installed commandline tool.

```bash
npm install -g clay-generator
```

Running `clay` will display its available commands.

## Development

### Prerequisites

- Node.js 14 or higher
- npm 7 or higher

### Getting Started for Contributors

1. **Clone the repository**

```bash
git clone https://github.com/morkeleb/clay.git
cd clay
```

2. **Install dependencies**

```bash
npm install
```

3. **Build the project**

```bash
npm run build
```

This compiles TypeScript files from `src/` to JavaScript in `dist/`.

4. **Link for local development**

```bash
npm link
```

This makes the `clay` command available globally, pointing to your local development version. Changes to TypeScript files are automatically picked up by the development wrapper script.

### Development Workflow

Clay is written in TypeScript and uses a smart development workflow that doesn't require constant recompilation:

**Development Mode (Recommended)**

When you `npm link` Clay locally, the `bin/clay-dev` wrapper automatically detects that source files exist and uses `ts-node` to run TypeScript directly:

```bash
# After npm link, just run clay commands normally
clay generate ./my-model.json ./output

# TypeScript files are executed directly via ts-node
# No compilation needed!
```

**Production Build**

For production or to test the compiled output:

```bash
npm run build        # Compile TypeScript to dist/
npm run build:watch  # Compile and watch for changes
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run build:watch` - Compile and watch for changes
- `npm run dev` - Run Clay with ts-node directly
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Check code style and quality
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format all TypeScript files with Prettier
- `npm run format:check` - Check formatting without making changes

### Project Structure

```
clay/
├── src/                     # TypeScript source files
│   ├── types/              # Type definitions
│   │   ├── generator.ts    # Generator types
│   │   ├── model.ts        # Model types
│   │   ├── clay-file.ts    # Clay file types
│   │   └── ...
│   ├── command-line.ts     # CLI command definitions
│   ├── generator.ts        # Generator execution engine
│   ├── model.ts            # Model loading and processing
│   ├── template-engine.ts  # Handlebars template system
│   └── ...
├── dist/                   # Compiled JavaScript (gitignored)
├── test/                   # Test files (.js and .test.ts)
├── bin/                    # Executable scripts
│   └── clay-dev           # Development wrapper
├── index.ts               # Entry point
├── tsconfig.json          # TypeScript configuration
├── eslint.config.js       # ESLint configuration
└── .prettierrc.json       # Prettier configuration
```

### TypeScript Development

**Type Definitions**

Clay uses comprehensive type definitions for all core concepts. Key types include:

- `Generator` - Generator configuration and steps
- `ClayModel` - Model structure with mixins and includes
- `ClayFile` - .clay file inventory tracking
- `GeneratorStep` - Union type for generate/copy/command steps

**Strict Mode**

The project uses TypeScript strict mode for maximum type safety. When adding new code:

- Avoid `any` types when possible
- Use proper type annotations
- Leverage type guards for discriminated unions
- Use `unknown` instead of `any` for truly unknown types

**IDE Support**

TypeScript provides excellent IDE support. VS Code (or similar) will provide:

- Autocomplete for all functions and properties
- Inline type documentation
- Error detection as you type
- Refactoring support

### Testing

Tests are written in TypeScript using Mocha, Chai, and Sinon:

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
```

Test files use `.test.ts` extension and are located in the `test/` directory. The test setup uses `ts-node` to run TypeScript tests directly.

### Code Quality

**Linting**

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
```

ESLint is configured with TypeScript support and checks for:

- TypeScript-specific issues
- Code style consistency
- Potential bugs
- Best practices

**Formatting**

```bash
npm run format        # Format all files
npm run format:check  # Check formatting
```

Prettier ensures consistent code formatting across the project.

### Making Contributions

1. Create a feature branch from `main`
2. Make your changes in TypeScript
3. Add tests for new functionality
4. Run `npm run lint` and `npm run format`
5. Ensure `npm test` passes
6. Submit a pull request

### Publishing

The npm package includes only the compiled JavaScript in `dist/` and the bin wrapper. The TypeScript source is excluded from the published package but available in the GitHub repository.

```
> clay

Usage: clay [options] [command]

Options:
  -V, --version                        output the version number
  -v, --verbose                        ignore test hook
  -h, --help                           output usage information

Commands:
  test-path <model_path> <json_path>   test a json-path selector using your model
  clean <model_path> <output_path>     cleans up the output of the generators
  generate <model_path> <output_path>  runs the generators
  watch <model_path> <output_path>     runs the generators on filechanges in the models directory
  init [type] [name]                   initializes the folder with an empty .clay file or a generator
```

## Generate

The first command to know in clay is the `generate` command.

```
> clay generate <model_path> <output_path>
```

It takes the model to generate as the first input and the second input is where the model should
be generated too.

## Test-path

The test path command will allow you to test jsonpath against your specified model.
This is usefull when you are creating generators and templates.
To see what you will get from a model given a specific path.

The command will simply print the resulting model objects your path returns.

```
> clay test-path <model_path> $.model.types[*].actions[*].parameters[?\(@.type==\"array\"\)]
```

## Clean

The `clean` command will clear up all generated code based on the generators specified in the
model.

It will not undo any commandline executions that has ben run by a generator.

```
> clay clean <model_path> <output_path>
```

## Watch

If you start using clay extensivly you will notice that you want to rerun clay as soon as you make
changes to the model or any of the custom generators you might be using.

For this there is a built in watch command that follows the same structure as the generate command.

```
> clay  <model_path> <output_path>
```

Using this will make clay listen for changes under the directory specified in the model.

### Recommended directory layout for the model and custom generators

We have a directory called clay where we keep our model and our custom generators.

```
.
├── dataaccess
│   ├── generator.json
│   └── template
│       └── db.js
├── frontend
│   ├── components
│   │   ├── {{pascalCase\ name}}Components.js
│   ├── generator.json
│   ├── partials
│   │   └── form-fields.js
│   └── reducers
│       └── {{kebabCase\ name}}.reducer.js
├── mixins
│   └── default_actions.mixin.js
└── model.json
```

This makes it simple to run clay watch on the "clay directory" and work continously on the
generators and the model.

## Init

The `init` command is used to initialize a Clay project in the current directory. It creates a `.clay` file, which is essential for Clay to function properly. This file keeps track of what has been generated and allows other commands like `generate`, `clean`, and `watch` to work without requiring additional arguments.

### Usage

To initialize a Clay project, run:

```
> clay init
```

This will create a `.clay` file in the current directory.

### Initializing a Generator

You can also use the `init` command to create a new generator. For example:

```
> clay init generator <generator_name>
```

This will create a new generator directory under `clay/generators/<generator_name>` and include a `generator.json` file. The `generator.json` file will have a basic structure that you can customize to define the steps and configurations for your generator.

### Error Handling

- If a `.clay` file already exists, the `init` command will fail with an error message: `A .clay file already exists in this folder`.
- If you attempt to initialize a generator with the same name as an existing one, the command will also fail.

# Domain model

Clay takes a structured specification of a domain model and generates code based on the domain model and a given set of generators.

Clay tries to stay clear of exactly how the domain model i structured, but in order to successfully generate from the model there needs to be some structure.

The model can have includes to split it up into several files.

There is also something called mixins that allow you to make modifications to models
using simple js functions. These are usefull for convention based model properties.

The model holds a list of generators to be run for this specific model.

# Generators

Generators holds a list of steps to run.
Steps can do one of the following:

1. Generate a set of files using a handlebar template and the model
2. Run commands using the model and handlebar to modify executed commands
3. Copy existing files

the order of execution is defined in the generator

# Files

## Models

Clays models are described in a file called models.json.

The structure for describing a model in clay is as follows:

- A model contains:

- a list of generators.
- a name
- a list of mixins
- the model as a json structure

`mixin` and `include` are reserved properties on a clay model.
`mixin` is a list of functions to execute on a part of the model
`include` will replace the current part of the model with the content if a
specified file.

Example of a models.json file:

```
{
  name: 'mymodel'
  generators: [
    'documentation',
    'backend.json'
  ]
  mixins: [
    'has_created.js',
    'has_error.js'
  ]
  model: {
    events: [
      {include: 'standardevents.json'}
    ],
    types:[
      {
        name: 'order',
        mixin: [has_created, has_errors],
        commands: [
          {
            name: 'finish_order',
            raise: 'order_finished',
            parameters: [
              {
                name: 'finished'
              }
            ]
          }
        ],
        fields: [
          {
            name: 'test'
          }
        ]

      }
    ]
  }
}

```

## Generators

Generators describe a sequence of steps that will be taken with the model
as input. Generators are generally installed globaly so they can be used by clay.

a generator contains:

- a list of steps
- a list of partials
- a list of formatters

Currently available generators:

- (Clay Model Generator)[https://github.com/morkeleb/clay-model-documentation]

### Setting Up `generator.json`

The `generator.json` file is a critical part of Clay's functionality. It defines the steps and configurations for generating code based on your model. Below is a detailed guide on how to set up this file.

#### Structure

The `generator.json` file contains the following main sections:

- **partials**: An array of handlebar partials that can be used in templates.
- **steps**: An array of steps that define the actions to be performed during code generation.
- **formatters**: (Optional) An array of formatters to prettify the generated files.

#### Example

```json
{
  "partials": [],
  "steps": [
    {
      "runCommand": "jhipster microservice"
    },
    {
      "generate": "templates/jdl-files",
      "select": "$.jsonpath.statement"
    },
    {
      "runCommand": "jhipster import-jdl {{service.name}}",
      "select": "$.jsonpath.statement"
    },
    {
      "copy": "git+morkeleb/foundation",
      "select": "$.jsonpath.statement",
      "target": "{{microservice}}"
    }
  ],
  "formatters": ["clay-generator-formatter-prettier"]
}
```

#### Steps

Each step in the `steps` array can perform one of the following actions:

1. **Run a Command**

   - **Parameters**:
     - `runCommand` (string): The shell command to execute.
     - `npxCommand` (boolean, optional): Whether to run the command using `npx`.
   - **Example**:
     ```json
     {
       "runCommand": "yo newservice",
       "npxCommand": true
     }
     ```

2. **Generate Handlebar Template**

   - **Parameters**:
     - `generate` (string): Path to the handlebar template.
     - `select` (string, optional): JSONPath to filter the model.
     - `target` (string, optional): Target path for the generated files.
     - `touch` (boolean, optional): Generate only if the file does not exist.
   - **Example**:
     ```json
     {
       "generate": "templates/java{{name}}.js",
       "select": "$.model.types[*]",
       "target": "src/{{name}}.js",
       "touch": true
     }
     ```

3. **Copy Files**
   - **Parameters**:
     - `copy` (string): Source path to copy.
     - `select` (string, optional): JSONPath to filter the model.
     - `target` (string, optional): Target path for the copied files.
   - **Example**:
     ```json
     {
       "copy": "foundation",
       "select": "$.model.types[*]",
       "target": "{{name}}/foundation"
     }
     ```

#### Validation

- Ensure all `select` fields use valid JSONPath expressions.
- Use the `test-path` command to verify your JSONPath expressions against your model.

#### Tips

- Keep your `generator.json` file organized and modular by splitting complex configurations into multiple steps.
- Use partials for reusable template components.
- Leverage formatters to ensure consistent code style in the generated files.

### Partials

The partials are handlebar partials that can be used in the templates within
the generator. These are usefull for header and footer like operations.

### Steps

The steps describe what the generator does and in which order. Steps can be one of:

- **Copy**: Copies files or directories to a target location.
- **Generate Handlebar Template**: Generates files using a handlebar template and the model.
- **Run a Command**: Executes a shell command, optionally using the model for dynamic inputs.

#### Parameters

Each step can include the following parameters:

- **runCommand** (optional): A string representing the shell command to execute.
- **npxCommand** (optional): A boolean indicating whether the command should be run using `npx`.
- **generate** (optional): A string specifying the path to the handlebar template to use for file generation.
- **touch** (optional): A boolean that, if true, ensures the file is only generated if it does not already exist.
- **select** (optional): A JSONPath string to filter the model for the step.
- **copy** (optional): A string representing the source path to copy.
- **target** (optional): A string specifying the target path for the generated or copied files.

#### Examples

1. **Copy Step**

   ```json
   {
     "copy": "foundation",
     "select": "$.model.types[*]",
     "target": "{{name}}/foundation"
   }
   ```

   This step copies the `foundation` directory for each type in the model to a dynamically generated target path based on the type's name.

2. **Run Command Step with npxCommand**

   ```json
   {
     "runCommand": "yo newservice",
     "npxCommand": true
   }
   ```

   This step runs the `yo newservice` command using `npx`.

3. **Generate Handlebar Template Step**

   ```json
   {
     "generate": "templates/java{{name}}.js",
     "select": "$.model.types[*]",
     "target": "src/{{name}}.js"
   }
   ```

   This step generates JavaScript files for each type in the model using a handlebar template located at `templates/java{{name}}.js` and saves them to the `src` directory.

4. **Generate Handlebar Template Step with touch**

   ```json
   {
     "generate": "templates/java{{name}}.js",
     "select": "$.model.types[*]",
     "target": "src/{{name}}.js",
     "touch": true
   }
   ```

   This step generates JavaScript files for each type in the model using a handlebar template, but only if the file does not already exist.

5. **Run Command Step**
   ```json
   {
     "runCommand": "echo Generating {{name}}",
     "select": "$.model.types[*]"
   }
   ```
   This step runs a shell command for each type in the model, dynamically inserting the type's name into the command.

These examples demonstrate how steps can be configured to perform specific actions during the generation process.

### Formatters

To ensure the generated files are as pretty as possible, Clay has support for external formatters.

Formatters are used to format the output before it is written to disk.
For example it could be to ensure propper indentation before writing the file.
Formatters are installed globally and the generator will require the specified formatter.

Example:

```
{
  "partials":[],
  "formatters:["clay-generator-formatter-prettier"],
  "steps":[
    {
      "runCommand": "yo newservice"
    },
    {
      "generate": "templates/html",
      "select": "jsonpath statement"
    },
    {
      "runCommand": "yo servicepart {{service.name}}",
      "select": "jsonpath statement"
    },
    {
      "copy": "foundation",
      "select": "jsonpath statement",
      "target": "{{microservice}}"
    }
  ]
}
```

### Templates

Clay uses the handlebars template engine to generate a files.

The paths are also handlebar template, allowing you to use values from the model or view data to write the file to the correct location.

Example of a template:

```
var command = function (user, {{ parameters }}) {
  var {{lowerCase type.name}} = repository.find('{{type.name}}', id);

  if({{lowerCase type.name}}){
    eventsource.raise('{{raises}}', [user, {{parameters}}]);
  }
}
```

### Partials

It's tedious to rewrite parts of code even in template files. To help with that clay
include all partials listed in a generator.

in the domain-documentation.html template I use the header partial as shown:

```
{{>header }}
    <h1>{{name}}</h1>
```

### Template Context Variables

When Clay processes templates using JSONPath selectors, it automatically adds several context variables to each selected element to make template development easier and more powerful:

#### `clay_model`

Provides access to the complete root model from any template context. This is particularly useful for lookups and cross-references within your templates.

```handlebars
<!-- Access the model name from anywhere in your template -->
<h1>{{clay_model.name}}</h1>

<!-- Look up related data from the root model -->
{{#each clay_model.model.types}}
  <p>Available type: {{name}}</p>
{{/each}}

<!-- Count total items in the model -->
<p>Total types: {{clay_model.model.types.length}}</p>
```

#### `clay_parent`

References the parent element in the JSON structure, along with its JSONPath.

```handlebars
<!-- Access parent properties -->
<p>Parent name: {{clay_parent.name}}</p>
<p>Parent path: {{clay_parent.json_path}}</p>

<!-- Navigate up multiple levels -->
<p>Grandparent: {{clay_parent.clay_parent.name}}</p>
```

#### `clay_key`

The JSON property name of the current element.

```handlebars
<p>Current property: {{clay_key}}</p>
```

#### `clay_json_key`

Alternative reference to the JSON property name of the current element.

```handlebars
<p>JSON key: {{clay_json_key}}</p>
```

#### Example Usage

Consider a model with nested structure:

```json
{
  "name": "UserService",
  "model": {
    "types": [
      {
        "name": "User",
        "commands": [
          {
            "name": "createUser",
            "parameters": [{ "name": "email", "type": "string" }]
          }
        ]
      }
    ]
  }
}
```

With JSONPath selector `$.model.types[*].commands[*].parameters[*]`, a template can access:

```handlebars
Parameter:
{{name}}
({{type}}) Command:
{{clay_parent.name}}
Type:
{{clay_parent.clay_parent.name}}
Service:
{{clay_model.name}}
Total types in service:
{{clay_model.model.types.length}}
```

This would generate:

```
Parameter: email (string)
Command: createUser
Type: User
Service: UserService
Total types in service: 1
```

### Template helpers

## Handlebars Helpers

Clay's template engine provides a rich set of helpers to use in your Handlebars templates. Below is a list of all available helpers, with usage examples.

### 1. `markdown`

Renders a string as HTML using Markdown.

```handlebars
{{markdown description}}
```

### 2. `propertyExists`

Checks if a property exists in any object in a context.

```handlebars
{{#if (propertyExists this "fieldName")}}
  Property exists!
{{/if}}
```

### 3. `json`

Pretty-prints a JavaScript object as JSON.

```handlebars
<pre>{{{json this}}}</pre>
```

### 4. `pascalCase`

Converts a string to PascalCase.

```handlebars
{{pascalCase name}}
```

### 5. `inc`

Increments a number by 1 (useful for 1-based indexes).

```handlebars
{{inc @index}}
```

### 6. `pluralize`

Pluralizes a word.

```handlebars
{{pluralize "category"}}
```

### 7. `singularize`

Singularizes a word.

```handlebars
{{singularize "categories"}}
```

### 8. `switch`, `case`, `default`

Implements switch/case/default logic.

```handlebars
{{#switch type}}
  {{#case "admin"}}
    Admin user
  {{/case}}
  {{#case "user"}}
    Regular user
  {{/case}}
  {{#default}}
    Unknown type
  {{/default}}
{{/switch}}
```

### 9. `times`

Repeats a block N times.

```handlebars
{{#times 3}}
  Index:
  {{@index}}
{{/times}}
```

### 10. `ifCond`

Conditional logic with operators.

```handlebars
{{#ifCond value "==" 10}}
  Value is 10
{{else}}
  Value is not 10
{{/ifCond}}
```

Supported operators: `==`, `===`, `!=`, `!==`, `<`, `<=`, `>`, `>=`, `&&`, `||`

### 11. Comparison and Logical Helpers

- `eq` (equal): `{{#if (eq a b)}}...{{/if}}`
- `ne` (not equal): `{{#if (ne a b)}}...{{/if}}`
- `lt` (less than): `{{#if (lt a b)}}...{{/if}}`
- `gt` (greater than): `{{#if (gt a b)}}...{{/if}}`
- `lte` (less than or equal): `{{#if (lte a b)}}...{{/if}}`
- `gte` (greater than or equal): `{{#if (gte a b)}}...{{/if}}`
- `and` (all true): `{{#if (and a b c)}}...{{/if}}`
- `or` (any true): `{{#if (or a b c)}}...{{/if}}`

### 12. `eachUnique`

Iterates over unique values in an array or object.

```handlebars
{{#eachUnique items}}
  {{this}}
{{/eachUnique}}
```

Or, to get unique by a property:

```handlebars
{{#eachUnique items "id"}}
  {{this.name}}
{{/eachUnique}}
```

### 13. `eachUniqueJSONPath`

Iterates over unique values selected by a JSONPath.

```handlebars
{{#eachUniqueJSONPath model "$.types[*].name"}}
  {{this}}
{{/eachUniqueJSONPath}}
```

### 14. `splitAndUseWord`

Splits a string and returns the word at the given index.

```handlebars
{{splitAndUseWord "foo-bar-baz" "-" 1}} <!-- Outputs: bar -->
```

---

These helpers can be used in any template or partial. For more advanced string manipulation, you can also use [lobars](https://github.com/zeke/lobars) and lodash helpers directly in your templates.

---

### Additional Helpers from `lobars`

Clay includes [lobars](https://github.com/zeke/lobars), which exposes a wide range of [lodash](https://lodash.com/docs) functions as Handlebars helpers. These helpers can be used directly in your templates for advanced string, comparison, and utility operations.

#### Common String Helpers

- **camelCase**  
  Converts a string to camelCase.  
  `{{camelCase "hello world"}}` → `helloWorld`

- **capitalize**  
  Capitalizes the first character of a string.  
  `{{capitalize "hello world"}}` → `Hello world`

- **kebabCase**  
  Converts a string to kebab-case.  
  `{{kebabCase "Hello World"}}` → `hello-world`

- **snakeCase**  
  Converts a string to snake_case.  
  `{{snakeCase "Hello World"}}` → `hello_world`

- **lowerCase**  
  Converts a string to lower case.  
  `{{lowerCase "Hello World"}}` → `hello world`

- **upperCase**  
  Converts a string to upper case.  
  `{{upperCase "Hello World"}}` → `HELLO WORLD`

- **startCase**  
  Converts a string to Start Case.  
  `{{startCase "hello world"}}` → `Hello World`

- **pad, padEnd, padStart**  
  Pads a string to a given length.  
  `{{pad "abc" 5}}` → `" abc "`

- **repeat**  
  Repeats a string N times.  
  `{{repeat "ab" 3}}` → `ababab`

- **replace**  
  Replaces part of a string.  
  `{{replace "foo bar" "bar" "baz"}}` → `foo baz`

- **truncate**  
  Truncates a string to a given length.  
  `{{truncate "Hello World" 5}}` → `Hello...`

#### Comparison and Type Helpers

- **eq, ne, gt, gte, lt, lte**  
  Compare values.  
  `{{#if (eq a b)}}Equal{{/if}}`

- **isArray, isBoolean, isDate, isEmpty, isNumber, isString, isObject, isNull, isUndefined, etc.**  
  Type checks.  
  `{{#if (isArray myVar)}}It's an array!{{/if}}`

- **includes, startsWith, endsWith**  
  String/array checks.  
  `{{#if (includes "foobar" "foo")}}Yes{{/if}}`

#### Utility Helpers

- **parseInt**  
  Parses a string to an integer.  
  `{{parseInt "42"}}` → `42`

- **split**  
  Splits a string into an array.  
  `{{#each (split "a,b,c" ",")}}[{{this}}]{{/each}}` → `[a][b][c]`

- **words**  
  Splits a string into words.  
  `{{#each (words "foo bar")}}[{{this}}]{{/each}}` → `[foo][bar]`

---

For a full list of available helpers, see the [lodash documentation](https://lodash.com/docs) and the [lobars README](https://github.com/zeke/lobars).

## GitHub Copilot Integration

To enhance your development workflow with Clay, you can integrate it with GitHub Copilot by adding instructions to your project's `copilot-instructions.md` file. This will help Copilot understand Clay's concepts and assist you with model creation, template development, and generator configuration.

### Setting Up Copilot Instructions

Create a `copilot-instructions.md` file in your project root and add the following content to help Copilot understand how to work with Clay:

```markdown
# Clay Generator Instructions for GitHub Copilot

## Overview

Clay is a template-focused code generator that uses JSON models and Handlebars templates to generate code. The system consists of models, generators, templates, and partials.

## Key Concepts

### Models (model.json)

- JSON files that describe the domain model
- Can include mixins and includes for modularity
- Support JSONPath selectors for targeting specific parts
- Reserved properties: `mixin`, `include`, `generators`

### Generators (generator.json)

- Define steps to transform models into code
- Support three types of steps:
  - `generate`: Use Handlebars templates
  - `copy`: Copy files/directories
  - `runCommand`: Execute shell commands
- Can include partials and formatters

### Templates

- Use Handlebars syntax with extensive helper library
- Support dynamic file paths using model data
- Include lobars helpers for string manipulation (camelCase, kebabCase, etc.)

## Common Tasks

### Creating Models

When creating model.json files:

- Use clear, descriptive property names
- Leverage JSONPath for selecting data subsets
- Consider using mixins for reusable functionality
- Structure data to match the intended output

### Writing Templates

When creating Handlebars templates:

- Use appropriate helpers: `{{pascalCase name}}`, `{{kebabCase name}}`, etc.
- Leverage partials for reusable components
- Use conditional logic: `{{#if condition}}...{{/if}}`
- Iterate with: `{{#each items}}...{{/each}}`

### Configuring Generators

When setting up generator.json:

- Order steps logically (dependencies first)
- Use JSONPath selectors to target specific model parts
- Include formatters for code quality
- Test with `clay test-path` command

## Available Commands

- `clay generate <model_path> <output_path>` - Generate code
- `clay clean <model_path> <output_path>` - Clean generated files
- `clay watch <model_path> <output_path>` - Watch for changes
- `clay test-path <model_path> <json_path>` - Test JSONPath selectors
- `clay init` - Initialize Clay project

## Best Practices

- Use semantic naming for models and generators
- Keep templates focused and modular
- Test JSONPath expressions before using in generators
- Use the .clay file for tracking generated files
- Leverage mixins for common model transformations
```

### Benefits of Copilot Integration

With these instructions, GitHub Copilot will be able to:

1. **Suggest appropriate model structures** based on your domain requirements
2. **Generate Handlebars templates** with correct syntax and helper usage
3. **Help configure generator.json files** with proper step ordering and JSONPath selectors
4. **Recommend Clay commands** for common development tasks
5. **Assist with template debugging** using available helpers and partials
6. **Suggest best practices** for organizing Clay projects

### Example Usage

After adding the copilot instructions, you can ask Copilot to help with tasks like:

- "Create a Clay model for a user management system"
- "Generate a Handlebars template for a REST API controller"
- "Set up a generator that creates both frontend and backend files"
- "Help me write a JSONPath expression to select all array type parameters"

This integration will make Clay development more efficient and help maintain consistency across your generated code.

### Changes

- [x] support casing help in helpers
- [x] inc one helper for indexes plus 1
- [x] use chalk to make pretty output... pretty output is... pretty
- [x] update generator and allow loading of node modules as generators
- [x] built in watch support
- [x] add usage instructions to readme
- [x] clean up command that will remove files instead of writing them
- [x] add a .clay file that keeps inventory of what has been generated
  - [x] make sure regeneration of files only write changes
  - [x] make clean command work with the .clay file
  - [x] make the generate command work with the .clay file so it doesnt require arguments
  - [x] make the clean command work with the .clay file so it doesnt require arguments
  - [x] make the watch command work with the .clay file so it doesnt require arguments
  - [x] Validations on generators

### Future

- [ ] validations on models
- [ ] add an option to make dry runs
- [ ] tests on handlebar templating system to prevent regressions and broken generators
- [ ] option to clear directories
