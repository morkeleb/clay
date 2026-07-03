# Design: `clay_generator_add_step` MCP tool + core add-step capability

Date: 2026-07-03
Status: Approved (brainstorming) — pending spec review
Target release: 0.3.3

## Problem

`clay_init({ type: 'generator', name })` already scaffolds a generator skeleton
(`clay/generators/<name>/generator.json` + directory), but there is no way to
**add generation steps** to a generator. Authoring a step today means editing
`generator.json` by hand and manually creating a template file in the correct
engine syntax. This is error-prone (wrong path, wrong engine syntax, step that
references a non-existent template — which now fails pre-flight validation) and
is a natural fit for an MCP tool.

## Goal

Add a capability to append a `generate` step to an existing generator, choosing
the template engine (Handlebars, EJS, or TypeScript), and writing an
engine-idiomatic starter template file so the generator is immediately runnable.

## Scope

In scope:
- A core function `addGeneratorStep()` that mutates `generator.json` and writes
  the template stub. Single source of truth.
- Engine-idiomatic template stubs for `handlebars`, `ejs`, `ts`.
- An MCP tool `clay_generator_add_step` that wraps the core function, with a
  clear "when to use" description and clear per-parameter documentation.
- A new `clay-generator/generator-authoring` subpath export so the mcp
  subproject imports the core function as a package (consistent with the
  hardened package-exports architecture).

Out of scope (deliberate YAGNI):
- `copy` and `runCommand` steps — `generate` steps only for now.
- Batch/multiple steps per call — one step per call, callable repeatedly.
- Creating the generator itself — that stays `clay_init`'s job; this tool
  composes with it.

## Architecture (Approach B: core capability + thin MCP wrapper)

Chosen over an MCP-only tool so that `generator.json` schema knowledge and the
engine stub templates live in `src/` (one source of truth, reusable by a future
CLI command, and the stubs sit beside the engines that render them) rather than
being re-encoded inside the mcp subproject where they could drift.

### Components

- `src/generator-authoring.ts` (new) — `addGeneratorStep()`.
- `src/generator-stubs.ts` (new) — engine-idiomatic starter content, keyed by
  engine. Lives beside the engine code so stub syntax stays in sync.
- `mcp/tools/generator-add-step.ts` (new) — MCP tool; validates input (zod),
  calls the core function via `require('clay-generator/generator-authoring')`,
  formats the result/errors like the other tools.
- `mcp/index.ts` — register the tool (name, description, input schema, handler).
- root `package.json` `exports` — add `"./generator-authoring": "./dist/src/generator-authoring.js"`.

### Core API

```ts
interface AddStepOptions {
  generatorName: string;              // resolved via src/generator-resolver.ts
  cwd?: string;                       // root to resolve clay/generators from (default: process.cwd())
  engine: 'handlebars' | 'ejs' | 'ts';
  template: string;                   // the step.generate filename, e.g. 'entity.ts.hbs'
  select?: string;                    // JSONPath, default '$'
  target?: string;
  touch?: boolean;
  content?: string;                   // optional override; default = engine stub
  overwrite?: boolean;                // guard clobbering an existing template file
}

function addGeneratorStep(opts: AddStepOptions): {
  generatorJsonPath: string;
  templatePath: string;
  step: GeneratorStepGenerate;
  created: boolean;                   // whether a new template file was written
};
```

### Flow

1. Resolve the generator directory using the shared `generator-resolver.ts`
   (same candidate-path logic generation uses). Require an existing
   `generator.json`.
2. Read and JSON-parse `generator.json` into an object.
3. Compute `templatePath = path.join(generatorDir, template)`.
4. If `templatePath` exists and `overwrite` is not set → error. Otherwise write
   the stub: `content` if provided, else the engine-idiomatic starter.
5. Append the step object to `steps`:
   `{ generate: template, select, engine, ...(target ? {target} : {}), ...(touch ? {touch} : {}) }`.
   `engine` is written **explicitly even for handlebars**, so `generator.json`
   is unambiguous about which engine each step uses.
6. Write `generator.json` back with 2-space indentation and a trailing newline.
7. Return `{ generatorJsonPath, templatePath, step, created }`.

### Engine stubs (`src/generator-stubs.ts`)

Minimal but **immediately-renderable** starters using Clay context variables
(`clay_key`, `clay_parent`):

- `handlebars`: uses `{{clay_key}}` and a `{{#each}}` block; comment header.
- `ejs`: uses `<%= clay_key %>` and an iteration example.
- `ts`: a `default class extends CodeGenerator` with a `render()` method,
  grounded in the real `CodeGenerator` contract in `src/code-generator.ts` and
  the loading path in `src/pipeline/engines.ts` (must export default class with
  `render()`). The stub imports `CodeGenerator` from `clay-generator/types`
  (existing export).

The exact stub bodies will be finalized during implementation against the real
context-variable names and `CodeGenerator` signature; they must compile/parse.

## MCP tool: descriptions and parameters

The tool's usefulness to an LLM depends entirely on a precise description and
unambiguous parameter docs. Draft copy (to be refined during implementation):

**Tool name:** `clay_generator_add_step`

**Description (when to use / what it does):**
> Add a new file-generating step to an EXISTING Clay generator. Each step
> renders files from a template using one of Clay's engines (Handlebars, EJS, or
> a TypeScript generator class). The tool writes an engine-idiomatic starter
> template file into the generator's directory and appends the step to its
> `generator.json`, leaving the generator immediately runnable.
>
> Use this AFTER creating a generator with
> `clay_init({ type: 'generator', name })`. Do NOT use it to create a generator
> (use `clay_init`) or to run generation (use `clay_generate`). Call it once per
> step; call it repeatedly to build up a multi-step generator.

**Parameters** (each gets a `.describe()` on the zod schema):

- `generator_name` (string, required) — Name of the existing generator to add
  the step to (e.g. `"typescript-api"`). Resolved the same way generation
  resolves generators (e.g. `clay/generators/<name>/generator.json`). Must
  already exist — create it first with `clay_init`.
- `engine` (enum `handlebars` | `ejs` | `ts`, required) — Template engine for
  this step. `handlebars` (`.hbs`, `{{...}}`), `ejs` (`<%= %>`), or `ts` (a
  TypeScript class extending `CodeGenerator` for programmatic generation).
  Determines the starter content written to the template file.
- `template` (string, required) — Filename, relative to the generator directory,
  of the template this step renders (e.g. `"entity.ts.hbs"`). Created with an
  engine-idiomatic starter unless `content` is provided.
- `select` (string, optional, default `"$"`) — JSONPath selecting which model
  nodes this step runs for. `"$"` runs once for the whole model; `"$.types[*]"`
  runs once per type.
- `target` (string, optional) — Output path/pattern for generated files; may use
  Clay context variables (e.g. `{{clay_key}}`). Omit to use Clay's default
  targeting.
- `touch` (boolean, optional) — If true, the step only creates output files that
  don't already exist (won't overwrite generated output). Semantics verified
  against `GeneratorStepGenerate.touch`.
- `content` (string, optional) — Full template body to write instead of the
  engine-idiomatic starter. Use when you already know the template.
- `overwrite` (boolean, optional, default false) — If the template file already
  exists, set true to overwrite it; otherwise the tool errors to avoid clobbering
  existing work.
- `working_directory` (string, optional) — Directory to resolve
  `clay/generators` from; defaults to the current working directory.

The parameter descriptions above are drafts; during implementation each will be
checked against the real semantics in `src/types/generator.ts`
(`GeneratorStepGenerate`) so the docs cannot mislead.

## Error handling

Clear, actionable errors (returned as the tool's structured error result, and
thrown as typed errors from the core function):

- Generator not found → message lists the searched candidate paths and suggests
  `clay_init({ type: 'generator', name })`.
- `generator.json` cannot be parsed → message names the file and the parse error.
- Template file already exists and `overwrite` not set → message names the path
  and suggests `overwrite: true`.
- Duplicate step (a step whose `generate` already equals `template`) → error, to
  prevent accidental duplicates.
- Invalid `engine` → rejected by the zod schema before reaching the core.

## Testing (TDD)

Core (`test/generator-authoring.test.ts`):
- For each engine: step appended to `generator.json` with the correct shape;
  stub file written with engine-appropriate content; return value correct.
- **Synergy:** after `addGeneratorStep`, `validateGeneratorsPreflight` passes for
  that generator (the new step references a template that now exists).
- Error paths: missing generator, unparseable `generator.json`, existing template
  without `overwrite`, duplicate step.

Stubs (`test/generator-stubs.test.ts`):
- Each engine stub is non-empty and parses/compiles (hbs compiles, ejs compiles,
  ts parses / valid default-export class).

MCP (extend `test/mcp-integration.test.ts`):
- One test: calling `clay_generator_add_step` updates `generator.json` and
  creates the stub file; a missing generator returns the actionable error.

## Interaction with existing work

- Composes with `clay_init` (creation) and `clay_generate` (execution).
- The created step references a template that now exists on disk, so the
  pre-flight validation added in this release passes for the updated generator —
  a deliberate, tested synergy.
- Uses the hardened package-exports mechanism (`clay-generator/*`) added earlier
  in 0.3.3.

## Open decisions (resolved)

- Write `engine` explicitly for every step, including handlebars — resolved: yes.
- Error on an existing template rather than silently reusing/overwriting —
  resolved: yes (opt in via `overwrite`).
