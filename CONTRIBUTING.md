# Contributing to Clay

Thank you for your interest in contributing to Clay! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [TypeScript Guidelines](#typescript-guidelines)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Project Architecture](#project-architecture)

## Getting Started

Clay is a TypeScript-based code generator that uses JSON models and Handlebars templates. Before contributing, familiarize yourself with:

- TypeScript fundamentals
- Handlebars template syntax
- JSONPath expressions
- Node.js CLI development

## Development Setup

### Prerequisites

- Node.js 14 or higher
- npm 7 or higher
- Git

### Initial Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/clay.git
cd clay
```

2. **Install dependencies**

```bash
npm install
```

3. **Link for local testing**

```bash
npm link
```

4. **Verify the setup**

```bash
clay --version
npm test
```

### Development Workflow

Clay uses a smart development wrapper (`bin/clay-dev`) that automatically uses `ts-node` when source files are present. This means you can make changes to TypeScript files and immediately test them without compilation:

```bash
# Edit src/generator.ts
# Then immediately test:
clay generate ./test/samples/cmd-example.json ./output
```

For production builds:

```bash
npm run build        # One-time build
npm run build:watch  # Continuous build on file changes
```

## TypeScript Guidelines

### Type Safety

Clay uses TypeScript strict mode. Follow these guidelines:

- **Avoid `any` types** - Use specific types or `unknown` when the type is truly unknown
- **Use type guards** - For discriminated unions (e.g., `GeneratorStep`)
- **Prefer interfaces over types** - For object shapes
- **Export types** - Make types available for external use

### Example

```typescript
// Good
interface GeneratorStepGenerate {
  generate: string;
  select?: string;
  target?: string;
}

function isGenerateStep(step: GeneratorStep): step is GeneratorStepGenerate {
  return 'generate' in step;
}

// Avoid
function processStep(step: any) {
  // Don't use any
  if (step.generate) {
    // No type safety
    // ...
  }
}
```

### Type Organization

- **Core types** - Located in `src/types/`
- **Module declarations** - For untyped packages in `src/types/modules/`
- **Inline types** - For small, file-specific types
- **Exported types** - Via `src/types/index.ts` for external use

## Code Style

### Formatting

Clay uses Prettier for code formatting. Run before committing:

```bash
npm run format
```

### Linting

ESLint enforces code quality:

```bash
npm run lint         # Check for issues
npm run lint:fix     # Auto-fix issues
```

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes/Interfaces**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Private members**: Prefix with `_` if needed

### Code Organization

```typescript
// 1. Imports (external first, then internal)
import fs from 'fs-extra';
import path from 'path';
import { Generator } from './types/generator';

// 2. Type definitions
interface LocalConfig {
  // ...
}

// 3. Constants
const DEFAULT_OUTPUT = './dist';

// 4. Helper functions
function helperFunction() {
  // ...
}

// 5. Main exported functions
export function mainFunction() {
  // ...
}
```

## Testing

### Writing Tests

Tests use Mocha, Chai, and Sinon:

```typescript
import { expect } from 'chai';
import sinon from 'sinon';
import * as myModule from '../src/my-module';

describe('myModule', () => {
  let stub: sinon.SinonStub;

  beforeEach(() => {
    stub = sinon.stub(console, 'log');
  });

  afterEach(() => {
    stub.restore();
  });

  it('should do something', () => {
    const result = myModule.doSomething();
    expect(result).to.equal(expectedValue);
  });
});
```

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

### Test Coverage

Aim for high test coverage:

- New features should include tests
- Bug fixes should include regression tests
- Edge cases should be tested

## Pull Request Process

### Before Submitting

1. **Create a feature branch**

```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes**
   - Write clean, typed TypeScript
   - Add/update tests
   - Update documentation

3. **Verify everything works**

```bash
npm run lint
npm run format
npm test
npm run build
```

4. **Commit your changes**

```bash
git add .
git commit -m "feat: add amazing feature"
```

Use conventional commit messages:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test changes
- `refactor:` - Code refactoring
- `chore:` - Build/tooling changes

### Submitting the PR

1. Push your branch to your fork
2. Create a Pull Request to `main`
3. Fill out the PR template
4. Link any related issues
5. Wait for review

### PR Requirements

- All tests must pass
- Code must be linted and formatted
- No TypeScript compilation errors
- Documentation updated if needed
- Clear description of changes

## Project Architecture

### Key Components

**Command-Line Interface** (`src/command-line.ts`)

- Commander.js-based CLI
- Command handlers for generate, clean, watch, etc.
- Entry point for user interactions

**Generator Engine** (`src/generator.ts`)

- Executes generator steps
- Handles template rendering
- Manages file operations
- Runs shell commands

**Model Loader** (`src/model.ts`)

- Loads and validates models
- Executes mixins
- Resolves includes

**Template Engine** (`src/template-engine.ts`)

- Handlebars integration
- Custom helpers (pascalCase, kebabCase, etc.)
- Partial loading
- Context variable injection

**Clay File Manager** (`src/clay_file.ts`)

- Tracks generated files
- Manages MD5 checksums
- Enables incremental generation

### Data Flow

```
User → CLI → Model Loader → Generator Engine → Template Engine → Output
                                     ↓
                              Clay File Manager
```

1. User runs `clay generate model.json ./output`
2. CLI parses commands and loads the model
3. Model loader processes includes/mixins
4. Generator engine executes steps
5. Templates are rendered with context
6. Files are written/updated
7. Clay file tracks what was generated

### Adding New Features

**New Generator Step Type**

1. Add type to `src/types/generator.ts`
2. Add type guard function
3. Implement handler in `src/generator.ts`
4. Add Zod schema validation
5. Update documentation
6. Add tests

**New Template Helper**

1. Add helper to `src/template-engine.ts`
2. Register in `handlebars_helpers` object
3. Update README with usage example
4. Add tests

**New CLI Command**

1. Add command in `src/command-line.ts`
2. Implement handler function
3. Update CLI types if needed
4. Update README
5. Add tests

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the ISC License.
