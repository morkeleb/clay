# Post-Generation Hooks Design

## Problem

Clay generates structural code and creates touch file skeletons, but filling in business logic is left entirely to the developer or governing AI process. When a Clay model produces many touch files (e.g., 10 service implementations), the governing Claude session must fill each one sequentially, carrying the full project context.

A better workflow: Clay's generators know what files they produce and what model data each file corresponds to. After generation, the generator can spawn focused worker processes (Claude headless instances, linters, formatters) with tight, specialized contexts — freeing the governing process to focus on architecture and quality.

## Approach

Add a `postGenerate` section to `generator.json`. Hooks are TypeScript files using the `PostGenerateHook` base class (same pattern as `CodeGenerator`), giving users full programmatic control. Shell command hooks are also supported as a shorthand. Hooks run after all steps complete and files are on disk. They are best-effort — failures are logged as warnings, never fail the generation.

## Generator config

```json
{
  "partials": [...],
  "formatters": [...],
  "steps": [
    { "generate": "templates/service-interface.hbs", "select": "$.model.types[*]", "target": "src/services/I{{pascalCase name}}Service.ts" },
    { "generate": "templates/service-impl.hbs", "select": "$.model.types[*]", "target": "src/services/{{pascalCase name}}ServiceImpl.ts", "touch": true }
  ],
  "postGenerate": [
    {
      "run": "hooks/fill-services.ts",
      "select": "$.model.types[*]",
      "onlyNewTouchFiles": true
    },
    {
      "runCommand": "eslint --fix src/",
      "verbose": true
    }
  ]
}
```

## Hook types

### TypeScript hook (primary)

The `PostGenerateHook` base class follows the same pattern as `CodeGenerator` — a typed contract with full programmatic control. Users import from `clay-generator/types`.

```typescript
// hooks/fill-services.ts
import { PostGenerateHook, type HookContext } from 'clay-generator/types';
import { execSync } from 'child_process';
import fs from 'fs';

export default class extends PostGenerateHook {
  async run({ data, helpers, touchFiles, outputDir }: HookContext): Promise<void> {
    const { pascalCase } = helpers;

    // Read the generated interface to include in the prompt
    const interfacePath = `${outputDir}/src/services/I${pascalCase(data.name)}Service.ts`;
    const iface = fs.readFileSync(interfacePath, 'utf-8');

    // Only fill in touch files that were newly created
    for (const file of touchFiles) {
      const prompt = [
        `Implement ${pascalCase(data.name)}ServiceImpl.`,
        `Follow this interface:\n${iface}`,
        `Entity fields: ${JSON.stringify(data.fields)}`,
        `Write only the implementation, no explanation.`,
      ].join('\n');

      execSync(`claude -p '${prompt}'`, {
        cwd: outputDir,
        timeout: 60000,
      });
    }
  }
}
```

#### HookContext

Extends `RenderContext` with hook-specific data:

```typescript
export interface HookContext {
  /** The selected model item */
  data: Record<string, any>;
  /** Clay helpers — pascalCase, camelCase, pluralize, etc. */
  helpers: ClayHelpers;
  /** The full root model */
  model: Record<string, any>;
  /** Parent object in the JSON hierarchy */
  parent?: Record<string, any>;
  /** Touch files that were newly created during this generation run */
  touchFiles: string[];
  /** The output directory for this generator */
  outputDir: string;
  /** All files generated during this run (not just touch files) */
  generatedFiles: string[];
}
```

The `touchFiles` array contains only files that were created during this run — not files that already existed and were skipped. This is the key data that enables "run Claude only on new files."

#### Base class

```typescript
export abstract class PostGenerateHook {
  abstract run(context: HookContext): void | Promise<void>;
}
```

Same shape-based runtime enforcement as `CodeGenerator` — `typeof instance.run === 'function'`, `instance.run.length >= 1`. Same `jiti` loading. Same `clay-generator/types` import for compile-time contract.

### Shell command (shorthand)

For simple cases that don't need programmatic logic:

```json
{
  "runCommand": "prettier --write src/",
  "verbose": true
}
```

Shell commands support:
- `select` — run once per JSONPath match with Handlebars templating on the command string
- `verbose` — log command output
- No `onlyNewTouchFiles` (no way to filter — use a TS hook for that)

## Key semantics

### When hooks run

Hooks run after **all** generator steps have completed and the `.clay` file is saved. All generated files and touch files are on disk. The hook sees the full output of the generation run.

### Hook execution

Each hook in the `postGenerate` array is processed in order. Within a single TS hook:

- If `select` is specified, the hook's `run()` is called once per JSONPath match
- The `touchFiles` array is scoped to files produced by that specific match
- `generatedFiles` contains all files from the full run
- Hooks with `select` run their matches in parallel (configurable concurrency, default 5)

### Failure handling

Hooks are best-effort. An error or rejection:

- Logs a warning with the hook file, error message, and which model item triggered it
- Does **not** fail the generation (files are already written)
- Does **not** prevent subsequent hooks from running
- Errors are collected and reported in the generation result

### `onlyNewTouchFiles` flag

When `true`, the hook only runs for items where at least one touch file was newly created during this generation run. If all touch files for an item already existed (and were skipped), the hook is skipped for that item.

This is the key flag for AI fill-in workflows — run Claude only on fresh touch files, not on files the developer has already customized.

### Skipping

Hooks are skipped when the model is skipped (input hash unchanged). If generation didn't run, post-generation doesn't run either.

## Workflow: AI-assisted fill-in

The intended workflow with a governing Claude process:

```
1. Governing Claude updates the Clay model (adds new entity)
2. Governing Claude runs `clay generate`
3. Clay generates:
   - Structural files (interfaces, types, DTOs) — generated, tracked in .clay
   - Service skeletons — touch files, created once
4. Post-generate hooks fire:
   - TS hook reads the generated interface files from disk
   - For each NEW touch file, constructs a focused prompt with:
     - The skeleton content
     - The interface contract
     - The entity definition from the model
   - Spawns `claude -p` with the focused prompt
   - Workers run in parallel (concurrency limited)
5. Governing Claude reviews the results, makes corrections
```

The focused prompt per touch file is more effective than having the governing Claude fill in everything because:

- **Smaller context** — each worker Claude only sees what's relevant to its file
- **Parallel execution** — multiple files filled in simultaneously
- **Programmatic prompt construction** — TS hook reads surrounding files, filters fields, composes context
- **Governing Claude stays architectural** — reviews and corrects rather than implementing
- **Subscription-based** — headless Claude runs on the existing subscription

## Advanced use cases

### Conditional hooks

TS hooks can decide at runtime whether to run, what to include in prompts, or how to handle different entity types:

```typescript
export default class extends PostGenerateHook {
  async run({ data, helpers, touchFiles, outputDir }: HookContext): Promise<void> {
    // Skip entities that don't have commands
    if (!data.commands || data.commands.length === 0) return;

    // Different prompts for different entity types
    if (data.aggregate) {
      await this.fillAggregate(data, touchFiles, outputDir);
    } else {
      await this.fillSimpleEntity(data, touchFiles, outputDir);
    }
  }
}
```

### Linting and formatting

```typescript
export default class extends PostGenerateHook {
  async run({ generatedFiles }: HookContext): Promise<void> {
    const tsFiles = generatedFiles.filter(f => f.endsWith('.ts'));
    if (tsFiles.length === 0) return;

    execSync(`eslint --fix ${tsFiles.join(' ')}`);
    execSync(`prettier --write ${tsFiles.join(' ')}`);
  }
}
```

### Database-driven generation

```typescript
export default class extends PostGenerateHook {
  async run({ data, touchFiles, outputDir }: HookContext): Promise<void> {
    const { Client } = require('pg');
    const client = new Client();
    await client.connect();

    // Query actual DB constraints to enrich the generated validators
    const constraints = await client.query(
      'SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = $1',
      [data.name]
    );
    await client.end();

    // Write constraint-aware validation to the touch file
    // ...
  }
}
```

## Implementation notes

### Tracking new touch files

The render stage already skips touch files that exist on disk. To know which touch files were newly created:

- The render stage yields `RenderedItem` for touch files that don't exist yet (they go through the pipeline and get written)
- The render stage skips touch files that already exist (they don't yield)
- Track which touch files were written during this run in a `Set<string>`
- Track which model items (by JSONPath match) produced which touch files
- Pass both to the post-generate phase

### Type additions

```typescript
// In code-generator.ts (exported via clay-generator/types)

export interface HookContext {
  data: Record<string, any>;
  helpers: ClayHelpers;
  model: Record<string, any>;
  parent?: Record<string, any>;
  touchFiles: string[];
  outputDir: string;
  generatedFiles: string[];
}

export abstract class PostGenerateHook {
  abstract run(context: HookContext): void | Promise<void>;
}
```

### Generator type additions

```typescript
// In types/generator.ts

export interface PostGenerateHookStep {
  run: string;          // Path to TS hook file
  select?: string;      // JSONPath to select model items
  onlyNewTouchFiles?: boolean;
}

export interface PostGenerateCommandStep {
  runCommand: string;
  select?: string;
  verbose?: boolean;
}

export type PostGenerateStep = PostGenerateHookStep | PostGenerateCommandStep;
```

Add to `Generator` interface:

```typescript
export interface Generator {
  partials: string[];
  formatters: string[];
  steps: GeneratorStep[];
  conventions?: Convention[];
  postGenerate?: PostGenerateStep[];
}
```

### Parallel execution

TS hooks with `select` produce one `run()` call per match. These calls are independent (different entities, different touch files) and run in parallel with a configurable concurrency limit. Default concurrency: 5 (conservative for Claude headless rate limits).

### jiti loading

Same lazy `jiti` instance as the TS template engine. Hook files are loaded once per generation run (not per match). The class is instantiated once and `run()` is called per match.

## Scope

### In scope
- `postGenerate` array in generator.json
- `PostGenerateHook` base class and `HookContext` type in `clay-generator/types`
- TS hooks via `run` field (jiti loading, shape enforcement)
- Shell command hooks via `runCommand` field
- `select` for per-item execution
- `onlyNewTouchFiles` flag
- Touch file tracking through the pipeline
- Parallel execution with concurrency limit
- Warning-only failure handling
- Skipped when model is skipped (input hash)
- Type definitions and Zod schema
- Generator JSON schema update

### Out of scope (follow-up)
- Hook-level timeout configuration
- Hook result aggregation / reporting to governing process
- MCP tool for running hooks independently
- Watch mode integration
- Hook dependencies (run hook B only after hook A completes)
