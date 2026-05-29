# Pluggable Template Engines Design

## Problem

Handlebars is logic-less by design. Clay has pushed it far with 54+ custom helpers, but there is a ceiling. Operations like:

- Collecting unique imports across nested fields
- Filtering items by computed conditions
- Generating different structures based on complex multi-step logic
- Cross-referencing between model items with transformations

These are painful or impossible in Handlebars even with custom helpers. When a template needs real programmatic logic, users currently have two bad options: chain multiple helpers into unreadable expressions, or move the logic into mixins (which conflates model transformation with presentation).

## Approach

Add an optional `engine` field to `GeneratorStepGenerate`. When omitted, Handlebars is used (backward compatible). When set, Clay delegates rendering to the specified engine.

### Supported engines

**`handlebars`** (default) — existing behavior, no changes.

**`ejs`** — EJS templates with full JavaScript in `<%= %>` / `<% %>` blocks. Good for templates that are mostly output with some programmatic sections. Small dependency (zero transitive deps).

**`ts`** — TypeScript/JavaScript function that receives model data and returns a string. Maximum flexibility for heavily programmatic templates. No dependency — uses Node's native `import()`.

## Generator step changes

```json
{
  "generate": "templates/entity.hbs",
  "select": "$.model.types[*]",
  "target": "src/entities/{{pascalCase name}}.ts"
}
```

```json
{
  "generate": "templates/service.ejs",
  "select": "$.model.types[*]",
  "target": "src/services/{{pascalCase name}}Service.ts",
  "engine": "ejs"
}
```

```json
{
  "generate": "templates/complex-service.ts",
  "select": "$.model.types[*]",
  "target": "src/services/{{pascalCase name}}ComplexService.ts",
  "engine": "ts"
}
```

## Type changes

```typescript
// src/types/generator.ts

export interface GeneratorStepGenerate {
  generate: string;
  select: string;
  target?: string;
  touch?: boolean;
  engine?: 'handlebars' | 'ejs' | 'ts';  // new, optional, defaults to 'handlebars'
}
```

Zod schema in `src/generator.ts` adds:

```typescript
z.object({
  generate: z.string(),
  touch: z.boolean().optional(),
  select: SelectSchema,
  target: z.string().optional(),
  engine: z.enum(['handlebars', 'ejs', 'ts']).optional(),
})
```

## Render stage changes

The render stage (`src/pipeline/stages/render.ts`) is the only pipeline stage that changes. All other stages (select, hash, format, write, checksum) are engine-agnostic — they only care about the rendered string output.

```typescript
// src/pipeline/stages/render.ts

export function createRenderStage(
  onRender?: (filename: string) => void,
  onTouchSkip?: (filename: string) => void
): Stage<SelectItem, RenderedItem> {
  return async function* (input) {
    for await (const item of input) {
      const fileNameTemplate = compileTemplate(
        item.fileNamePattern,
        `filename:${item.fileNamePattern}`
      );
      const filename = path.resolve(fileNameTemplate(item.modelData));

      // Skip touch files that already exist (unchanged)
      if (item.step.touch && fs.existsSync(filename)) {
        onTouchSkip?.(filename) ?? ui.info('skipping touch file:', filename);
        continue;
      }

      const engine = item.step.engine ?? 'handlebars';
      const content = await renderWithEngine(engine, item);

      onRender?.(filename);
      yield {
        filename,
        content,
        step: item.step,
        modelIndex: item.modelIndex,
        formatters: item.formatters,
      };
    }
  };
}

async function renderWithEngine(
  engine: string,
  item: SelectItem
): Promise<string> {
  switch (engine) {
    case 'handlebars':
      return renderHandlebars(item);
    case 'ejs':
      return renderEjs(item);
    case 'ts':
      return renderTs(item);
    default:
      throw new Error(`Unknown template engine: ${engine}`);
  }
}
```

Note: the stage becomes async (yields Promises). This is already compatible with the pipeline since it uses `AsyncGenerator`.

## Engine implementations

### Handlebars (existing)

No changes. Uses `getCompiledTemplate()` from the template cache.

```typescript
function renderHandlebars(item: SelectItem): string {
  const template = getCompiledTemplate(item.templatePath);
  return template(item.modelData);
}
```

### EJS

```typescript
import ejs from 'ejs';

function renderEjs(item: SelectItem): string {
  const templateContent = getCachedFileContent(item.templatePath);
  return ejs.render(templateContent, {
    ...item.modelData,
    helpers: getHelpers(),  // Clay's casing/string/logic helpers
  }, {
    filename: item.templatePath,  // for include resolution and error messages
  });
}
```

EJS template example:

```ejs
<% const uniqueRefs = [...new Set(fields.filter(f => f.type === 'reference').map(f => f.reference))]; %>
<% uniqueRefs.forEach(ref => { %>
import { <%= helpers.pascalCase(ref) %> } from './<%= helpers.pascalCase(ref) %>';
<% }); %>

export class <%= helpers.pascalCase(name) %>Service {
<% commands.forEach(cmd => { %>
  async <%= helpers.camelCase(cmd.name) %>(): Promise<void> {
    // TODO: implement
  }
<% }); %>
}
```

### TypeScript/JavaScript — CodeGenerator base class

Clay runs as an npm-installed CLI tool, so it cannot assume the user's environment has `tsx` or `ts-node` registered. Native `import()` cannot load `.ts` files. To support TypeScript templates without requiring user environment setup, Clay uses [`jiti`](https://github.com/unjs/jiti) — a lightweight runtime TS/ESM loader (~50KB, zero config). It handles `.ts` and `.js` files transparently.

#### Base class and types

Exported via the `clay-generator/types` subpath export. Users install `clay-generator` as a devDependency and import types for compile-time safety. At runtime, Clay enforces the shape (has `render` function, accepts an argument, returns string) without relying on `instanceof` — this avoids the dual-package hazard since Clay's CLI has its own `node_modules` separate from the user's project:

```typescript
// src/code-generator.ts

export abstract class CodeGenerator {
  abstract render(context: RenderContext): string | Promise<string>;
}

export interface RenderContext {
  /** The selected model item (e.g., one entity from $.model.types[*]) */
  data: Record<string, any>;
  /** Clay helpers — pascalCase, camelCase, pluralize, etc. */
  helpers: ClayHelpers;
  /** The full root model (equivalent to clay_model in Handlebars) */
  model: Record<string, any>;
  /** Parent object in the JSON hierarchy (equivalent to clay_parent) */
  parent?: Record<string, any>;
}

export interface ClayHelpers {
  pascalCase: (str: string) => string;
  camelCase: (str: string) => string;
  kebabCase: (str: string) => string;
  snakeCase: (str: string) => string;
  constantCase: (str: string) => string;
  pluralize: (str: string) => string;
  singularize: (str: string) => string;
  // ... all other registered helpers
  [key: string]: (...args: any[]) => any;
}
```

Everything is passed via the `RenderContext` parameter to `render()` — no hidden `this.` properties. The destructured signature makes all available data visible at the call site, which is important for both developer discoverability and LLM code generation.

#### Engine implementation

```typescript
import { createJiti } from 'jiti';

const jiti = createJiti(__filename, { interopDefault: true });

async function renderTs(item: SelectItem): Promise<string> {
  const mod = await jiti.import(item.templatePath);
  const ExportedClass = (mod as any).default ?? mod;

  if (typeof ExportedClass !== 'function') {
    throw new Error(`Template ${item.templatePath} must export a default class extending CodeGenerator`);
  }

  const instance = new ExportedClass();

  // Shape-based enforcement — instanceof fails across jiti module boundaries
  // because Clay's CLI and the user's project resolve different copies
  if (typeof instance.render !== 'function') {
    throw new Error(`Template ${item.templatePath} must export a class with a render(context: RenderContext) method`);
  }
  if (instance.render.length < 1) {
    throw new Error(`Template ${item.templatePath} render() must accept a RenderContext argument`);
  }

  const result = await instance.render({
    data: item.modelData,
    helpers: getHelpers(),
    model: item.modelData.clay_model,
    parent: item.modelData.clay_parent,
  });

  if (typeof result !== 'string') {
    throw new Error(`Template ${item.templatePath} render() must return a string`);
  }
  return result;
}
```

#### Template example

```typescript
// templates/complex-service.ts
import { CodeGenerator, type RenderContext } from 'clay-generator/types';

export default class extends CodeGenerator {
  render({ data, helpers, model }: RenderContext): string {
    const { pascalCase, camelCase } = helpers;
    const { name, fields, commands } = data;

    const uniqueRefs = [...new Set(
      fields
        .filter((f: any) => f.type === 'reference')
        .map((f: any) => f.reference)
    )];

    const imports = uniqueRefs
      .map(ref => `import { ${pascalCase(ref)} } from './${pascalCase(ref)}';`)
      .join('\n');

    const methods = commands
      .map((cmd: any) => {
        const params = (cmd.parameters || [])
          .map((p: any) => `${p.name}: ${p.type}`)
          .join(', ');
        return `  async ${camelCase(cmd.name)}(${params}): Promise<void> {
    // TODO: implement
  }`;
      })
      .join('\n\n');

    return `${imports}

export class ${pascalCase(name)}Service {
${methods}
}
`;
  }
}
```

Render can also be async:

```typescript
import { CodeGenerator, type RenderContext } from 'clay-generator/types';

export default class extends CodeGenerator {
  async render({ data, helpers }: RenderContext): Promise<string> {
    // Can do async operations if needed
    return `...`;
  }
}
```

## Helper availability

All three engines receive the same set of Clay helpers (casing, pluralization, string, logic, etc.):

| Engine | How helpers are accessed |
|---|---|
| Handlebars | `{{pascalCase name}}` — registered as Handlebars helpers (existing) |
| EJS | `helpers.pascalCase(name)` — passed as `helpers` object in the template data |
| TS | `helpers.pascalCase(name)` — via `RenderContext.helpers` in the `render()` parameter |

The `getHelpers()` function returns an object with all registered helper functions, typed as `ClayHelpers`. This already exists implicitly in the Handlebars helper registration — it just needs to be exported as a plain object.

## Caching

| Engine | Caching strategy |
|---|---|
| Handlebars | Compiled template cached by file path (existing `fileTemplateCache`) |
| EJS | Raw file content cached by path (avoid re-reading disk). EJS has its own internal compilation cache. |
| TS | Module cached by jiti's internal cache. Cache-bust by clearing jiti's cache during watch mode if needed. |

## Worker thread integration

Workers currently do batch select+render as a self-contained operation. Each worker receives a `BatchRenderRequest` message, loads the model from disk, selects items via JSONPath, renders via Handlebars, and returns `{ filename, content }[]`. Results feed into hash → format → write on the main thread.

New engines fit into this architecture without changing the pipeline shape. The `BatchRenderRequest` gains an `engine` field, and the worker dispatches to the right renderer:

```typescript
// render-worker.ts additions

import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);

interface BatchRenderRequest {
  id: number;
  modelPath: string;
  jsonPath: string;
  templatePath: string;
  fileNamePattern: string;
  partials: string[];
  partialsDir: string;
  touch: boolean;
  engine?: 'handlebars' | 'ejs' | 'ts';  // new field
}

// Inside the message handler, after selecting items:
for (const item of items) {
  const filename = path.resolve(fileNameTemplate(item));
  if (msg.touch && fs.existsSync(filename)) continue;

  let content: string;
  switch (msg.engine ?? 'handlebars') {
    case 'handlebars':
      content = template(item);  // existing logic
      break;
    case 'ejs':
      content = ejs.render(templateContent, { ...item, helpers });
      break;
    case 'ts': {
      const mod = await jiti.import(msg.templatePath);
      content = await (mod as any).default(item, helpers);
      break;
    }
  }
  results.push({ filename, content });
}
```

Both `jiti` and `ejs` are pure JS — no native modules, no loader registration. They work in worker threads the same as the main thread. Each worker gets its own `jiti` instance with its own module cache, which is fine since workers already have independent caches for models and compiled templates.

**Parallelisation is unchanged.** The worker pool, round-robin dispatch, batch rendering, and post-render pipeline all work exactly as before. The only difference is what happens inside the worker's render loop — it switches on the engine field instead of always using Handlebars.

The `RenderWorkerPool.renderBatch()` signature gains an `engine` parameter that gets forwarded to the worker message. The pipeline builder in `index.ts` passes `step.engine` through.

## Dependencies

**`jiti`** — direct dependency. Required for the TS engine to load `.ts` and `.js` template files without requiring the user to set up `tsx` or `ts-node`. Lightweight (~50KB), zero config, no native modules.

**`ejs`** — direct dependency. EJS is tiny (zero transitive deps), so the cost of always installing it is negligible. The code still uses lazy `require('ejs')` with a helpful error message as a defensive measure, but in practice it is always available.

## Input hashing

No changes needed. Input hashing already collects template file paths from generator steps. A `.ejs` or `.ts` template file is tracked the same way as a `.hbs` file — if it changes, the input hash changes and regeneration runs.

## Migration

No migration needed. The `engine` field is optional and defaults to `handlebars`. All existing generators work without changes.

## Scope

### In scope
- `engine` field on `GeneratorStepGenerate`
- Handlebars (default), EJS, and TS engine implementations
- `CodeGenerator` base class and `RenderContext`/`ClayHelpers` types exported from `clay-generator`
- Helper availability in all engines
- Template caching per engine
- Worker thread support for all engines (jiti and ejs are pure JS, work in workers)
- Zod validation for the `engine` field
- Generator JSON schema update
- `jiti` as a direct dependency

### Out of scope (follow-up)
- MCP prompt updates for new engines
- Editor/preview support for new engines
- Auto-detection of engine from file extension (explicit `engine` field required)

## Estimated effort

- Type + schema changes: ~10 lines
- Render stage refactor: ~50 lines
- EJS engine: ~20 lines
- TS engine: ~20 lines
- Helper export: ~15 lines
- Tests: ~100 lines
- Total: ~215 lines
