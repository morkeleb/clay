# TypeScript Migration Plan

**Branch:** `feature/typescript-migration`  
**Status:** Planning  
**Started:** November 8, 2025

## Overview

This document outlines the plan to migrate the Clay code generator from JavaScript to TypeScript. The migration will be done incrementally to maintain stability and ensure backward compatibility with existing generators.

## Goals

- ✅ Add type safety to catch errors at compile time
- ✅ Improve IDE support and developer experience
- ✅ Maintain backward compatibility with existing generators
- ✅ Improve code documentation through types
- ✅ Enable better refactoring capabilities

## Current Project Structure

```
clay/
├── index.js                    # CLI entry point
├── src/
│   ├── clay_file.js           # Manages .clay file inventory
│   ├── command-line.js        # CLI command definitions
│   ├── generator-manager.js   # Orchestrates generator execution
│   ├── generator.js           # Generator step execution
│   ├── jsonpath-helper.js     # JSONPath utilities
│   ├── model.js               # Model loading and processing
│   ├── output.js              # File output management
│   ├── require-helper.js      # Module loading utilities
│   ├── template-engine.js     # Handlebars template processing
│   └── schemas/
│       └── generator_schema.json
└── test/
    └── *.js                   # Mocha test files
```

## Migration Phases

### Phase 1: Setup & Configuration

#### Task 1: Set up TypeScript configuration and dependencies
**Status:** ⏳ Not Started  
**Estimated Time:** 1-2 hours

**Actions:**
- [ ] Install TypeScript as a dev dependency
- [ ] Install type definitions:
  - [ ] `@types/node`
  - [ ] `@types/lodash`
  - [ ] `@types/handlebars`
  - [ ] `@types/inquirer`
  - [ ] `@types/minimatch`
  - [ ] `@types/fs-extra`
  - [ ] `@types/marked`
- [ ] Create `tsconfig.json` with appropriate compiler options:
  - Target: ES2020 or later
  - Module: CommonJS (for Node.js compatibility)
  - Output directory: `dist/`
  - Source maps: enabled
  - Strict mode: enabled (consider gradual adoption)
  - Declaration files: enabled
  - Root dir: `./`
  - Include: `src/**/*`, `index.ts`
  - Exclude: `node_modules`, `test`, `coverage`

**Dependencies:**
- None

**Verification:**
- `tsc --noEmit` runs without errors on initial setup

---

#### Task 2: Configure build and development scripts
**Status:** ⏳ Not Started  
**Estimated Time:** 1-2 hours

**Actions:**
- [ ] Install development dependencies:
  - [ ] `ts-node` - Run TypeScript directly without compilation
  - [ ] `tsconfig-paths` - Support path mapping in development
- [ ] Create development entry point `dev-index.ts`:
  - [ ] Use ts-node shebang: `#!/usr/bin/env ts-node`
  - [ ] Import and run main CLI logic
- [ ] Update `package.json`:
  - [ ] Add `build` script: `tsc`
  - [ ] Add `build:watch` script: `tsc --watch`
  - [ ] Add `dev` script: `ts-node index.ts` (for manual testing)
  - [ ] Update `main` to point to `dist/index.js`
  - [ ] Add conditional `bin` field strategy:
    - Development (when using `npm link`): Use `dev-index.ts` with ts-node
    - Production (when published): Use `dist/index.js`
  - [ ] Add `prepare` script: `npm run build` (builds on npm install)
  - [ ] Add `prepublishOnly` script: `npm run build` (ensures build before publish)
  - [ ] Add `files` field to include `dist/` in npm package
- [ ] Create wrapper script `bin/clay-dev` for development:
  - [ ] Checks if TypeScript files are newer than compiled files
  - [ ] Uses ts-node for development mode
  - [ ] Falls back to compiled version for production
- [ ] Create `.npmignore` to exclude TypeScript source files from package
- [ ] Add `dist/` to `.gitignore`
- [ ] Document `npm link` workflow in migration plan

**Dependencies:**
- Task 1

**Verification:**
- `npm run build` compiles successfully
- Generated files appear in `dist/` directory
- `npm link` allows running `clay` commands without recompilation
- Changes to TypeScript files are immediately available when running linked CLI

---

### Phase 2: Type Definitions

#### Task 3: Create TypeScript type definitions
**Status:** ⏳ Not Started  
**Estimated Time:** 3-4 hours

**Actions:**
- [ ] Create `src/types/` directory for type definitions
- [ ] Define core interfaces in `src/types/index.ts`:
  - [ ] `ClayModel` - Root model structure
  - [ ] `Generator` - Generator configuration
  - [ ] `GeneratorStep` - Individual step types (generate, copy, runCommand)
  - [ ] `GeneratorStepGenerate`
  - [ ] `GeneratorStepCopy`
  - [ ] `GeneratorStepCommand`
  - [ ] `ClayFile` - .clay file structure
  - [ ] `ClayFileEntry` - Individual generated file entry
  - [ ] `TemplateContext` - Context passed to Handlebars
  - [ ] `ModelWithMixins` - Model with mixin support
  - [ ] `OutputOptions` - File output configuration
  - [ ] `CommandLineOptions` - CLI option types
- [ ] Import and use JSON schema types for validation
- [ ] Document each interface with JSDoc comments

**Dependencies:**
- Task 1

**Files to Create:**
- `src/types/index.ts`
- `src/types/model.ts`
- `src/types/generator.ts`
- `src/types/clay-file.ts`
- `src/types/template.ts`

**Verification:**
- All type definitions compile without errors
- Types accurately represent current JavaScript objects

---

### Phase 3: Incremental Migration

#### Task 4: Migrate utility modules first
**Status:** ⏳ Not Started  
**Estimated Time:** 2-3 hours

**Actions:**
- [ ] Rename and migrate `src/jsonpath-helper.js` → `src/jsonpath-helper.ts`
  - [ ] Add return type annotations
  - [ ] Add parameter type annotations
  - [ ] Handle JSONPath library types
- [ ] Rename and migrate `src/require-helper.js` → `src/require-helper.ts`
  - [ ] Add return type annotations for dynamic requires
  - [ ] Handle global module resolution types
- [ ] Rename and migrate `src/output.js` → `src/output.ts`
  - [ ] Add types for file operations
  - [ ] Type file hashing and change detection
  - [ ] Import ClayFile types

**Dependencies:**
- Task 3

**Files to Migrate:**
- `src/jsonpath-helper.js` → `src/jsonpath-helper.ts`
- `src/require-helper.js` → `src/require-helper.ts`
- `src/output.js` → `src/output.ts`

**Verification:**
- Modules compile without errors
- Existing tests pass (if running in hybrid mode)

---

#### Task 5: Migrate core modules
**Status:** ⏳ Not Started  
**Estimated Time:** 4-6 hours

**Actions:**
- [ ] Migrate `src/model.js` → `src/model.ts`
  - [ ] Type model loading functions
  - [ ] Type mixin application
  - [ ] Type include resolution
  - [ ] Handle recursive model structures
- [ ] Migrate `src/template-engine.js` → `src/template-engine.ts`
  - [ ] Type Handlebars helper registration
  - [ ] Type template context creation
  - [ ] Type custom helpers (markdown, pascalCase, etc.)
  - [ ] Handle dynamic helper registration
- [ ] Migrate `src/generator.js` → `src/generator.ts`
  - [ ] Type generator step execution
  - [ ] Type copy, generate, and command steps
  - [ ] Type formatter integration
  - [ ] Type partial registration

**Dependencies:**
- Task 4

**Files to Migrate:**
- `src/model.js` → `src/model.ts`
- `src/template-engine.js` → `src/template-engine.ts`
- `src/generator.js` → `src/generator.ts`

**Verification:**
- Core modules compile without errors
- Template rendering works correctly
- Generator steps execute properly

---

#### Task 6: Migrate infrastructure modules
**Status:** ⏳ Not Started  
**Estimated Time:** 2-3 hours

**Actions:**
- [ ] Migrate `src/clay_file.js` → `src/clay_file.ts`
  - [ ] Type .clay file read/write operations
  - [ ] Type inventory tracking
  - [ ] Type file hash comparisons
- [ ] Migrate `src/generator-manager.js` → `src/generator-manager.ts`
  - [ ] Type generator orchestration
  - [ ] Type generator loading
  - [ ] Type execution coordination

**Dependencies:**
- Task 5

**Files to Migrate:**
- `src/clay_file.js` → `src/clay_file.ts`
- `src/generator-manager.js` → `src/generator-manager.ts`

**Verification:**
- Generator execution works end-to-end
- .clay file management functions correctly

---

#### Task 7: Migrate command-line interface
**Status:** ⏳ Not Started  
**Estimated Time:** 2-3 hours

**Actions:**
- [ ] Migrate `src/command-line.js` → `src/command-line.ts`
  - [ ] Type Commander.js command definitions
  - [ ] Type command handler functions
  - [ ] Type inquirer prompts
- [ ] Migrate `index.js` → `index.ts`
  - [ ] Update shebang to work with compiled output
  - [ ] Type CLI initialization
- [ ] Update `package.json` bin field
- [ ] Ensure compiled CLI is executable

**Dependencies:**
- Task 6

**Files to Migrate:**
- `src/command-line.js` → `src/command-line.ts`
- `index.js` → `index.ts`

**Verification:**
- CLI commands run successfully
- All command options work correctly
- Error handling displays properly

---

### Phase 4: Quality & Documentation

#### Task 8: Update test suite for TypeScript
**Status:** ⏳ Not Started  
**Estimated Time:** 3-4 hours

**Actions:**
- [ ] Install test type definitions:
  - [ ] `@types/mocha`
  - [ ] `@types/chai`
  - [ ] `@types/sinon`
- [ ] Install and configure `ts-node` for running TypeScript tests
- [ ] Update `package.json` test script to use ts-node
- [ ] Migrate test files:
  - [ ] `test/clay-file.js` → `test/clay-file.test.ts`
  - [ ] `test/command-line.js` → `test/command-line.test.ts`
  - [ ] `test/generator-manager.js` → `test/generator-manager.test.ts`
  - [ ] `test/generator.js` → `test/generator.test.ts`
  - [ ] `test/model.js` → `test/model.test.ts`
  - [ ] `test/output.js` → `test/output.test.ts`
  - [ ] `test/index.js` → `test/index.test.ts`
- [ ] Add type assertions in tests
- [ ] Update test fixtures if needed

**Dependencies:**
- Task 7

**Verification:**
- All tests pass with TypeScript
- Test coverage remains the same or improves
- `npm test` runs successfully

---

#### Task 9: Add ESLint and Prettier for TypeScript
**Status:** ⏳ Not Started  
**Estimated Time:** 1-2 hours

**Actions:**
- [ ] Install ESLint and TypeScript parser:
  - [ ] `eslint`
  - [ ] `@typescript-eslint/parser`
  - [ ] `@typescript-eslint/eslint-plugin`
- [ ] Install Prettier:
  - [ ] `prettier`
  - [ ] `eslint-config-prettier`
- [ ] Create `.eslintrc.json` configuration
- [ ] Create `.prettierrc` configuration
- [ ] Add lint scripts to `package.json`:
  - [ ] `lint`: Check for issues
  - [ ] `lint:fix`: Auto-fix issues
  - [ ] `format`: Format code with Prettier
- [ ] Run lint and fix any issues
- [ ] (Optional) Set up husky for pre-commit hooks

**Dependencies:**
- Task 8

**Verification:**
- `npm run lint` passes
- `npm run format` formats code correctly
- No linting errors in codebase

---

#### Task 10: Update documentation
**Status:** ⏳ Not Started  
**Estimated Time:** 2 hours

**Actions:**
- [ ] Update `README.md`:
  - [ ] Add "Development" section with TypeScript setup
  - [ ] Document build process
  - [ ] Document `npm link` workflow for local development
  - [ ] Explain ts-node development mode
  - [ ] Update contribution guidelines
  - [ ] Add information about type definitions
  - [ ] Add troubleshooting section for common TypeScript issues
- [ ] Create `CONTRIBUTING.md` (if doesn't exist):
  - [ ] TypeScript coding standards
  - [ ] Build and test instructions
  - [ ] Local development workflow with npm link
  - [ ] Type safety guidelines
  - [ ] How to add new features with proper types
- [ ] Update inline code documentation with better JSDoc
- [ ] Consider generating API documentation with TypeDoc

**Dependencies:**
- Task 9

**Verification:**
- Documentation is clear and accurate
- Build instructions work for new contributors
- npm link workflow is well documented
- Development setup instructions are easy to follow

---

#### Task 11: Verify and test migration
**Status:** ⏳ Not Started  
**Estimated Time:** 2-3 hours

**Actions:**
- [ ] Run full test suite: `npm test`
- [ ] Test CLI commands manually:
  - [ ] `clay init`
  - [ ] `clay generate` with sample model
  - [ ] `clay clean`
  - [ ] `clay watch`
  - [ ] `clay test-path`
- [ ] Test with existing generators:
  - [ ] Use generators from test/samples
  - [ ] Verify backward compatibility
- [ ] Test npm package build:
  - [ ] `npm pack`
  - [ ] Install locally and test
- [ ] Performance testing:
  - [ ] Compare execution time with JavaScript version
  - [ ] Ensure no significant performance degradation
- [ ] Create smoke test checklist
- [ ] Fix any issues discovered

**Dependencies:**
- Task 10

**Verification:**
- All tests pass
- All CLI commands work correctly
- Existing generators continue to work
- Package can be built and installed
- No performance regressions

---

## Development Workflow

### Local Development with npm link

When working on Clay locally, you'll want to test changes without constantly recompiling. Here's how the development setup works:

#### Setup for Development

1. **Link the package globally:**
   ```bash
   npm link
   ```

2. **Development mode automatically uses ts-node:**
   - The `bin` field points to a wrapper script that detects development mode
   - When source files exist, it uses `ts-node` to run TypeScript directly
   - No compilation needed - changes are immediately available

3. **Test your changes:**
   ```bash
   clay generate ./test/samples/clay-model-test.json ./output
   ```

#### How it Works

The development setup uses a smart wrapper script (`bin/clay-dev`) that:

1. Checks if running in development (source files present) or production (dist only)
2. In development: Uses `ts-node` to execute TypeScript directly
3. In production: Uses compiled JavaScript from `dist/`

**Benefits:**
- ✅ No need to rebuild after every change
- ✅ Fast iteration cycle
- ✅ Same command works in dev and prod
- ✅ Type checking happens on the fly

#### Alternative: Watch Mode

If you prefer compilation:
```bash
npm run build:watch
```

This runs TypeScript compiler in watch mode, recompiling on file changes.

#### Testing Local Changes

```bash
# In the clay directory
npm link

# In a test project
clay init
clay generate model.json ./output

# Make changes to Clay source
# Run clay again - changes are reflected immediately!
```

---

## TypeScript Configuration Strategy

### Compiler Options (Recommended)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "removeComments": true,
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "index.ts"],
  "exclude": ["node_modules", "dist", "test", "coverage"]
}
```

### Migration Strategy

1. **Gradual Strictness**: Start with less strict TypeScript settings if needed, then increase strictness
2. **Type First**: Define types before migrating modules
3. **Bottom-Up**: Migrate utilities first, then core modules, then CLI
4. **Test Continuously**: Keep tests running during migration
5. **Dual Mode**: Consider running both JS and TS during migration if needed

## Risk Management

### Potential Issues

1. **Dynamic Require Issues**: The `require-helper.js` uses dynamic requires for generators
   - **Mitigation**: Use proper type assertions and `any` where necessary, document limitations

2. **Handlebars Type Complexity**: Custom helpers have complex signatures
   - **Mitigation**: Use generics and helper type utilities, consider `any` for some helpers initially

3. **JSONPath Types**: JSONPath library may have incomplete types
   - **Mitigation**: Create custom type declarations if needed

4. **Breaking Changes**: Type errors might reveal existing bugs
   - **Mitigation**: Fix bugs incrementally, maintain backward compatibility

5. **Build Size**: TypeScript adds build step complexity
   - **Mitigation**: Clear documentation, simple build scripts

### Rollback Plan

If critical issues arise:
1. Revert to master branch
2. Address issues on feature branch
3. Re-attempt migration with lessons learned

## Success Criteria

- ✅ All existing tests pass
- ✅ No runtime errors in CLI commands
- ✅ Backward compatibility with existing generators maintained
- ✅ Type coverage > 90%
- ✅ Documentation updated
- ✅ Build process is simple and reliable
- ✅ Performance is equivalent to JavaScript version

## Timeline Estimate

- **Phase 1 (Setup)**: 2-3 hours
- **Phase 2 (Types)**: 3-4 hours
- **Phase 3 (Migration)**: 10-15 hours
- **Phase 4 (Quality)**: 8-10 hours

**Total Estimated Time**: 23-32 hours

## Progress Tracking

### Completed Tasks
<!-- Update this section as tasks are completed -->

- None yet

### Current Task
<!-- Update this section with what you're currently working on -->

Planning phase

### Blocked Tasks
<!-- List any tasks that are blocked and why -->

None

## Development Setup Details

### Package.json Configuration

The `package.json` will be configured to support both development and production modes:

```json
{
  "name": "clay-generator",
  "main": "dist/index.js",
  "bin": {
    "clay": "bin/clay-dev"
  },
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "dev": "ts-node index.ts",
    "prepare": "npm run build",
    "prepublishOnly": "npm run build && npm test",
    "test": "mocha",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\" \"*.ts\""
  },
  "files": [
    "dist/",
    "bin/",
    "README.md",
    "LICENSE"
  ]
}
```

### Wrapper Script (bin/clay-dev)

```bash
#!/usr/bin/env bash

# Determine the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if we're in development mode (TypeScript source exists)
if [ -f "$PROJECT_ROOT/index.ts" ]; then
  # Development mode: use ts-node
  exec node --require ts-node/register "$PROJECT_ROOT/index.ts" "$@"
else
  # Production mode: use compiled JavaScript
  exec node "$PROJECT_ROOT/dist/index.js" "$@"
fi
```

This wrapper:
- Automatically detects development vs production environment
- Uses `ts-node` when source files are available
- Falls back to compiled version when distributed
- Passes all arguments through to the CLI

### Alternative: Two-Binary Approach

If the wrapper proves complex, use separate binaries:

```json
{
  "bin": {
    "clay": "dist/index.js",
    "clay-dev": "dev-index.ts"
  }
}
```

During development, use `clay-dev` instead of `clay`.

---

## Notes & Decisions

<!-- Add notes about important decisions made during migration -->

- **Date**: 2025-11-08
- **Decision**: Migrate to TypeScript incrementally to maintain stability
- **Rationale**: Reduces risk and allows for continuous testing

- **Date**: 2025-11-08
- **Decision**: Use ts-node for development mode to avoid constant recompilation
- **Rationale**: Improves developer experience and iteration speed when using `npm link`

- **Date**: 2025-11-08
- **Decision**: Create wrapper script to automatically detect dev vs production mode
- **Rationale**: Single command works in both environments, no need to remember different commands

---

## Next Steps

1. Review this migration plan
2. Begin with Task 1: Set up TypeScript configuration
3. Work through tasks sequentially
4. Update this document as progress is made
5. Document any issues or decisions in the Notes section

---

**Last Updated**: November 8, 2025
