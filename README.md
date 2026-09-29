> The original Greek word "model" means "misshapen ball of clay", and I try to think about that every time I go in front of the camera. - Derek Zoolander

```
   _____ _
  / ____| |
 | |    | | __ _ _   _
 | |    | |/ _` | | | |
 | |____| | (_| | |_| |
  \_____|_|\__,_|\__, |
                  __/ |
                 |___/
```

# Clay - Template-Focused Code Generator

**📚 [Full Documentation](https://morkeleb.github.io/clay/)** | **[Getting Started](https://morkeleb.github.io/clay/pages/getting-started.html)** | **[Shelf example](https://morkeleb.github.io/clay/pages/example.html)** | **[NPM Package](https://www.npmjs.com/package/clay-generator)**

Clay is a template-focused code generator that transforms JSON models into actual code using multiple template engines, shell commands, and file operations. Supports Handlebars for simple templates, EJS for inline logic, and TypeScript CodeGenerator classes for fully programmatic generation. Built with TypeScript for type safety and reliability.

## Quick Start

```bash
# Install globally
npm install -g clay-generator

# Initialize a project
clay init

# Generate code
clay generate ./clay/model.json ./output
```

## Why Clay?

- ✅ **[Template-Based Generation](https://morkeleb.github.io/clay/pages/templates.html)** - Three engines: Handlebars, EJS, and TypeScript CodeGenerator with 47+ helpers
- ✅ **[Type-Safe](https://morkeleb.github.io/clay/)** - Built with TypeScript for reliability
- ✅ **[Model-Driven](https://morkeleb.github.io/clay/pages/models.html)** - Define your domain once, generate everywhere
- ✅ **[Watch Mode](https://morkeleb.github.io/clay/pages/cli.html)** - Auto-regenerate on model changes
- ✅ **[Git Integration](https://morkeleb.github.io/clay/pages/cli.html)** - Collapsed diffs in PRs, auto-merge for .clay conflicts
- ✅ **[AI-Powered](https://morkeleb.github.io/clay/pages/mcp-server.html)** - MCP server for Claude & GitHub Copilot
- ✅ **[Shelf](https://github.com/morkeleb/clay-example)** - A running Note app: one model, generated files, one touch file

**[→ View Full Documentation](https://morkeleb.github.io/clay/)**

## Documentation

- **[Getting Started](https://morkeleb.github.io/clay/pages/getting-started.html)** - Installation, setup, and your first project
- **[Philosophy](https://morkeleb.github.io/clay/pages/philosophy.html)** - Benefits and trade-offs of code generation
- **[Models](https://morkeleb.github.io/clay/pages/models.html)** - Define domain models in JSON with mixins and includes
- **[Generators](https://morkeleb.github.io/clay/pages/generators.html)** - Configure generation steps and workflows
- **[Templates](https://morkeleb.github.io/clay/pages/templates.html)** - Handlebars, EJS, and TypeScript template engines with 47+ helpers
- **[AI Integration](https://morkeleb.github.io/clay/pages/mcp-server.html)** - MCP server for Claude & Copilot
- **[CLI Reference](https://morkeleb.github.io/clay/pages/cli.html)** - Complete command-line guide
- **[Shelf](https://morkeleb.github.io/clay/pages/example.html)** - A running app, and the repository behind it: [morkeleb/clay-example](https://github.com/morkeleb/clay-example)

## Features

### [Template-Based Generation](https://morkeleb.github.io/clay/pages/templates.html)

Generate files using three template engines: **Handlebars** for simple substitution, **EJS** for inline JavaScript logic, and **TypeScript CodeGenerator** classes for fully programmatic generation. All engines share 47+ built-in helpers and work in parallel via worker threads.

### [JSONPath Selectors](https://morkeleb.github.io/clay/pages/models.html)

Target specific parts of your model for precise generation. Test selectors with the `clay test-path` command.

### [Watch Mode](https://morkeleb.github.io/clay/pages/cli.html)

Automatically regenerate when models or templates change during development.

### [AI Integration](https://morkeleb.github.io/clay/pages/mcp-server.html)

MCP server provides type-safe tool calls for Claude and GitHub Copilot, enabling AI-assisted generator development.

## Shelf

[Shelf](https://github.com/morkeleb/clay-example) is a small Clay app you can run. One entity, `Note`. The model is the source. Clay writes the types, the page, the forms, and the handlers. The business rule is written once, in a touch file, and a spec sits next to it.

Hand-written code and LLM-written code both drift. A pagination parameter or an access check comes out slightly differently each time it is written again. Shelf keeps `clay/model.json` as the gauge, and every generated file is checked against it.

```bash
git clone https://github.com/morkeleb/clay-example.git
cd clay-example
npm install
npm run dev
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317). The generated files are already in the repo, so `npm run dev` serves the app after install. The header sends an `x-role` header: a reader can list notes, a reader who submits a form gets HTTP 403, and an editor can create or rename a note.

`clay/model.json` owns the fields, the queries, and the mutations. Clay overwrites `src/generated/`. It writes each file under `src/logic/` once, then leaves it. `src/runtime/` is the server, the store, and the page script, written by hand.

![Shelf is a Note list. Then the tree: clay is the model, src/generated is overwritten, src/logic is the touch file.](docs/gifs/layout.gif)

### One model edit writes the files

Adding `archive` to `clay/model.json` is 15 lines of JSON. Clay writes 58 lines across 7 files: the form, the handler, the page, the route, the type, and the touch file with its spec. You pay an LLM for the 15 lines. Clay writes the 58. That is the token efficiency of this example.

Shelf is one entity, with no relations, in TypeScript. A larger model writes more from the same kind of edit, and a language with more boilerplate writes more still. This diff is the small case. `git diff --stat` in [Shelf](https://github.com/morkeleb/clay-example) is the count.

![Adding archive. 15 lines in the model, 58 lines across 7 files.](docs/gifs/token-efficiency.gif)

Add a field and Clay rewrites the type and the page. The touch file still builds a `Note` without the new field, so `tsc` fails until you update it.

![One field. The type and the page change, then tsc fails in the touch file.](docs/gifs/add-field.gif)

The same move works in a template. One line in the form template adds a Cancel button to every mutation form. Adding a mutation writes the form, the handler, and a touch pair whose spec fails `npm test` until the test is real. Both clips are on the [Shelf page](https://morkeleb.github.io/clay/pages/example.html#one-change).

### Generated files stay closed

`clay init-claude` writes `.claude/settings.json`. Before an Edit or a Write, Claude Code runs `clay check-generated`. A generated path is refused. The touch file under `src/logic/` is allowed, because Clay leaves that file after the first write.

![An agent write to a generated file is blocked. The touch file is allowed.](docs/gifs/blocked-edit.gif)

### The role check lives in the template

The role check is one line in the handler template. Clay copies it into every handler. A reader who calls a mutation gets HTTP 403 from that check.

![One line in the handler template. Every handler checks the role.](docs/gifs/role-check.gif)

Shelf also rejects a model that invents a key. That check is `clay/validate-model.ts` in the example, and it runs before Clay. The allowed keys and the clip are on the [Shelf page](https://morkeleb.github.io/clay/pages/example.html#model-vocabulary).

**[→ Shelf write-up](https://morkeleb.github.io/clay/pages/example.html)** | **[→ Repository](https://github.com/morkeleb/clay-example)**

## Example

**Model (`clay/model.json`):**

```json
{
  "name": "user-service",
  "generators": ["./generators/api"],
  "model": {
    "types": [
      {
        "name": "User",
        "fields": [
          { "name": "id", "type": "string" },
          { "name": "email", "type": "string" }
        ]
      }
    ]
  }
}
```

**Template (`generators/api/templates/model.js`):**

```javascript
class {{pascalCase name}} {
  constructor(data) {
{{#each fields}}
    this.{{name}} = data.{{name}};
{{/each}}
  }
}
```

**Generated (`src/models/user.model.js`):**

```javascript
class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
  }
}
```

## Commands

```bash
clay generate [model] [output]  # Generate code (+ drop obsolete non-touch files)
clay clean [model] [output]     # Full wipe of tracked generated files
clay watch [model] [output]     # Watch and regenerate
clay test-path <model> <path>   # Test JSONPath expressions
clay init [type] [name]         # Initialize project or generator
clay init-claude                # Set up Claude Code hooks for generated file protection
clay init-mcp                   # Add Clay MCP server (interactive platform selection)
```

On `generate`, Clay drops obsolete **non-touch** files for each model that actually ran: paths still listed in that model’s `.clay` `generated_files` but not produced again (including hash-skipped paths) are removed from the index and, when no other model entry claims them, from disk. Touch scaffolds still selected this pass are protected. Hand-written files and other models’ outputs are never auto-deleted.

You do **not** need `clay clean` after removing an entity or shrinking the model — regenerate is enough. Use `clean` for a full wipe, renaming/moving an output directory, or starting over.

Input-hash skip is bypassed when tracked `generated_files` are missing on disk (ledger drift). Orphan deletes run only after all selected models succeed; the swept ledger is saved before any refresh. If any orphans were unlinked, every model that ran is generated once more (without `postGenerate` hooks) so filesystem-dependent templates (e.g. TypeScript engine aggregates such as `root.ts`) recompute against the cleaned tree. Disk inventory in TS templates should be read inside `render()`, not at module load.

## AI Integration (MCP Server)

Clay includes an MCP server for seamless integration with AI assistants like Claude and GitHub Copilot.

**Quick Setup for VS Code:**

```json
// .vscode/mcp.json
{
  "servers": {
    "clay": {
      "type": "stdio",
      "command": "clay-mcp",
      "args": []
    }
  }
}
```

**[→ View Complete Setup Guide](https://morkeleb.github.io/clay/pages/mcp-server.html)**

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

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

**[→ Full CLI Reference](https://morkeleb.github.io/clay/pages/cli.html)**

## Usage Examples

Clay commands follow a simple pattern. Here are quick examples:

```bash
# Generate code from model
clay generate <model_path> <output_path>

# Test JSONPath expressions
clay test-path <model_path> "$.model.types[*]"

# Clean generated files
clay clean <model_path> <output_path>

# Watch for changes
clay watch <model_path> <output_path>

# Initialize project or generator
clay init
clay init generator my-generator
```

**[→ See detailed command documentation](https://morkeleb.github.io/clay/pages/cli.html)**

## Watch

For continuous development, use watch mode to automatically regenerate when files change. See the [CLI documentation](https://morkeleb.github.io/clay/pages/cli.html#watch-mode) for details.

# Domain Model

**[→ See Complete Model Documentation](https://morkeleb.github.io/clay/pages/models.html)**

Clay uses structured JSON models with support for includes and mixins. Models define your domain structure and specify which generators to run.

# Generators

**[→ See Complete Generator Documentation](https://morkeleb.github.io/clay/pages/generators.html)**

Generators define steps to generate files, run commands, or copy existing files. Each generator runs in the order defined.

# Templates and Helpers

**[→ See Complete Template & Helper Documentation](https://morkeleb.github.io/clay/pages/templates.html)**

Clay supports three template engines, selectable per generator step via the optional `engine` field:

- **Handlebars** (default) — simple substitution and iteration with `{{helpers}}`
- **EJS** (`"engine": "ejs"`) — inline JavaScript for filtering, deduplication, computed logic
- **TypeScript** (`"engine": "ts"`) — `CodeGenerator` base class for fully programmatic generation, with access to npm packages, async/await, and database queries

All engines share 47+ built-in helpers for case conversion, pluralization, and more. Templates support partials for reusable code snippets.

# Files and Project Structure

A typical Clay project structure:

```
clay/
├── model.json                  # Your domain model
├── generators/                 # Custom generators
│   └── my-generator/
│       ├── generator.json     # Generator configuration
│       ├── templates/         # Templates (Handlebars, EJS, or TypeScript)
│       └── partials/          # Reusable template parts
└── mixins/                    # Model transformation functions
```

**[→ Complete Project Structure Guide](https://morkeleb.github.io/clay/pages/models.html#project-structure)**

## GitHub Copilot Integration

Clay integrates with GitHub Copilot through the MCP server. See the [AI Integration section](#ai-integration-mcp-server) above for setup.

**[→ Complete Copilot Integration Guide](https://morkeleb.github.io/clay/pages/mcp-server.html#github-copilot)**

## Changes and Roadmap

### Completed

- ✅ Casing helpers (camelCase, pascalCase, etc.)
- ✅ Increment helper for indexes
- ✅ Pretty output with chalk
- ✅ Node module generator loading
- ✅ Built-in watch support
- ✅ Clean command
- ✅ .clay file inventory tracking
- ✅ Generator validation

### Future

- [ ] Model validations
- [ ] Dry run option
- [ ] Template system regression tests
- [ ] Directory clearing option

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
