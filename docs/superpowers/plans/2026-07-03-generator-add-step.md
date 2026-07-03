# clay_generator_add_step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a capability to append a `generate` step (Handlebars/EJS/TS engine) to an existing Clay generator, writing an engine-idiomatic template stub, exposed as the MCP tool `clay_generator_add_step`.

**Architecture:** Core function `addGeneratorStep()` in `src/` owns `generator.json` mutation and stub-writing (single source of truth); engine stubs live in `src/generator-stubs.ts`; a thin MCP tool wraps the core via a new `clay-generator/generator-authoring` package export (same mechanism the other mcp tools use).

**Tech Stack:** TypeScript, Node `fs`/`path`, mocha + chai (`expect`), ts-node/register; mcp subproject is ESM importing core (CJS) by package specifier.

## Global Constraints

- Target release: **0.3.3** (already set in `package.json`).
- Reuse existing types/helpers — do NOT duplicate: `GeneratorStepGenerate` from `src/types/generator.ts`; the package-exports mechanism (`clay-generator/*`).
- Step objects MUST write `engine` explicitly for every engine, including `handlebars`.
- An existing template file MUST NOT be overwritten unless `overwrite: true`.
- Tests run under the root mocha config (fixed spec glob `test/**/*.test.ts`); run a subset with `npx mocha --grep "<pattern>"`. Typecheck with `npx tsc --noEmit` (exit 0).
- The mcp subproject imports core with `require('clay-generator/<subpath>')` via `createRequire(import.meta.url)` — mirror `mcp/tools/generate.ts`.

---

### Task 1: Engine stubs (`src/generator-stubs.ts`)

**Files:**
- Create: `src/generator-stubs.ts`
- Test: `test/generator-stubs.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type StepEngine = 'handlebars' | 'ejs' | 'ts'`
  - `function stubForEngine(engine: StepEngine): string` — returns immediately-renderable starter content for that engine.

- [ ] **Step 1: Write the failing test**

```ts
// test/generator-stubs.test.ts
import { expect } from 'chai';
import { stubForEngine } from '../src/generator-stubs';

describe('generator engine stubs', () => {
  it('handlebars stub uses handlebars syntax and clay_key', () => {
    const s = stubForEngine('handlebars');
    expect(s).to.be.a('string').and.have.length.greaterThan(0);
    expect(s).to.include('{{clay_key}}');
  });

  it('ejs stub uses ejs syntax and clay_key', () => {
    const s = stubForEngine('ejs');
    expect(s).to.include('<%= clay_key %>');
  });

  it('ts stub exports a default class extending CodeGenerator with render()', () => {
    const s = stubForEngine('ts');
    expect(s).to.include("from 'clay-generator/types'");
    expect(s).to.include('export default class');
    expect(s).to.include('extends CodeGenerator');
    expect(s).to.match(/render\s*\(/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx mocha --grep "generator engine stubs"`
Expected: FAIL — `Cannot find module '../src/generator-stubs'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/generator-stubs.ts
/**
 * Engine-idiomatic starter content for a newly added `generate` step.
 * Each stub is minimal but immediately renderable and demonstrates the
 * engine's syntax plus a Clay context variable (clay_key).
 */
export type StepEngine = 'handlebars' | 'ejs' | 'ts';

const HANDLEBARS_STUB = `{{! Handlebars template. Context vars include clay_key and clay_parent. }}
// Generated for {{clay_key}}
`;

const EJS_STUB = `<%# EJS template. Context vars include clay_key and clay_parent. %>
// Generated for <%= clay_key %>
`;

const TS_STUB = `import { CodeGenerator } from 'clay-generator/types';
import type { RenderContext } from 'clay-generator/types';

/**
 * Programmatic generator step. Return the file content as a string.
 * \`context.data\` holds the selected model node (with clay_key, clay_parent, ...).
 */
export default class extends CodeGenerator {
  render({ data }: RenderContext): string {
    return \`// Generated for \${data.clay_key}\\n\`;
  }
}
`;

export function stubForEngine(engine: StepEngine): string {
  switch (engine) {
    case 'handlebars':
      return HANDLEBARS_STUB;
    case 'ejs':
      return EJS_STUB;
    case 'ts':
      return TS_STUB;
    default: {
      const _exhaustive: never = engine;
      throw new Error(`Unknown engine: ${String(_exhaustive)}`);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx mocha --grep "generator engine stubs"`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add src/generator-stubs.ts test/generator-stubs.test.ts
git commit -m "feat: engine-idiomatic template stubs for generator steps"
```

---

### Task 2: Core `addGeneratorStep()` (`src/generator-authoring.ts`)

**Files:**
- Create: `src/generator-authoring.ts`
- Test: `test/generator-authoring.test.ts`

**Interfaces:**
- Consumes: `stubForEngine`, `StepEngine` from Task 1; `GeneratorStepGenerate` from `src/types/generator.ts`; `validateGeneratorsPreflight` from `src/pipeline/preflight` (test only).
- Produces:
  - `class GeneratorAuthoringError extends Error`
  - `interface AddStepOptions { generatorName: string; cwd?: string; engine: StepEngine; template: string; select?: string; target?: string; touch?: boolean; content?: string; overwrite?: boolean; }`
  - `function addGeneratorStep(opts: AddStepOptions): { generatorJsonPath: string; templatePath: string; step: GeneratorStepGenerate; created: boolean }`

- [ ] **Step 1: Write the failing tests**

```ts
// test/generator-authoring.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  addGeneratorStep,
  GeneratorAuthoringError,
} from '../src/generator-authoring';
import { validateGeneratorsPreflight } from '../src/pipeline/preflight';
import type { ModelIndex } from '../src/types/clay-file';

describe('addGeneratorStep', () => {
  let tmp: string;
  let cwd: string;

  beforeEach(() => {
    cwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-authoring-'));
    process.chdir(tmp);
  });
  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  /** Create clay/generators/<name>/generator.json with the given steps. */
  function makeGenerator(name: string, steps: any[] = []): void {
    const dir = path.join(tmp, 'clay', 'generators', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'generator.json'),
      JSON.stringify({ partials: [], formatters: [], steps }, null, 2)
    );
  }

  function readGenerator(name: string): any {
    return JSON.parse(
      fs.readFileSync(
        path.join(tmp, 'clay', 'generators', name, 'generator.json'),
        'utf8'
      )
    );
  }

  it('appends a handlebars step and writes the stub', () => {
    makeGenerator('api');
    const res = addGeneratorStep({
      generatorName: 'api',
      engine: 'handlebars',
      template: 'entity.ts.hbs',
      select: '$.types[*]',
    });

    expect(res.created).to.equal(true);
    expect(fs.existsSync(res.templatePath)).to.equal(true);
    const gen = readGenerator('api');
    expect(gen.steps).to.have.length(1);
    expect(gen.steps[0]).to.deep.include({
      generate: 'entity.ts.hbs',
      select: '$.types[*]',
      engine: 'handlebars',
    });
  });

  it('defaults select to "$" and writes engine explicitly for ts', () => {
    makeGenerator('api');
    const res = addGeneratorStep({
      generatorName: 'api',
      engine: 'ts',
      template: 'dto.ts',
    });
    expect(res.step.select).to.equal('$');
    expect(res.step.engine).to.equal('ts');
    expect(fs.readFileSync(res.templatePath, 'utf8')).to.include('extends CodeGenerator');
  });

  it('produces a generator that passes pre-flight validation', () => {
    makeGenerator('api');
    addGeneratorStep({ generatorName: 'api', engine: 'ejs', template: 'x.ejs' });
    const model = {
      path: path.join('clay', 'model.clay.json'),
      load: () => ({ generators: ['api'] }),
    } as unknown as ModelIndex;
    fs.mkdirSync(path.join(tmp, 'clay'), { recursive: true });
    expect(() => validateGeneratorsPreflight([model])).to.not.throw();
  });

  it('throws when the generator does not exist', () => {
    expect(() =>
      addGeneratorStep({ generatorName: 'missing', engine: 'ts', template: 'a.ts' })
    ).to.throw(GeneratorAuthoringError, /not found/i);
  });

  it('throws when the template already exists without overwrite', () => {
    makeGenerator('api');
    const dir = path.join(tmp, 'clay', 'generators', 'api');
    fs.writeFileSync(path.join(dir, 'dup.hbs'), 'existing');
    expect(() =>
      addGeneratorStep({ generatorName: 'api', engine: 'handlebars', template: 'dup.hbs' })
    ).to.throw(GeneratorAuthoringError, /already exists/i);
  });

  it('overwrites when overwrite is true', () => {
    makeGenerator('api');
    const dir = path.join(tmp, 'clay', 'generators', 'api');
    fs.writeFileSync(path.join(dir, 'dup.hbs'), 'existing');
    const res = addGeneratorStep({
      generatorName: 'api', engine: 'handlebars', template: 'dup.hbs', overwrite: true,
    });
    expect(res.created).to.equal(true);
    expect(fs.readFileSync(res.templatePath, 'utf8')).to.include('{{clay_key}}');
  });

  it('throws on a duplicate step (same generate)', () => {
    makeGenerator('api', [{ generate: 'a.hbs', select: '$', engine: 'handlebars' }]);
    const dir = path.join(tmp, 'clay', 'generators', 'api');
    fs.writeFileSync(path.join(dir, 'a.hbs'), 'x');
    expect(() =>
      addGeneratorStep({ generatorName: 'api', engine: 'handlebars', template: 'a.hbs', overwrite: true })
    ).to.throw(GeneratorAuthoringError, /already has a step/i);
  });

  it('throws when generator.json is unparseable', () => {
    const dir = path.join(tmp, 'clay', 'generators', 'api');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'generator.json'), '{ not valid json');
    expect(() =>
      addGeneratorStep({ generatorName: 'api', engine: 'ts', template: 'a.ts' })
    ).to.throw(GeneratorAuthoringError, /could not be parsed/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx mocha --grep "addGeneratorStep"`
Expected: FAIL — `Cannot find module '../src/generator-authoring'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/generator-authoring.ts
/**
 * Generator authoring: append a `generate` step to an existing generator and
 * write an engine-idiomatic template stub. Single source of truth for
 * generator.json mutation (used by the MCP tool, and reusable by a CLI later).
 */
import fs from 'fs';
import path from 'path';
import { stubForEngine, type StepEngine } from './generator-stubs';
import type { GeneratorStepGenerate } from './types/generator';

/** Thrown for all add-step failures so callers can present a clean message. */
export class GeneratorAuthoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeneratorAuthoringError';
  }
}

export interface AddStepOptions {
  generatorName: string;
  cwd?: string;
  engine: StepEngine;
  template: string;
  select?: string;
  target?: string;
  touch?: boolean;
  content?: string;
  overwrite?: boolean;
}

/**
 * Candidate locations for a generator, anchored to `cwd`. Mirrors the canonical
 * locations used by generation (see src/generator-resolver.ts).
 */
function candidatePaths(name: string, cwd: string): string[] {
  return [
    path.join(cwd, `${name}.json`),
    path.join(cwd, name, 'generator.json'),
    path.join(cwd, 'clay', 'generators', name, 'generator.json'),
    path.join(cwd, name), // directory containing generator.json
  ];
}

/** Resolve to the generator.json path, or null if none exists. */
function resolveGeneratorJson(name: string, cwd: string): string | null {
  for (const candidate of candidatePaths(name, cwd)) {
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) {
      const inner = path.join(candidate, 'generator.json');
      if (fs.existsSync(inner)) return inner;
      continue;
    }
    return candidate;
  }
  return null;
}

export function addGeneratorStep(opts: AddStepOptions): {
  generatorJsonPath: string;
  templatePath: string;
  step: GeneratorStepGenerate;
  created: boolean;
} {
  const cwd = opts.cwd ?? process.cwd();
  const select = opts.select ?? '$';

  const generatorJsonPath = resolveGeneratorJson(opts.generatorName, cwd);
  if (!generatorJsonPath) {
    const searched = candidatePaths(opts.generatorName, cwd).join(', ');
    throw new GeneratorAuthoringError(
      `Generator "${opts.generatorName}" not found. Searched: ${searched}. ` +
        `Create it first with clay_init({ type: 'generator', name: '${opts.generatorName}' }).`
    );
  }

  let config: { steps?: unknown };
  try {
    config = JSON.parse(fs.readFileSync(generatorJsonPath, 'utf8'));
  } catch (e) {
    throw new GeneratorAuthoringError(
      `Generator config could not be parsed (${generatorJsonPath}): ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }

  const steps: any[] = Array.isArray(config.steps) ? config.steps : [];
  if (steps.some((s) => s && s.generate === opts.template)) {
    throw new GeneratorAuthoringError(
      `Generator "${opts.generatorName}" already has a step generating "${opts.template}".`
    );
  }

  const generatorDir = path.dirname(generatorJsonPath);
  const templatePath = path.join(generatorDir, opts.template);
  if (fs.existsSync(templatePath) && !opts.overwrite) {
    throw new GeneratorAuthoringError(
      `Template "${opts.template}" already exists at ${templatePath}. ` +
        `Pass overwrite: true to replace it.`
    );
  }

  const body = opts.content ?? stubForEngine(opts.engine);
  fs.mkdirSync(path.dirname(templatePath), { recursive: true });
  fs.writeFileSync(templatePath, body);

  const step: GeneratorStepGenerate = {
    generate: opts.template,
    select,
    engine: opts.engine,
    ...(opts.target !== undefined ? { target: opts.target } : {}),
    ...(opts.touch !== undefined ? { touch: opts.touch } : {}),
  };

  const updated = { ...config, steps: [...steps, step] };
  fs.writeFileSync(generatorJsonPath, `${JSON.stringify(updated, null, 2)}\n`);

  return { generatorJsonPath, templatePath, step, created: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx mocha --grep "addGeneratorStep"`
Expected: PASS (8 passing).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/generator-authoring.ts test/generator-authoring.test.ts
git commit -m "feat: addGeneratorStep core (generator.json mutation + stub)"
```

---

### Task 3: Expose `clay-generator/generator-authoring` package export

**Files:**
- Modify: `package.json` (the `exports` map)

**Interfaces:**
- Consumes: the built `dist/src/generator-authoring.js` (from Task 2, after build).
- Produces: the subpath `clay-generator/generator-authoring` resolvable from the mcp subproject.

- [ ] **Step 1: Add the export**

Edit `package.json` `exports` to add the new subpath alongside the existing ones:

```json
    "./generate-api": "./dist/src/generate-api.js",
    "./generator-authoring": "./dist/src/generator-authoring.js"
```

(Add the `./generator-authoring` line; keep the existing `./conventions`, `./model`, `./generate-api`, `./types`, `.` entries.)

- [ ] **Step 2: Build core so dist exists**

Run: `npx tsc`
Expected: exit 0; `dist/src/generator-authoring.js` exists.

- [ ] **Step 3: Verify the subpath resolves from the mcp tree**

Run:
```bash
node -e "const {createRequire}=require('module'); const r=createRequire('$PWD/mcp/shared/x.ts'); console.log(typeof r('clay-generator/generator-authoring').addGeneratorStep)"
```
Expected: prints `function`.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "feat: export clay-generator/generator-authoring subpath"
```

---

### Task 4: MCP tool `clay_generator_add_step`

**Files:**
- Modify: `mcp/shared/schemas.ts` (add `GeneratorAddStepInputSchema`)
- Create: `mcp/tools/generator-add-step.ts`
- Modify: `mcp/index.ts` (ListTools entry with descriptions + CallTool switch case)
- Test: add a case to `test/mcp-integration.test.ts`

**Interfaces:**
- Consumes: `addGeneratorStep` via `require('clay-generator/generator-authoring')`; `validateInput` from `mcp/shared/validation.js`; `getWorkspaceContext` from `mcp/shared/workspace-manager.js`.
- Produces: tool `clay_generator_add_step` returning `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`.

- [ ] **Step 1: Add the zod input schema**

Append to `mcp/shared/schemas.ts`:

```ts
export const GeneratorAddStepInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    generator_name: z
      .string()
      .describe(
        'Name of the EXISTING generator to add the step to (e.g. "typescript-api"). ' +
          'Resolved like generation resolves generators (e.g. clay/generators/<name>/generator.json). ' +
          'Create it first with clay_init if it does not exist.'
      ),
    engine: z
      .enum(['handlebars', 'ejs', 'ts'])
      .describe(
        'Template engine for this step. handlebars (.hbs, {{...}}), ejs (<%= %>), ' +
          'or ts (a TypeScript class extending CodeGenerator). Determines the starter content written.'
      ),
    template: z
      .string()
      .describe(
        'Filename (relative to the generator directory) for the template this step renders, ' +
          'e.g. "entity.ts.hbs". Created with an engine-idiomatic starter unless content is provided.'
      ),
    select: z
      .string()
      .optional()
      .describe(
        'JSONPath selecting which model nodes this step runs for. Default "$" (whole model, one output); ' +
          '"$.types[*]" runs once per type.'
      ),
    target: z
      .string()
      .optional()
      .describe(
        'Output path/pattern for generated files; may use Clay context vars like {{clay_key}}. ' +
          'Omit to use Clay default targeting.'
      ),
    touch: z
      .boolean()
      .optional()
      .describe('If true, only create output files that do not already exist (never overwrite generated output).'),
    content: z
      .string()
      .optional()
      .describe('Full template body to write instead of the engine-idiomatic starter.'),
    overwrite: z
      .boolean()
      .optional()
      .describe('If the template file already exists, set true to overwrite it; otherwise the tool errors.'),
  })
  .describe(
    'Add a generate step (with a chosen engine) to an existing Clay generator and write its template stub.'
  );
```

- [ ] **Step 2: Create the tool**

```ts
// mcp/tools/generator-add-step.ts
/**
 * clay_generator_add_step tool - append a `generate` step to an existing
 * generator and write an engine-idiomatic template stub.
 */
import { createRequire } from 'node:module';
import { validateInput } from '../shared/validation.js';
import { GeneratorAddStepInputSchema } from '../shared/schemas.js';
import { getWorkspaceContext } from '../shared/workspace-manager.js';

const require = createRequire(import.meta.url);

export async function generatorAddStepTool(args: unknown) {
  const validation = validateInput(GeneratorAddStepInputSchema, args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: validation.error }, null, 2) }],
    };
  }
  const input = validation.data;

  try {
    const context = getWorkspaceContext(input.working_directory);
    const { addGeneratorStep } = require('clay-generator/generator-authoring');

    const result = addGeneratorStep({
      generatorName: input.generator_name,
      cwd: context.workingDirectory,
      engine: input.engine,
      template: input.template,
      select: input.select,
      target: input.target,
      touch: input.touch,
      content: input.content,
      overwrite: input.overwrite,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Added ${input.engine} step to generator "${input.generator_name}"`,
              generator_json: result.generatorJsonPath,
              template_file: result.templatePath,
              step: result.step,
              next_steps: [
                `Edit the template at ${result.templatePath}`,
                'Run clay_generate to produce output',
              ],
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (e) {
    return {
      content: [
        { type: 'text', text: JSON.stringify({ success: false, message: e instanceof Error ? e.message : String(e) }, null, 2) },
      ],
    };
  }
}
```

- [ ] **Step 3: Register in `mcp/index.ts`**

Add to the ListTools array (follow the existing entries' shape), with per-parameter descriptions:

```ts
{
  name: 'clay_generator_add_step',
  description:
    'Add a new file-generating step to an EXISTING Clay generator. Each step renders files from a ' +
    'template using one of Clay\'s engines (handlebars, ejs, or a TypeScript CodeGenerator class). ' +
    'Writes an engine-idiomatic starter template into the generator directory and appends the step to ' +
    'generator.json, leaving the generator immediately runnable. Use AFTER creating a generator with ' +
    'clay_init; do NOT use it to create a generator (use clay_init) or to run generation (use clay_generate). ' +
    'Call once per step; call repeatedly to build a multi-step generator.',
  inputSchema: {
    type: 'object',
    properties: {
      working_directory: { type: 'string', description: 'Directory containing .clay (defaults to current working directory)' },
      generator_name: { type: 'string', description: 'Name of the existing generator (e.g. "typescript-api"). Create it first with clay_init.' },
      engine: { type: 'string', enum: ['handlebars', 'ejs', 'ts'], description: 'Template engine: handlebars ({{...}}), ejs (<%= %>), or ts (class extending CodeGenerator).' },
      template: { type: 'string', description: 'Template filename relative to the generator dir, e.g. "entity.ts.hbs".' },
      select: { type: 'string', description: 'JSONPath of model nodes to run for. Default "$"; "$.types[*]" runs once per type.' },
      target: { type: 'string', description: 'Output path/pattern; may use Clay context vars like {{clay_key}}.' },
      touch: { type: 'boolean', description: 'If true, only create output files that do not exist yet.' },
      content: { type: 'string', description: 'Full template body instead of the engine-idiomatic starter.' },
      overwrite: { type: 'boolean', description: 'Overwrite the template file if it already exists.' },
    },
    required: ['generator_name', 'engine', 'template'],
  },
},
```

Add the import near the other tool imports:

```ts
import { generatorAddStepTool } from './tools/generator-add-step.js';
```

Add the dispatch case in the CallTool `switch` (alongside the other `case` lines):

```ts
case 'clay_generator_add_step':
  return await generatorAddStepTool(args);
```

- [ ] **Step 4: Build the mcp subproject**

Run: `cd mcp && npm run build && cd ..`
Expected: exit 0.

- [ ] **Step 5: Add an integration test**

Open `test/mcp-integration.test.ts`, read how an existing tool-call test sends a request (the file has a helper that starts the server and issues a `tools/call` request — mirror the sibling `clay_init` / `clay_list_generators` test exactly). Add:

```ts
it('clay_generator_add_step adds a step and writes the stub', async () => {
  // Arrange: create a generator skeleton in the test workspace (mirror how
  // sibling tests set up their fixture dir), e.g. clay/generators/api/generator.json
  // with { "partials": [], "formatters": [], "steps": [] }.

  // Act: call the tool via the file's existing request helper:
  //   clay_generator_add_step({ working_directory: <dir>, generator_name: 'api',
  //     engine: 'handlebars', template: 'entity.hbs', select: '$.types[*]' })

  // Assert:
  //   - response JSON has success === true
  //   - <dir>/clay/generators/api/entity.hbs exists
  //   - generator.json steps now contains { generate: 'entity.hbs', engine: 'handlebars', select: '$.types[*]' }
});
```

Fill the Arrange/Act/Assert with the file's actual helper calls and `expect(...)` assertions (do not leave the comments — replace them with real code matching the sibling tests).

- [ ] **Step 6: Run the integration test**

Run: `npx mocha --grep "clay_generator_add_step"`
Expected: PASS. If it times out, re-run in isolation to rule out the known full-suite flakiness.

- [ ] **Step 7: Full verification**

Run: `npx tsc --noEmit` (exit 0), then `npm test`.
Expected: all pass (known-flaky `MCP Server Integration` / `config command > should set gitattributes to false` may time out under load — re-run any failure in isolation to confirm it passes).

- [ ] **Step 8: Commit**

```bash
git add mcp/shared/schemas.ts mcp/tools/generator-add-step.ts mcp/index.ts test/mcp-integration.test.ts
git commit -m "feat: clay_generator_add_step MCP tool"
```

---

## Self-Review

**Spec coverage:**
- Core `addGeneratorStep` + single source of truth → Task 2. ✓
- Engine-idiomatic stubs (hbs/ejs/ts) → Task 1. ✓
- MCP tool with clear when-to-use + parameter descriptions → Task 4 (Steps 1 & 3). ✓
- New package export → Task 3. ✓
- Error handling (not found, parse error, existing template, duplicate, invalid engine) → Task 2 tests + Step 3; invalid engine via zod enum in Task 4. ✓
- Pre-flight synergy → Task 2 test ("passes pre-flight validation"). ✓
- Scope guards (generate-only, one step per call, explicit engine, error-on-existing) → encoded in Task 2 implementation + Global Constraints. ✓

**Placeholder scan:** Task 4 Step 5 intentionally defers to the existing integration harness idiom (with concrete assertions specified) because the request-helper is file-local; the implementer replaces the A/A/A comments with the sibling tests' actual helper calls. All other steps contain complete code.

**Type consistency:** `StepEngine`, `stubForEngine`, `AddStepOptions`, `addGeneratorStep`, `GeneratorAuthoringError`, and `GeneratorStepGenerate` field names (`generate`, `select`, `engine`, `target`, `touch`) are consistent across Tasks 1, 2, and 4.
