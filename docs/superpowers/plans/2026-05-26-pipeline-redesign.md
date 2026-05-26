# Generator Pipeline Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic `generator.ts` with a typed, streaming pipeline where TypeScript enforces the architecture — each stage has a typed input/output contract, stages compose via `AsyncGenerator`, and concurrency is a property of the stage, not the caller.

**Architecture:** The pipeline is a chain of typed async generator stages. A `WorkItem` enters at the top and flows through: Select → Render → Hash → Diff → Format → Write → Checksum. Each stage is a pure-ish function `(AsyncIterable<In>) => AsyncGenerator<Out>`. A `Pipeline` type composes stages and TypeScript verifies that each stage's output matches the next stage's input at compile time. Concurrency per stage is controlled by a `concurrent()` wrapper that reads from the input iterable and runs N items in parallel with backpressure.

**Tech Stack:** TypeScript strict mode (already enabled), `AsyncGenerator`/`AsyncIterable` (native ES2020, already targeted), `fs/promises` (replaces sync I/O), `child_process.exec` (replaces `execSync`)

---

## File Structure

```
src/
├── pipeline/
│   ├── types.ts            # WorkItem variants, Stage type, Pipeline composer
│   ├── concurrent.ts       # concurrent() wrapper for parallel stage execution
│   ├── stages/
│   │   ├── select.ts       # JSONPath selection → yields RenderItem per model match
│   │   ├── render.ts       # Handlebars template rendering
│   │   ├── hash.ts         # MD5 + diff against stored checksum
│   │   ├── format.ts       # Formatter chain (cached module loading)
│   │   ├── write.ts        # Async file write + checksum update
│   │   ├── copy.ts         # Async file copy with template renaming
│   │   └── command.ts      # Async shell command execution
│   ├── formatter-cache.ts  # Load-once formatter module cache
│   └── index.ts            # Pipeline factory: buildPipeline() → composed pipeline
├── generator.ts            # Refactored: thin wrapper that builds pipeline per step
└── types/
    └── generator.ts        # Existing (unchanged)
```

**Key design decision:** The pipeline types live in `src/pipeline/types.ts` and every stage must conform to the `Stage<In, Out>` type. If you wire stages incorrectly, TypeScript refuses to compile. This is the "architecture enforced by the compiler" property.

---

### Task 1: Pipeline Type System

**Files:**
- Create: `src/pipeline/types.ts`
- Test: `test/pipeline/types.test.ts`

This is the foundation. The types enforce that stages compose correctly at compile time.

- [ ] **Step 1: Write the type definition file**

```typescript
// src/pipeline/types.ts

import type { GeneratorStep, GeneratorStepGenerate } from '../types/generator';
import type { ClayModelEntry } from '../types/clay-file';

// --- Work item types that flow through the pipeline ---

/** Entry point: a model item selected via JSONPath, paired with its template */
export interface SelectItem {
  readonly modelData: unknown;
  readonly templatePath: string;
  readonly fileNamePattern: string;
  readonly outputDir: string;
  readonly step: GeneratorStepGenerate;
  readonly modelIndex: ClayModelEntry;
}

/** After rendering: has content but not yet hashed */
export interface RenderedItem {
  readonly filename: string;
  readonly content: string;
  readonly step: GeneratorStepGenerate;
  readonly modelIndex: ClayModelEntry;
}

/** After hashing + diffing: only items that changed pass through */
export interface ChangedItem {
  readonly filename: string;
  readonly content: string;
  readonly md5: string;
  readonly step: GeneratorStepGenerate;
  readonly modelIndex: ClayModelEntry;
}

/** After formatting: ready to write */
export interface FormattedItem {
  readonly filename: string;
  readonly content: string;
  readonly md5: string;
  readonly step: GeneratorStepGenerate;
  readonly modelIndex: ClayModelEntry;
}

/** After writing: confirms what was written */
export interface WrittenItem {
  readonly filename: string;
  readonly md5: string;
  readonly step: GeneratorStepGenerate;
  readonly modelIndex: ClayModelEntry;
}

// --- Stage type: the core abstraction ---

/**
 * A pipeline stage transforms an async iterable of In into an async generator of Out.
 * TypeScript enforces that Stage<A, B> can only connect to Stage<B, C>.
 */
export type Stage<In, Out> = (input: AsyncIterable<In>) => AsyncGenerator<Out>;

// --- Pipeline composer ---

/**
 * Compose two stages into one. TypeScript enforces the Mid type matches.
 */
export function compose<A, B, C>(
  first: Stage<A, B>,
  second: Stage<B, C>
): Stage<A, C> {
  return (input: AsyncIterable<A>) => second(first(input));
}

/**
 * Build a pipeline by chaining stages left-to-right.
 * Each call to .pipe() extends the chain and TypeScript verifies types match.
 */
export class PipelineBuilder<TIn, TCurrent> {
  constructor(private readonly stage: Stage<TIn, TCurrent>) {}

  pipe<TNext>(next: Stage<TCurrent, TNext>): PipelineBuilder<TIn, TNext> {
    return new PipelineBuilder(compose(this.stage, next));
  }

  build(): Stage<TIn, TCurrent> {
    return this.stage;
  }
}

export function pipeline<TIn, TOut>(
  stage: Stage<TIn, TOut>
): PipelineBuilder<TIn, TOut> {
  return new PipelineBuilder(stage);
}
```

- [ ] **Step 2: Write compile-time tests**

```typescript
// test/pipeline/types.test.ts
import { expect } from 'chai';
import {
  pipeline,
  compose,
  type Stage,
  type SelectItem,
  type RenderedItem,
  type ChangedItem,
  type FormattedItem,
  type WrittenItem,
} from '../../src/pipeline/types';

describe('pipeline types', () => {
  // Helper: a trivial stage that passes through
  function identity<T>(): Stage<T, T> {
    return async function* (input) {
      for await (const item of input) {
        yield item;
      }
    };
  }

  // Helper: convert an array to an async iterable
  async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
    for (const item of items) {
      yield item;
    }
  }

  // Helper: collect async iterable into array
  async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
    const result: T[] = [];
    for await (const item of gen) {
      result.push(item);
    }
    return result;
  }

  it('compose connects two stages', async () => {
    const double: Stage<number, number> = async function* (input) {
      for await (const n of input) yield n * 2;
    };
    const toString: Stage<number, string> = async function* (input) {
      for await (const n of input) yield String(n);
    };

    const composed = compose(double, toString);
    const result = await collect(composed(fromArray([1, 2, 3])));
    expect(result).to.deep.equal(['2', '4', '6']);
  });

  it('PipelineBuilder chains stages with type safety', async () => {
    const double: Stage<number, number> = async function* (input) {
      for await (const n of input) yield n * 2;
    };
    const toString: Stage<number, string> = async function* (input) {
      for await (const n of input) yield String(n);
    };
    const addBang: Stage<string, string> = async function* (input) {
      for await (const s of input) yield s + '!';
    };

    const built = pipeline(double).pipe(toString).pipe(addBang).build();
    const result = await collect(built(fromArray([5, 10])));
    expect(result).to.deep.equal(['10!', '20!']);
  });

  it('identity stage passes items through unchanged', async () => {
    const items = [1, 2, 3];
    const result = await collect(identity<number>()(fromArray(items)));
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it('empty input produces empty output', async () => {
    const double: Stage<number, number> = async function* (input) {
      for await (const n of input) yield n * 2;
    };
    const result = await collect(double(fromArray([])));
    expect(result).to.deep.equal([]);
  });

  it('stages can filter by not yielding', async () => {
    const evensOnly: Stage<number, number> = async function* (input) {
      for await (const n of input) {
        if (n % 2 === 0) yield n;
      }
    };
    const result = await collect(evensOnly(fromArray([1, 2, 3, 4, 5])));
    expect(result).to.deep.equal([2, 4]);
  });

  it('stages can expand (1 input → N outputs)', async () => {
    const duplicate: Stage<number, number> = async function* (input) {
      for await (const n of input) {
        yield n;
        yield n;
      }
    };
    const result = await collect(duplicate(fromArray([1, 2])));
    expect(result).to.deep.equal([1, 1, 2, 2]);
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx mocha --require ts-node/register test/pipeline/types.test.ts`
Expected: 6 passing

- [ ] **Step 4: Commit**

```bash
git add src/pipeline/types.ts test/pipeline/types.test.ts
git commit -m "feat(pipeline): add typed Stage/Pipeline composition primitives"
```

---

### Task 2: Concurrent Stage Wrapper

**Files:**
- Create: `src/pipeline/concurrent.ts`
- Test: `test/pipeline/concurrent.test.ts`

This wraps any `Stage<In, Out>` to process N items in parallel with backpressure. It's the core performance primitive — without it, stages run one item at a time.

- [ ] **Step 1: Write the failing tests**

```typescript
// test/pipeline/concurrent.test.ts
import { expect } from 'chai';
import { concurrent } from '../../src/pipeline/concurrent';
import type { Stage } from '../../src/pipeline/types';

async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of gen) result.push(item);
  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('concurrent', () => {
  it('processes items with specified concurrency', async () => {
    let maxConcurrent = 0;
    let running = 0;

    const slow: Stage<number, number> = async function* (input) {
      for await (const n of input) {
        running++;
        if (running > maxConcurrent) maxConcurrent = running;
        await delay(20);
        running--;
        yield n * 2;
      }
    };

    const parallelSlow = concurrent(slow, { concurrency: 3 });
    const result = await collect(parallelSlow(fromArray([1, 2, 3, 4, 5, 6])));

    // All items processed
    expect(result.sort()).to.deep.equal([2, 4, 6, 8, 10, 12]);
    // Concurrency was actually used (at least 2 ran at once)
    expect(maxConcurrent).to.be.greaterThan(1);
    // Did not exceed limit
    expect(maxConcurrent).to.be.at.most(3);
  });

  it('with concurrency 1 behaves like sequential', async () => {
    const order: number[] = [];
    const track: Stage<number, number> = async function* (input) {
      for await (const n of input) {
        order.push(n);
        yield n;
      }
    };

    const seq = concurrent(track, { concurrency: 1 });
    await collect(seq(fromArray([1, 2, 3])));
    expect(order).to.deep.equal([1, 2, 3]);
  });

  it('propagates errors from the inner stage', async () => {
    const failing: Stage<number, number> = async function* (input) {
      for await (const n of input) {
        if (n === 3) throw new Error('boom');
        yield n;
      }
    };

    const parallel = concurrent(failing, { concurrency: 2 });

    try {
      await collect(parallel(fromArray([1, 2, 3, 4])));
      expect.fail('should have thrown');
    } catch (e: any) {
      expect(e.message).to.equal('boom');
    }
  });

  it('handles empty input', async () => {
    const identity: Stage<number, number> = async function* (input) {
      for await (const n of input) yield n;
    };

    const parallel = concurrent(identity, { concurrency: 5 });
    const result = await collect(parallel(fromArray([])));
    expect(result).to.deep.equal([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx mocha --require ts-node/register test/pipeline/concurrent.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement concurrent wrapper**

```typescript
// src/pipeline/concurrent.ts
import type { Stage } from './types';

export interface ConcurrentOptions {
  readonly concurrency: number;
}

/**
 * Wraps a Stage to process up to N items in parallel.
 * Items are consumed from the input as slots become available (backpressure).
 * Output order is NOT guaranteed — items are yielded as they complete.
 */
export function concurrent<In, Out>(
  stage: Stage<In, Out>,
  options: ConcurrentOptions
): Stage<In, Out> {
  const { concurrency } = options;

  return async function* (input: AsyncIterable<In>): AsyncGenerator<Out> {
    // For concurrency 1, just delegate directly (preserves order)
    if (concurrency <= 1) {
      yield* stage(input);
      return;
    }

    // Buffer to collect results from parallel executions
    const results: Array<Promise<{ done: boolean; value?: Out }>> = [];
    const completed: Out[] = [];
    let inputDone = false;
    let error: Error | null = null;

    // Process each input item through its own single-item stage invocation
    const inputIterator = input[Symbol.asyncIterator]();
    const active = new Set<Promise<void>>();

    // Drain function: process one input item
    async function processOne(): Promise<{ value: Out; done: false } | { done: true }> {
      const next = await inputIterator.next();
      if (next.done) return { done: true };

      // Create a single-item async iterable
      async function* singleItem(): AsyncGenerator<In> {
        yield next.value;
      }

      // Run the stage on this single item and collect output
      const outputs: Out[] = [];
      for await (const out of stage(singleItem())) {
        outputs.push(out);
      }
      // A stage can yield 0 or more outputs per input
      for (const out of outputs) {
        completed.push(out);
      }
      return { done: false, value: undefined as unknown as Out };
    }

    // Fill the pool
    const pool: Array<Promise<void>> = [];

    async function fillPool(): Promise<void> {
      while (pool.length < concurrency) {
        const p = processOne().then((result) => {
          pool.splice(pool.indexOf(p), 1);
          if (result.done) {
            inputDone = true;
          }
        }).catch((e) => {
          error = e instanceof Error ? e : new Error(String(e));
          inputDone = true;
        });
        pool.push(p);

        // If we just kicked off the max, wait for one to finish
        if (pool.length >= concurrency) {
          await Promise.race(pool);
        }

        if (inputDone) break;
      }
    }

    // Process all input
    while (!inputDone || pool.length > 0) {
      await fillPool();
      // Wait for remaining pool to drain
      if (pool.length > 0 && inputDone) {
        await Promise.all(pool);
      }
      // Yield completed items
      while (completed.length > 0) {
        yield completed.shift()!;
      }
      if (error) throw error;
    }

    // Yield any remaining items
    while (completed.length > 0) {
      yield completed.shift()!;
    }
    if (error) throw error;
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx mocha --require ts-node/register test/pipeline/concurrent.test.ts`
Expected: 4 passing

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/concurrent.ts test/pipeline/concurrent.test.ts
git commit -m "feat(pipeline): add concurrent() wrapper for parallel stage execution"
```

---

### Task 3: Formatter Cache

**Files:**
- Create: `src/pipeline/formatter-cache.ts`
- Test: `test/pipeline/formatter-cache.test.ts`

Currently formatters are re-loaded via `resolve-global` + `require()` on every file. This cache loads them once per generate run.

- [ ] **Step 1: Write the failing test**

```typescript
// test/pipeline/formatter-cache.test.ts
import { expect } from 'chai';
import { FormatterCache, type LoadedFormatter } from '../../src/pipeline/formatter-cache';

describe('FormatterCache', () => {
  it('loads a formatter module and caches it', () => {
    let loadCount = 0;
    const cache = new FormatterCache((pkg: string) => {
      loadCount++;
      return {
        apply: (file: string, content: string) => content.toUpperCase(),
      };
    });

    const f1 = cache.get('my-formatter');
    const f2 = cache.get('my-formatter');

    expect(f1).to.equal(f2); // same reference
    expect(loadCount).to.equal(1); // loaded once
  });

  it('loads different formatters independently', () => {
    const loaded: string[] = [];
    const cache = new FormatterCache((pkg: string) => {
      loaded.push(pkg);
      return { apply: (_f: string, c: string) => c };
    });

    cache.get('fmt-a');
    cache.get('fmt-b');
    cache.get('fmt-a');

    expect(loaded).to.deep.equal(['fmt-a', 'fmt-b']);
  });

  it('clear removes all cached formatters', () => {
    let loadCount = 0;
    const cache = new FormatterCache(() => {
      loadCount++;
      return { apply: (_f: string, c: string) => c };
    });

    cache.get('fmt');
    cache.clear();
    cache.get('fmt');

    expect(loadCount).to.equal(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx mocha --require ts-node/register test/pipeline/formatter-cache.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement FormatterCache**

```typescript
// src/pipeline/formatter-cache.ts

export interface LoadedFormatter {
  extensions?: string[];
  apply: (
    fileName: string,
    content: string,
    options?: Record<string, unknown>,
    step?: unknown
  ) => string | Promise<string>;
}

export type FormatterLoader = (packageName: string) => LoadedFormatter;

/**
 * Caches loaded formatter modules so they're resolved once per generate run,
 * not once per file.
 */
export class FormatterCache {
  private readonly cache = new Map<string, LoadedFormatter>();
  private readonly loader: FormatterLoader;

  constructor(loader: FormatterLoader) {
    this.loader = loader;
  }

  get(packageName: string): LoadedFormatter {
    let formatter = this.cache.get(packageName);
    if (!formatter) {
      formatter = this.loader(packageName);
      this.cache.set(packageName, formatter);
    }
    return formatter;
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Create a FormatterCache using resolve-global + require for real formatter loading.
 */
export function createFormatterCache(): FormatterCache {
  const resolveGlobal = require('resolve-global');
  return new FormatterCache((pkg: string) => require(resolveGlobal(pkg)));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx mocha --require ts-node/register test/pipeline/formatter-cache.test.ts`
Expected: 3 passing

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/formatter-cache.ts test/pipeline/formatter-cache.test.ts
git commit -m "feat(pipeline): add FormatterCache for once-per-run module loading"
```

---

### Task 4: Pipeline Stages — Select, Render, Hash

**Files:**
- Create: `src/pipeline/stages/select.ts`
- Create: `src/pipeline/stages/render.ts`
- Create: `src/pipeline/stages/hash.ts`
- Test: `test/pipeline/stages.test.ts`

These three stages are pure transforms with no side effects.

- [ ] **Step 1: Write failing tests for all three stages**

```typescript
// test/pipeline/stages.test.ts
import { expect } from 'chai';
import path from 'path';
import { createSelectStage } from '../../src/pipeline/stages/select';
import { createRenderStage } from '../../src/pipeline/stages/render';
import { createHashStage } from '../../src/pipeline/stages/hash';
import type { SelectItem, RenderedItem } from '../../src/pipeline/types';
import type { GeneratorStepGenerate } from '../../src/types/generator';
import type { ClayModelEntry } from '../../src/types/clay-file';

async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of gen) result.push(item);
  return result;
}

const dummyStep: GeneratorStepGenerate = {
  generate: 'template.hbs',
  select: '$.entities[*]',
};

const dummyModelIndex: ClayModelEntry = {
  path: 'model.json',
  output: '',
  generated_files: {},
  setFileCheckSum: () => {},
  getFileCheckSum: () => null,
  delFileCheckSum: () => {},
  load: () => ({}),
};

describe('pipeline stages', () => {
  describe('select', () => {
    it('yields one SelectItem per JSONPath match', async () => {
      const model = { entities: [{ name: 'User' }, { name: 'Order' }] };
      const stage = createSelectStage(
        model,
        '$.entities[*]',
        'templates/entity.hbs',
        'output/{{name}}.ts',
        'src/',
        dummyStep,
        dummyModelIndex
      );

      const items = await collect(stage);
      expect(items).to.have.lengthOf(2);
      expect((items[0].modelData as any).name).to.equal('User');
      expect((items[1].modelData as any).name).to.equal('Order');
    });
  });

  describe('render', () => {
    it('renders template with model data', async () => {
      const items: SelectItem[] = [
        {
          modelData: { name: 'User' },
          templatePath: path.resolve('test/samples/templates/simple.hbs'),
          fileNamePattern: 'output/{{name}}.ts',
          outputDir: 'src/',
          step: dummyStep,
          modelIndex: dummyModelIndex,
        },
      ];

      const stage = createRenderStage();
      const results = await collect(stage(fromArray(items)));
      expect(results).to.have.lengthOf(1);
      expect(results[0].filename).to.include('User');
      expect(results[0].content).to.be.a('string');
      expect(results[0].content.length).to.be.greaterThan(0);
    });
  });

  describe('hash', () => {
    it('passes through items whose checksum has changed', async () => {
      const items: RenderedItem[] = [
        {
          filename: '/tmp/test-output/changed.ts',
          content: 'new content',
          step: dummyStep,
          modelIndex: { ...dummyModelIndex, getFileCheckSum: () => 'old-md5' },
        },
      ];

      const stage = createHashStage();
      const results = await collect(stage(fromArray(items)));
      expect(results).to.have.lengthOf(1);
      expect(results[0].md5).to.be.a('string');
    });

    it('filters out items whose checksum matches', async () => {
      const md5 = require('crypto')
        .createHash('md5')
        .update('same content')
        .digest('hex');

      const items: RenderedItem[] = [
        {
          filename: '/tmp/test-output/unchanged.ts',
          content: 'same content',
          step: dummyStep,
          modelIndex: { ...dummyModelIndex, getFileCheckSum: () => md5 },
        },
      ];

      const stage = createHashStage();
      const results = await collect(stage(fromArray(items)));
      expect(results).to.have.lengthOf(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx mocha --require ts-node/register test/pipeline/stages.test.ts`
Expected: FAIL

- [ ] **Step 3: Create a simple test template**

```bash
mkdir -p test/samples/templates
echo "export class {{name}} {}" > test/samples/templates/simple.hbs
```

- [ ] **Step 4: Implement select stage**

```typescript
// src/pipeline/stages/select.ts
import * as jph from '../../jsonpath-helper';
import type { SelectItem } from '../types';
import type { GeneratorStepGenerate } from '../../types/generator';
import type { ClayModelEntry } from '../../types/clay-file';

/**
 * Creates an async generator that yields one SelectItem per JSONPath match.
 * This is a source stage — it doesn't take input, it produces output.
 */
export function createSelectStage(
  model: unknown,
  jsonPath: string,
  templatePath: string,
  fileNamePattern: string,
  outputDir: string,
  step: GeneratorStepGenerate,
  modelIndex: ClayModelEntry
): AsyncGenerator<SelectItem> {
  const matches = jph.select(model, jsonPath);

  async function* generate(): AsyncGenerator<SelectItem> {
    for (const modelData of matches) {
      yield {
        modelData,
        templatePath,
        fileNamePattern,
        outputDir,
        step,
        modelIndex,
      };
    }
  }

  return generate();
}
```

- [ ] **Step 5: Implement render stage**

```typescript
// src/pipeline/stages/render.ts
import path from 'path';
import handlebars from '../../template-engine';
import type { Stage, SelectItem, RenderedItem } from '../types';

// Local template cache (cleared per generate run via generator.ts clearTemplateCache)
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

export function clearRenderCache(): void {
  templateCache.clear();
}

function getTemplate(filePath: string): HandlebarsTemplateDelegate {
  if (!templateCache.has(filePath)) {
    const fs = require('fs');
    const content = fs.readFileSync(filePath, 'utf8');
    templateCache.set(filePath, handlebars.compile(content));
  }
  return templateCache.get(filePath)!;
}

/**
 * Renders Handlebars template with model data.
 * Input: SelectItem (model data + template path)
 * Output: RenderedItem (filename + rendered content)
 */
export function createRenderStage(): Stage<SelectItem, RenderedItem> {
  return async function* (input) {
    for await (const item of input) {
      const template = getTemplate(item.templatePath);
      const fileNameTemplate = handlebars.compile(item.fileNamePattern);
      const filename = path.resolve(fileNameTemplate(item.modelData));
      const content = template(item.modelData);

      yield {
        filename,
        content,
        step: item.step,
        modelIndex: item.modelIndex,
      };
    }
  };
}
```

- [ ] **Step 6: Implement hash stage**

```typescript
// src/pipeline/stages/hash.ts
import crypto from 'crypto';
import type { Stage, RenderedItem, ChangedItem } from '../types';

/**
 * Computes MD5 hash and filters out items whose checksum hasn't changed.
 * Input: RenderedItem
 * Output: ChangedItem (only items that differ from stored checksum)
 */
export function createHashStage(): Stage<RenderedItem, ChangedItem> {
  return async function* (input) {
    for await (const item of input) {
      const md5 = crypto.createHash('md5').update(item.content).digest('hex');
      const storedChecksum = item.modelIndex.getFileCheckSum(item.filename);

      if (storedChecksum !== md5) {
        yield {
          filename: item.filename,
          content: item.content,
          md5,
          step: item.step,
          modelIndex: item.modelIndex,
        };
      }
    }
  };
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx mocha --require ts-node/register test/pipeline/stages.test.ts`
Expected: 4 passing

- [ ] **Step 8: Commit**

```bash
git add src/pipeline/stages/ test/pipeline/stages.test.ts test/samples/templates/simple.hbs
git commit -m "feat(pipeline): add select, render, and hash stages"
```

---

### Task 5: Pipeline Stages — Format and Write

**Files:**
- Create: `src/pipeline/stages/format.ts`
- Create: `src/pipeline/stages/write.ts`
- Test: `test/pipeline/format-write.test.ts`

These stages have side effects: format calls external modules, write touches the filesystem.

- [ ] **Step 1: Write failing tests**

```typescript
// test/pipeline/format-write.test.ts
import { expect } from 'chai';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { createFormatStage } from '../../src/pipeline/stages/format';
import { createWriteStage } from '../../src/pipeline/stages/write';
import { FormatterCache } from '../../src/pipeline/formatter-cache';
import type { ChangedItem, FormattedItem } from '../../src/pipeline/types';
import type { GeneratorStepGenerate } from '../../src/types/generator';
import type { ClayModelEntry } from '../../src/types/clay-file';

async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of gen) result.push(item);
  return result;
}

const dummyStep: GeneratorStepGenerate = {
  generate: 'template.hbs',
  select: '$.entities[*]',
};

describe('format stage', () => {
  it('passes content through formatters', async () => {
    const cache = new FormatterCache(() => ({
      apply: (_file: string, content: string) => content.toUpperCase(),
    }));

    const generator = { steps: [], partials: [], formatters: ['my-formatter'] };
    const modelIndex: ClayModelEntry = {
      path: 'model.json',
      generated_files: {},
      setFileCheckSum: () => {},
      getFileCheckSum: () => null,
      delFileCheckSum: () => {},
      load: () => ({}),
    };

    const items: ChangedItem[] = [
      {
        filename: '/tmp/test.ts',
        content: 'hello world',
        md5: 'abc',
        step: dummyStep,
        modelIndex,
      },
    ];

    const stage = createFormatStage(generator, cache);
    const results = await collect(stage(fromArray(items)));
    expect(results[0].content).to.equal('HELLO WORLD');
  });

  it('passes through unchanged when no formatters', async () => {
    const cache = new FormatterCache(() => ({ apply: (_f: string, c: string) => c }));
    const generator = { steps: [], partials: [], formatters: [] };
    const modelIndex: ClayModelEntry = {
      path: 'model.json',
      generated_files: {},
      setFileCheckSum: () => {},
      getFileCheckSum: () => null,
      delFileCheckSum: () => {},
      load: () => ({}),
    };

    const items: ChangedItem[] = [
      { filename: '/tmp/test.ts', content: 'hello', md5: 'abc', step: dummyStep, modelIndex },
    ];

    const stage = createFormatStage(generator, cache);
    const results = await collect(stage(fromArray(items)));
    expect(results[0].content).to.equal('hello');
  });
});

describe('write stage', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-write-'));
  });

  afterEach(() => {
    fs.removeSync(testDir);
  });

  it('writes file to disk and updates checksum', async () => {
    let checksumFile = '';
    let checksumMd5 = '';

    const modelIndex: ClayModelEntry = {
      path: 'model.json',
      generated_files: {},
      setFileCheckSum: (f: string, md5: string) => {
        checksumFile = f;
        checksumMd5 = md5;
      },
      getFileCheckSum: () => null,
      delFileCheckSum: () => {},
      load: () => ({}),
    };

    const filename = path.join(testDir, 'output', 'test.ts');
    const items: FormattedItem[] = [
      { filename, content: 'generated code', md5: 'abc123', step: dummyStep, modelIndex },
    ];

    const stage = createWriteStage();
    const results = await collect(stage(fromArray(items)));

    expect(results).to.have.lengthOf(1);
    expect(results[0].filename).to.equal(filename);
    expect(fs.readFileSync(filename, 'utf8')).to.equal('generated code');
    expect(checksumFile).to.equal(filename);
    expect(checksumMd5).to.equal('abc123');
  });

  it('creates directories as needed', async () => {
    const modelIndex: ClayModelEntry = {
      path: 'model.json',
      generated_files: {},
      setFileCheckSum: () => {},
      getFileCheckSum: () => null,
      delFileCheckSum: () => {},
      load: () => ({}),
    };

    const filename = path.join(testDir, 'deep', 'nested', 'dir', 'test.ts');
    const items: FormattedItem[] = [
      { filename, content: 'code', md5: 'x', step: dummyStep, modelIndex },
    ];

    const stage = createWriteStage();
    await collect(stage(fromArray(items)));

    expect(fs.existsSync(filename)).to.be.true;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx mocha --require ts-node/register test/pipeline/format-write.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement format stage**

```typescript
// src/pipeline/stages/format.ts
import minimatch from 'minimatch';
import type { Stage, ChangedItem, FormattedItem } from '../types';
import type { Generator } from '../../types/generator';
import type { FormatterCache } from '../formatter-cache';

/**
 * Applies formatter chain to content.
 * Input: ChangedItem
 * Output: FormattedItem
 */
export function createFormatStage(
  generator: Generator,
  cache: FormatterCache
): Stage<ChangedItem, FormattedItem> {
  const formatters = generator.formatters || [];

  return async function* (input) {
    for await (const item of input) {
      let content = item.content;

      for (const fmt of formatters) {
        const pkg = typeof fmt === 'string' ? fmt : (fmt as { package: string }).package;
        const options =
          typeof fmt === 'string' ? {} : ((fmt as { options?: Record<string, unknown> }).options || {});
        const isNew = typeof fmt !== 'string';

        const formatter = cache.get(pkg);

        const shouldApply = Array.isArray(formatter.extensions)
          ? formatter.extensions.some((ext) => minimatch(item.filename, ext))
          : true;

        if (!shouldApply) continue;

        if (isNew) {
          content = await formatter.apply(item.filename, content, options, item.step);
        } else {
          content = await formatter.apply(item.filename, content);
        }
      }

      yield {
        filename: item.filename,
        content,
        md5: item.md5,
        step: item.step,
        modelIndex: item.modelIndex,
      };
    }
  };
}
```

- [ ] **Step 4: Implement write stage**

```typescript
// src/pipeline/stages/write.ts
import fs from 'fs/promises';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';
import * as ui from '../../output';
import type { Stage, FormattedItem, WrittenItem } from '../types';

/**
 * Writes formatted content to disk and updates checksum.
 * Input: FormattedItem
 * Output: WrittenItem
 */
export function createWriteStage(): Stage<FormattedItem, WrittenItem> {
  return async function* (input) {
    for await (const item of input) {
      const dir = path.dirname(item.filename);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      ui.write(item.filename);
      await fs.writeFile(item.filename, item.content, 'utf8');

      if (!item.step.touch) {
        item.modelIndex.setFileCheckSum(item.filename, item.md5);
      }

      yield {
        filename: item.filename,
        md5: item.md5,
        step: item.step,
        modelIndex: item.modelIndex,
      };
    }
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx mocha --require ts-node/register test/pipeline/format-write.test.ts`
Expected: 4 passing

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/stages/format.ts src/pipeline/stages/write.ts test/pipeline/format-write.test.ts
git commit -m "feat(pipeline): add format and write stages"
```

---

### Task 6: Pipeline Stages — Copy and Command

**Files:**
- Create: `src/pipeline/stages/copy.ts`
- Create: `src/pipeline/stages/command.ts`
- Test: `test/pipeline/copy-command.test.ts`

Copy and command steps don't flow through the render→hash→format→write pipeline. They're separate stage types invoked directly by the generator.

- [ ] **Step 1: Write failing tests**

```typescript
// test/pipeline/copy-command.test.ts
import { expect } from 'chai';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { executeCopy } from '../../src/pipeline/stages/copy';
import { executeCommand } from '../../src/pipeline/stages/command';
import type { ClayModelEntry } from '../../src/types/clay-file';

describe('copy stage', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-copy-'));
  });

  afterEach(() => {
    fs.removeSync(testDir);
  });

  it('copies a file to the output directory', async () => {
    const src = path.join(testDir, 'source.txt');
    fs.writeFileSync(src, 'content', 'utf8');

    const outDir = path.join(testDir, 'out');
    const modelIndex: ClayModelEntry = {
      path: 'model.json',
      generated_files: {},
      setFileCheckSum: () => {},
      getFileCheckSum: () => null,
      delFileCheckSum: () => {},
      load: () => ({}),
    };

    await executeCopy(src, outDir, modelIndex);

    expect(fs.existsSync(path.join(outDir, 'source.txt'))).to.be.true;
    expect(fs.readFileSync(path.join(outDir, 'source.txt'), 'utf8')).to.equal(
      'content'
    );
  });
});

describe('command stage', () => {
  it('executes a shell command asynchronously', async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-cmd-'));
    const outFile = path.join(testDir, 'result.txt');

    await executeCommand(`echo "hello" > "${outFile}"`, testDir);

    expect(fs.readFileSync(outFile, 'utf8').trim()).to.equal('hello');
    fs.removeSync(testDir);
  });

  it('throws on command failure', async () => {
    try {
      await executeCommand('exit 1', os.tmpdir());
      expect.fail('should have thrown');
    } catch (e: any) {
      expect(e).to.be.an('error');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx mocha --require ts-node/register test/pipeline/copy-command.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement copy stage**

```typescript
// src/pipeline/stages/copy.ts
import fs from 'fs-extra';
import path from 'path';
import * as ui from '../../output';
import type { ClayModelEntry } from '../../types/clay-file';

/**
 * Copy a file or directory to the output directory.
 * Not a streaming stage — copy is inherently a batch filesystem operation.
 */
export async function executeCopy(
  source: string,
  outputDir: string,
  modelIndex: ClayModelEntry
): Promise<void> {
  await fs.ensureDir(outputDir);

  const stat = await fs.lstat(source);
  let dest: string;

  if (stat.isFile()) {
    dest = path.join(outputDir, path.basename(source));
  } else {
    dest = outputDir;
  }

  ui.copy(source, dest);
  await fs.copy(source, dest);

  // Track in index
  const relFile = path.relative(process.cwd(), dest);
  const normalizedPath = relFile.split(path.sep).join('/');
  if (!modelIndex.generated_files[normalizedPath]) {
    modelIndex.generated_files[normalizedPath] = {
      md5: '',
      date: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 4: Implement command stage**

```typescript
// src/pipeline/stages/command.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import * as ui from '../../output';

const execAsync = promisify(exec);

/**
 * Execute a shell command asynchronously.
 * Replaces the old execSync pattern — does not block the event loop.
 */
export async function executeCommand(
  command: string,
  cwd: string,
  options?: { npx?: boolean; verbose?: boolean }
): Promise<void> {
  let cmd = command;
  if (options?.npx) {
    cmd = `npx ${command}`;
  }

  await fs.ensureDir(cwd);
  ui.execute(cmd);

  const execOptions: { cwd: string; maxBuffer: number } = {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  };

  const { stdout, stderr } = await execAsync(cmd, execOptions);

  if (options?.verbose) {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx mocha --require ts-node/register test/pipeline/copy-command.test.ts`
Expected: 3 passing

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/stages/copy.ts src/pipeline/stages/command.ts test/pipeline/copy-command.test.ts
git commit -m "feat(pipeline): add async copy and command stages"
```

---

### Task 7: Pipeline Factory and Index

**Files:**
- Create: `src/pipeline/index.ts`
- Test: `test/pipeline/index.test.ts`

The factory wires up the stages into a complete pipeline. This is where the type composition is verified at compile time.

- [ ] **Step 1: Write failing test**

```typescript
// test/pipeline/index.test.ts
import { expect } from 'chai';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { buildGeneratePipeline } from '../../src/pipeline/index';
import { FormatterCache } from '../../src/pipeline/formatter-cache';
import type { Generator } from '../../src/types/generator';
import type { ClayModelEntry } from '../../src/types/clay-file';

describe('pipeline factory', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-pipeline-'));
  });

  afterEach(() => {
    fs.removeSync(testDir);
  });

  it('builds a working pipeline that generates files', async () => {
    // Create a simple template
    const templateDir = path.join(testDir, 'templates');
    fs.mkdirSync(templateDir, { recursive: true });
    fs.writeFileSync(
      path.join(templateDir, '{{name}}.ts'),
      'export class {{name}} {}',
      'utf8'
    );

    const generator: Generator = {
      steps: [{ generate: '{{name}}.ts', select: '$.entities[*]', target: 'src/' }],
      partials: [],
      formatters: [],
    };

    const written: string[] = [];
    const modelIndex: ClayModelEntry = {
      path: 'model.json',
      generated_files: {},
      setFileCheckSum: (f: string) => { written.push(f); },
      getFileCheckSum: () => null,
      delFileCheckSum: () => {},
      load: () => ({}),
    };

    const outputDir = path.join(testDir, 'output');
    const cache = new FormatterCache(() => ({ apply: (_f: string, c: string) => c }));

    const run = buildGeneratePipeline(generator, cache);
    const model = { entities: [{ name: 'User' }, { name: 'Order' }] };

    await run(model, '$.entities[*]', templateDir, '{{name}}.ts', outputDir, modelIndex, generator.steps[0] as any);

    expect(written).to.have.lengthOf(2);
    expect(fs.existsSync(path.join(outputDir, 'src', 'User.ts'))).to.be.true;
    expect(fs.existsSync(path.join(outputDir, 'src', 'Order.ts'))).to.be.true;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx mocha --require ts-node/register test/pipeline/index.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement pipeline factory**

```typescript
// src/pipeline/index.ts
export { pipeline, compose, PipelineBuilder } from './types';
export type {
  Stage,
  SelectItem,
  RenderedItem,
  ChangedItem,
  FormattedItem,
  WrittenItem,
} from './types';
export { concurrent } from './concurrent';
export { FormatterCache, createFormatterCache } from './formatter-cache';
export { createSelectStage } from './stages/select';
export { createRenderStage, clearRenderCache } from './stages/render';
export { createHashStage } from './stages/hash';
export { createFormatStage } from './stages/format';
export { createWriteStage } from './stages/write';
export { executeCopy } from './stages/copy';
export { executeCommand } from './stages/command';

import { pipeline } from './types';
import { concurrent } from './concurrent';
import { createSelectStage } from './stages/select';
import { createRenderStage } from './stages/render';
import { createHashStage } from './stages/hash';
import { createFormatStage } from './stages/format';
import { createWriteStage } from './stages/write';
import type { FormatterCache } from './formatter-cache';
import type { WrittenItem } from './types';
import type { Generator, GeneratorStepGenerate } from '../types/generator';
import type { ClayModelEntry } from '../types/clay-file';

/**
 * Build the generate pipeline: select → render → hash → format → write.
 * TypeScript verifies the stage chain at compile time.
 * Returns a function that runs the full pipeline for one generate step.
 */
export function buildGeneratePipeline(
  generator: Generator,
  formatterCache: FormatterCache
): (
  model: unknown,
  jsonPath: string,
  templateDir: string,
  templateFile: string,
  outputDir: string,
  modelIndex: ClayModelEntry,
  step: GeneratorStepGenerate
) => Promise<WrittenItem[]> {
  // Wire up the pipeline: render → hash → format → write
  // Select is a source, not a transform, so it's called separately
  const processingPipeline = pipeline(createRenderStage())
    .pipe(createHashStage())
    .pipe(createFormatStage(generator, formatterCache))
    .pipe(concurrent(createWriteStage(), { concurrency: 10 }))
    .build();

  return async (model, jsonPath, templateDir, templateFile, outputDir, modelIndex, step) => {
    const templatePath = require('path').join(templateDir, templateFile);
    const fileNamePattern = require('path').join(outputDir, step.target || '', templateFile);

    // Select stage produces the source items
    const source = createSelectStage(
      model,
      jsonPath,
      templatePath,
      fileNamePattern,
      outputDir,
      step,
      modelIndex
    );

    // Run through the pipeline
    const results: WrittenItem[] = [];
    for await (const item of processingPipeline(source)) {
      results.push(item);
    }
    return results;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx mocha --require ts-node/register test/pipeline/index.test.ts`
Expected: 1 passing

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/index.ts test/pipeline/index.test.ts
git commit -m "feat(pipeline): add pipeline factory with typed stage composition"
```

---

### Task 8: Integrate Pipeline into Generator

**Files:**
- Modify: `src/generator.ts`
- Test: run existing test suite

This is the migration step. Replace the two-pass logic in `generate_file` with the pipeline, replace `execSync` with `executeCommand`, and wire in the `FormatterCache`. The existing generator API surface stays the same so existing tests keep passing.

- [ ] **Step 1: Run existing tests to establish baseline**

Run: `npm test`
Expected: 232 passing (current count)

- [ ] **Step 2: Update generator.ts imports**

At the top of `src/generator.ts`, add pipeline imports and create the formatter cache:

```typescript
import { buildGeneratePipeline, createFormatterCache, clearRenderCache } from './pipeline/index';
import { executeCommand } from './pipeline/stages/command';
import { executeCopy } from './pipeline/stages/copy';
import type { FormatterCache } from './pipeline/formatter-cache';
```

- [ ] **Step 3: Replace `generate_file` with pipeline call**

In `decorate_generator`, replace the step loop to use the pipeline for `generate` steps and async functions for `copy` and `runCommand` steps:

```typescript
decorated.generate = async (model: any, outputDir: string): Promise<void> => {
  clearTemplateCache();
  clearRenderCache();

  const formatterCache = createFormatterCache();
  const output = path.join(outputDir, extra_output || '');
  const dirname = path.dirname(p);
  handlebars.load_partials(g.partials || [], dirname);

  const pipelineRunner = buildGeneratePipeline(g, formatterCache);

  for (let index = 0; index < g.steps.length; index++) {
    const step = g.steps[index];
    if ('generate' in step) {
      const templatePath = path.join(dirname, step.generate);
      const isDir = fs.lstatSync(templatePath).isDirectory();
      if (isDir) {
        // For directory templates, iterate files and run pipeline per file
        const files = fs.readdirSync(templatePath);
        await Promise.all(
          files
            .filter(f => fs.lstatSync(path.join(templatePath, f)).isFile())
            .map(f => pipelineRunner(
              model, step.select, templatePath, f, output, modelIndex, step
            ))
        );
      } else {
        await pipelineRunner(
          model,
          step.select,
          path.join(dirname, path.dirname(step.generate)),
          path.basename(step.generate),
          output,
          modelIndex,
          step
        );
      }
    } else if ('runCommand' in step) {
      const output_dir = path.resolve(output);
      const verbose = step.verbose !== undefined ? step.verbose : !!process.env.VERBOSE;
      if (step.select === undefined) {
        await executeCommand(step.runCommand, output_dir, {
          npx: step.npxCommand,
          verbose,
        });
      } else {
        const command = handlebars.compile(step.runCommand);
        const items = jph.select(model, step.select);
        for (const m of items) {
          await executeCommand(command(m), output_dir, {
            npx: step.npxCommand,
            verbose,
          });
        }
      }
    } else if ('copy' in step) {
      const source = path.resolve(path.join(dirname, step.copy));
      await executeCopy(source, path.resolve(output), modelIndex);
    }
  }
};
```

- [ ] **Step 4: Remove dead code**

Remove from `generator.ts`:
- `generate_file` function
- `generate_directory` function
- `generate_template` function
- `applyFormatters` function
- `write` function (local one)
- `execute` function
- `run_command` function
- `copy` function (local one)
- `FormatterSpec` and `FormatterModule` interfaces
- `getMd5ForContent` function

Keep:
- `load` and `decorate_generator` (public API)
- Template cache functions (used by render stage)
- Schema validation
- `remove_file`, `remove_generated_files`, `cleanEmptyDirectories` (used by clean)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all existing tests pass (count may increase with new pipeline tests)

- [ ] **Step 6: Commit**

```bash
git add src/generator.ts
git commit -m "refactor: replace two-pass generator with typed pipeline"
```

---

### Task 9: Clean Up and Verify

**Files:**
- Modify: `src/generator.ts` (remove any remaining dead code)
- All test files

Final verification that the refactor is complete and everything works.

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all passing

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: clean build, no TypeScript errors

- [ ] **Step 3: Verify type safety by intentionally misconnecting stages**

In a scratch file, try connecting incompatible stages and verify TypeScript rejects it:

```typescript
// This should NOT compile:
import { pipeline } from './pipeline/types';
import { createRenderStage } from './pipeline/stages/render';
import { createWriteStage } from './pipeline/stages/write';

// Skip hash and format — RenderedItem is not FormattedItem
// TypeScript error: Type 'RenderedItem' is not assignable to type 'FormattedItem'
const bad = pipeline(createRenderStage()).pipe(createWriteStage());
```

Expected: TypeScript error at compile time — this is the architecture enforcement working.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean up dead code after pipeline migration"
```

---

## Architecture Summary

After all tasks, the data flow is:

```
Model JSON
  │
  ▼
SelectStage ──── yields SelectItem per JSONPath match
  │
  ▼
RenderStage ──── Handlebars template → RenderedItem (concurrent: N)
  │
  ▼
HashStage ────── MD5 + diff filter → ChangedItem (drops unchanged)
  │
  ▼
FormatStage ──── Formatter chain → FormattedItem (cached modules)
  │
  ▼
WriteStage ───── async fs.writeFile → WrittenItem (concurrent: 10)
  │
  ▼
Checksum update
```

**Type enforcement:** If you try to pipe `RenderStage` directly into `WriteStage`, TypeScript says:

```
Type 'Stage<SelectItem, RenderedItem>' is not assignable to 'Stage<SelectItem, FormattedItem>'
  Type 'RenderedItem' is missing property 'md5' from type 'FormattedItem'
```

You literally cannot build a broken pipeline.
