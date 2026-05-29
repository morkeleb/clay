# Post-Generation Hooks Design

## Problem

Clay generates structural code and creates touch file skeletons, but filling in business logic is left entirely to the developer or governing AI process. When a Clay model produces many touch files (e.g., 10 service implementations), the governing Claude session must fill each one sequentially, carrying the full project context.

A better workflow: Clay's generators know what files they produce and what model data each file corresponds to. After generation, the generator can spawn focused worker processes (Claude headless instances, linters, formatters) with tight, specialized contexts — freeing the governing process to focus on architecture and quality.

## Approach

Add a `postGenerate` section to `generator.json`. These hooks run after all generate/copy/command steps complete and files are written to disk. Each hook can reference the model data via Handlebars templating. Hooks are best-effort — failures are logged as warnings, never fail the generation.

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
      "runCommand": "claude -p 'Implement {{pascalCase name}}ServiceImpl following the I{{pascalCase name}}Service interface. Entity has fields: {{#each fields}}{{name}}:{{type}} {{/each}}'",
      "select": "$.model.types[*]",
      "onlyNewTouchFiles": true
    }
  ]
}
```

## Key semantics

### When hooks run

Hooks run after **all** generator steps have completed and the `.clay` file is saved. All generated files and touch files are on disk. The hook sees the full output of the generation run.

### Hook execution

Each hook in the `postGenerate` array is processed in order. Within a hook:

- If `select` is specified, the command runs once per JSONPath match (same as generate steps)
- Handlebars templating is applied to `runCommand` with the selected model data
- Commands execute with the output directory as cwd
- Commands run in parallel across selected items (they are independent)

### Failure handling

Hooks are best-effort. A non-zero exit code:

- Logs a warning with the command and exit code
- Does **not** fail the generation (files are already written)
- Does **not** prevent subsequent hooks from running
- Is reported in the generation result for the governing process to inspect

### `onlyNewTouchFiles` flag

When `true`, the hook only runs for items where the corresponding touch file was newly created during this generation run. If the touch file already existed (and was skipped), the hook is skipped too.

This is the key flag for AI fill-in workflows — run Claude only on fresh touch files, not on files the developer has already customized.

The generator tracks which touch files were created vs skipped during the render stage. This information is passed to the post-generate phase.

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
   - For each NEW touch file, spawn `claude -p` with a focused prompt
   - Each worker Claude sees: the skeleton, the interface it must implement,
     the entity definition, and relevant surrounding code
   - Workers run in parallel
5. Governing Claude reviews the results, makes corrections
```

The focused prompt per touch file is more effective than having the governing Claude fill in everything because:

- **Smaller context** — each worker Claude only sees what's relevant to its file
- **Parallel execution** — multiple files filled in simultaneously
- **Governing Claude stays architectural** — reviews and corrects rather than implementing
- **Subscription-based** — headless Claude runs on the existing subscription

## Hook types

### Shell command (initial implementation)

```json
{
  "runCommand": "claude -p 'Implement the service for {{name}}'",
  "select": "$.model.types[*]",
  "onlyNewTouchFiles": true
}
```

Supports Handlebars templating on the command string. The selected model data is available for interpolation.

### Future: TypeScript hook (follow-up)

```json
{
  "run": "hooks/fill-service.ts",
  "select": "$.model.types[*]",
  "engine": "ts",
  "onlyNewTouchFiles": true
}
```

A CodeGenerator-style hook that receives the model data and can programmatically construct prompts, call APIs, or run complex post-processing. Same `jiti` loading as the TS template engine.

## Implementation notes

### Tracking new touch files

The render stage already skips touch files that exist on disk. To know which touch files were newly created:

- The render stage yields `RenderedItem` for touch files that don't exist yet (they go through the pipeline and get written)
- The render stage skips touch files that already exist (they don't yield)
- Track which touch files were written during this run in a Set
- Pass this Set to the post-generate phase

### Parallel execution

Hooks with `select` produce one command per match. These commands are independent (different files, different entities) and can run in parallel. Use a concurrency limit (e.g., 5) to avoid overwhelming the system — especially important for Claude headless which has rate limits.

### Variable context for prompts

The `runCommand` string gets Handlebars templating with the full model data for each selected item. This includes `clay_model` (full model), `clay_parent`, and all entity fields. The prompt can reference:

- `{{name}}` — entity name
- `{{#each fields}}` — entity fields
- `{{clay_model.name}}` — project name
- Any other model data

## Scope

### In scope
- `postGenerate` array in generator.json
- Shell command hooks with `runCommand` + `select`
- `onlyNewTouchFiles` flag
- Handlebars templating on commands
- Parallel execution with concurrency limit
- Warning-only failure handling
- Skipped when model is skipped (input hash)
- Type definitions and Zod schema
- Generator JSON schema update

### Out of scope (follow-up)
- TypeScript hook functions (reuse CodeGenerator pattern)
- Hook-level timeout configuration
- Hook result aggregation / reporting
- MCP tool for running hooks independently
- Watch mode integration (run hooks on re-generation)
