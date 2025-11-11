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

**📚 [Full Documentation](https://morkeleb.github.io/clay/)** | **[Getting Started](https://morkeleb.github.io/clay/pages/getting-started.html)** | **[NPM Package](https://www.npmjs.com/package/clay-generator)**

Clay is a template-focused code generator that transforms JSON models into actual code using Handlebars templates, shell commands, and file operations. Built with TypeScript for type safety and reliability.

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

- ✅ **[Template-Based Generation](https://morkeleb.github.io/clay/pages/templates.html)** - 47+ Handlebars helpers for flexible code generation
- ✅ **[Type-Safe](https://morkeleb.github.io/clay/)** - Built with TypeScript for reliability
- ✅ **[Model-Driven](https://morkeleb.github.io/clay/pages/models.html)** - Define your domain once, generate everywhere
- ✅ **[Watch Mode](https://morkeleb.github.io/clay/pages/cli.html)** - Auto-regenerate on model changes
- ✅ **[AI-Powered](https://morkeleb.github.io/clay/pages/mcp-server.html)** - MCP server for Claude & GitHub Copilot

**[→ View Full Documentation](https://morkeleb.github.io/clay/)**

## Documentation

- **[Getting Started](https://morkeleb.github.io/clay/pages/getting-started.html)** - Installation, setup, and your first project
- **[Models](https://morkeleb.github.io/clay/pages/models.html)** - Define domain models in JSON with mixins and includes
- **[Generators](https://morkeleb.github.io/clay/pages/generators.html)** - Configure generation steps and workflows
- **[Templates](https://morkeleb.github.io/clay/pages/templates.html)** - Handlebars templates with 47+ helpers
- **[AI Integration](https://morkeleb.github.io/clay/pages/mcp-server.html)** - MCP server for Claude & Copilot
- **[CLI Reference](https://morkeleb.github.io/clay/pages/cli.html)** - Complete command-line guide

## Features

### [Template-Based Generation](https://morkeleb.github.io/clay/pages/templates.html)

Generate files from Handlebars templates with access to your full model data. Use 47+ built-in helpers for string manipulation, logic, iteration, and more.

### [JSONPath Selectors](https://morkeleb.github.io/clay/pages/models.html)

Target specific parts of your model for precise generation. Test selectors with the `clay test-path` command.

### [Watch Mode](https://morkeleb.github.io/clay/pages/cli.html)

Automatically regenerate when models or templates change during development.

### [AI Integration](https://morkeleb.github.io/clay/pages/mcp-server.html)

MCP server provides type-safe tool calls for Claude and GitHub Copilot, enabling AI-assisted generator development.

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
clay generate [model] [output]  # Generate code
clay clean [model] [output]     # Remove generated files
clay watch [model] [output]     # Watch and regenerate
clay test-path <model> <path>   # Test JSONPath expressions
clay init [type] [name]         # Initialize project or generator
```

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

Clay uses Handlebars templates with custom helpers for case conversion, pluralization, and more. Templates support partials for reusable code snippets.

# Files and Project Structure

A typical Clay project structure:

```
clay/
├── model.json                  # Your domain model
├── generators/                 # Custom generators
│   └── my-generator/
│       ├── generator.json     # Generator configuration
│       ├── templates/         # Handlebars templates
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
