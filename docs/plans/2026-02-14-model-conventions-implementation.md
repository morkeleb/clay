# Model Conventions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a conventions system that validates Clay models against JS function rules defined in generators, enforced as warnings on MCP mutations and as hard blocks on `clay generate`.

**Architecture:** Convention rules are JS functions in `generator.json` (inline or via include). A core `src/conventions.ts` module loads and runs them. MCP mutation tools call conventions after writing and return violations as warnings. The CLI generate pipeline calls conventions before generating and blocks on violations.

**Tech Stack:** TypeScript, jsonpath (for model expansion), eval (for function strings, same as mixins)

---

### Task 1: Create core conventions module with tests

**Files:**
- Create: `src/conventions.ts`
- Test: `test/conventions.test.ts`

**Step 1: Write the failing tests**

Create `test/conventions.test.ts`:

```typescript
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { loadConventions, runConventions } from '../src/conventions';

describe('conventions', function () {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-conventions-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('loadConventions', () => {
    it('should load inline conventions from generator.json', () => {
      const generatorPath = path.join(testDir, 'generator.json');
      fs.writeFileSync(generatorPath, JSON.stringify({
        partials: [],
        formatters: [],
        steps: [],
        conventions: [
          {
            name: 'test-rule',
            description: 'A test rule',
            function: '(model) => []',
          },
        ],
      }));

      const conventions = loadConventions(generatorPath);
      expect(conventions).to.have.lengthOf(1);
      expect(conventions[0].name).to.equal('test-rule');
    });

    it('should resolve includes in conventions', () => {
      const conventionFile = path.join(testDir, 'my-convention.json');
      fs.writeFileSync(conventionFile, JSON.stringify({
        name: 'included-rule',
        description: 'An included rule',
        function: '(model) => []',
      }));

      const generatorPath = path.join(testDir, 'generator.json');
      fs.writeFileSync(generatorPath, JSON.stringify({
        partials: [],
        formatters: [],
        steps: [],
        conventions: [
          { include: 'my-convention.json' },
        ],
      }));

      const conventions = loadConventions(generatorPath);
      expect(conventions).to.have.lengthOf(1);
      expect(conventions[0].name).to.equal('included-rule');
    });

    it('should return empty array if no conventions defined', () => {
      const generatorPath = path.join(testDir, 'generator.json');
      fs.writeFileSync(generatorPath, JSON.stringify({
        partials: [],
        formatters: [],
        steps: [],
      }));

      const conventions = loadConventions(generatorPath);
      expect(conventions).to.deep.equal([]);
    });
  });

  describe('runConventions', () => {
    it('should return no violations for passing conventions', () => {
      const conventions = [
        {
          name: 'always-pass',
          description: 'Always passes',
          function: '(model) => []',
        },
      ];

      const violations = runConventions(conventions, { entities: [] });
      expect(violations).to.deep.equal([]);
    });

    it('should return violations for failing conventions', () => {
      const conventions = [
        {
          name: 'no-auto-fields',
          description: 'No auto-generated fields',
          function: "(model) => (model.entities || []).flatMap(e => (e.fields || []).filter(f => f.name === 'created_at').map(f => e.name + ': remove auto-generated field created_at'))",
        },
      ];

      const model = {
        entities: [
          { name: 'User', fields: [{ name: 'id', type: 'string' }, { name: 'created_at', type: 'Date' }] },
        ],
      };

      const violations = runConventions(conventions, model);
      expect(violations).to.have.lengthOf(1);
      expect(violations[0].convention).to.equal('no-auto-fields');
      expect(violations[0].errors).to.have.lengthOf(1);
      expect(violations[0].errors[0]).to.include('created_at');
    });

    it('should collect violations from multiple conventions', () => {
      const conventions = [
        {
          name: 'rule-a',
          description: 'Rule A',
          function: "(model) => ['error from A']",
        },
        {
          name: 'rule-b',
          description: 'Rule B',
          function: "(model) => ['error from B']",
        },
      ];

      const violations = runConventions(conventions, {});
      expect(violations).to.have.lengthOf(2);
    });

    it('should skip conventions whose function returns empty array', () => {
      const conventions = [
        { name: 'passing', description: 'Passes', function: '(model) => []' },
        { name: 'failing', description: 'Fails', function: "(model) => ['bad']" },
      ];

      const violations = runConventions(conventions, {});
      expect(violations).to.have.lengthOf(1);
      expect(violations[0].convention).to.equal('failing');
    });

    it('should handle convention function that throws', () => {
      const conventions = [
        { name: 'broken', description: 'Throws', function: "(model) => { throw new Error('boom') }" },
      ];

      const violations = runConventions(conventions, {});
      expect(violations).to.have.lengthOf(1);
      expect(violations[0].convention).to.equal('broken');
      expect(violations[0].errors[0]).to.include('boom');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "conventions"`

Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/conventions.ts`:

```typescript
/**
 * Convention loading and execution for Clay models.
 *
 * Conventions are JS functions defined in generator.json that validate
 * the expanded model and return error strings.
 */

import fs from 'fs';
import path from 'path';

export interface Convention {
  name: string;
  description: string;
  function: string;
}

export interface ConventionViolation {
  convention: string;
  description: string;
  errors: string[];
}

/**
 * Load conventions from a generator.json file.
 * Resolves includes using the same pattern as Clay model includes.
 */
export function loadConventions(generatorPath: string): Convention[] {
  const resolved = path.resolve(generatorPath);
  const content = fs.readFileSync(resolved, 'utf-8');
  const generator = JSON.parse(content);

  if (!generator.conventions || !Array.isArray(generator.conventions)) {
    return [];
  }

  const generatorDir = path.dirname(resolved);

  return generator.conventions.map((entry: any) => {
    if (entry.include) {
      const includePath = path.resolve(generatorDir, entry.include);
      const includeContent = fs.readFileSync(includePath, 'utf-8');
      return JSON.parse(includeContent) as Convention;
    }
    return entry as Convention;
  });
}

/**
 * Run conventions against an expanded model object.
 * Returns only conventions that have violations (non-empty error arrays).
 */
export function runConventions(
  conventions: Convention[],
  model: unknown
): ConventionViolation[] {
  const violations: ConventionViolation[] = [];

  for (const convention of conventions) {
    let errors: string[];
    try {
      const fn = eval(convention.function);
      const result = fn(model);
      errors = Array.isArray(result) ? result : [];
    } catch (e) {
      errors = [`Convention '${convention.name}' threw: ${e instanceof Error ? e.message : String(e)}`];
    }

    if (errors.length > 0) {
      violations.push({
        convention: convention.name,
        description: convention.description,
        errors,
      });
    }
  }

  return violations;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "conventions"`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/conventions.ts test/conventions.test.ts
git commit -m "feat: add core conventions module for model validation"
```

---

### Task 2: Update generator schema to accept conventions

**Files:**
- Modify: `src/schemas/generator_schema.json`
- Modify: `src/generator.ts` (Zod schema)

**Step 1: Update the JSON schema**

In `src/schemas/generator_schema.json`, add `conventions` to the `properties` object (after `steps`):

```json
    "conventions": {
      "type": "array",
      "items": {
        "anyOf": [
          {
            "type": "object",
            "properties": {
              "name": { "type": "string", "description": "Convention identifier" },
              "description": { "type": "string", "description": "What this convention enforces" },
              "function": { "type": "string", "description": "JS function string: (model) => string[]" }
            },
            "required": ["name", "description", "function"]
          },
          {
            "type": "object",
            "properties": {
              "include": { "type": "string", "description": "Path to convention JSON file" }
            },
            "required": ["include"]
          }
        ]
      }
    }
```

**Step 2: Update the Zod schema in generator.ts**

In `src/generator.ts`, update `GeneratorSchema` (around line 126) to add conventions:

```typescript
const ConventionSchema = z.union([
  z.object({
    name: z.string(),
    description: z.string(),
    function: z.string(),
  }),
  z.object({
    include: z.string(),
  }),
]);

const GeneratorSchema = z.object({
  steps: z.array(GeneratorStepSchema),
  partials: z.array(z.string()).optional(),
  formatters: z
    .array(
      z.union([
        z.string(),
        z.object({
          package: z.string(),
          options: z.record(z.any()).optional(),
        }),
      ])
    )
    .optional(),
  conventions: z.array(ConventionSchema).optional(),
});
```

**Step 3: Build to verify**

Run: `cd /Users/morten/src/opensource/clay && npm run build`

Expected: Build succeeds

**Step 4: Run all tests**

Run: `cd /Users/morten/src/opensource/clay && npm test`

Expected: All existing tests still pass

**Step 5: Commit**

```bash
git add src/schemas/generator_schema.json src/generator.ts
git commit -m "feat: add conventions to generator schema"
```

---

### Task 3: Add convention checking to CLI generate pipeline

**Files:**
- Modify: `src/command-line.ts`
- Test: `test/conventions.test.ts` (add integration test)

**Step 1: Write the failing test**

Add to `test/conventions.test.ts`:

```typescript
  describe('generate pipeline integration', () => {
    it('should block generation when conventions fail', () => {
      // Create a project structure with a model, generator, and failing convention
      const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-conv-gen-test-'));

      // Create generator with convention
      const genDir = path.join(projectDir, 'clay', 'generators', 'test-gen');
      fs.mkdirSync(genDir, { recursive: true });
      fs.mkdirSync(path.join(genDir, 'templates'), { recursive: true });
      fs.writeFileSync(path.join(genDir, 'templates', 'out.hbs'), '{{name}}');
      fs.writeFileSync(path.join(genDir, 'generator.json'), JSON.stringify({
        partials: [],
        formatters: [],
        steps: [
          { generate: 'templates/out.hbs', select: '$.model.entities[*]', target: './' },
        ],
        conventions: [
          {
            name: 'no-forbidden',
            description: 'No forbidden field',
            function: "(model) => (model.entities || []).flatMap(e => (e.fields || []).filter(f => f.name === 'forbidden').map(f => `${e.name}: has forbidden field`))",
          },
        ],
      }));

      // Create model with a forbidden field
      fs.writeFileSync(path.join(projectDir, 'model.json'), JSON.stringify({
        name: 'test',
        generators: ['test-gen'],
        model: {
          entities: [
            { name: 'Bad', fields: [{ name: 'forbidden', type: 'string' }] },
          ],
        },
      }));

      // Create .clay file
      fs.writeFileSync(path.join(projectDir, '.clay'), JSON.stringify({
        models: [{ path: 'model.json', output: './output', generated_files: {} }],
      }));

      // Try to generate — should fail
      const { execSync } = require('child_process');
      try {
        execSync('npx clay generate', { cwd: projectDir, stdio: 'pipe' });
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.stderr.toString() || e.stdout.toString()).to.include('convention');
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "generate pipeline"`

Expected: FAIL — conventions not checked yet

**Step 3: Add convention checking to the generate pipeline**

In `src/command-line.ts`, import conventions at the top:

```typescript
import { loadConventions, runConventions } from './conventions';
```

Modify the `generateModels` function (around line 87) to check conventions before generating:

```typescript
const generateModels = async (modelsToExecute: ModelIndex[]): Promise<void> => {
  await Promise.all(
    modelsToExecute.map(async (modelIndex) => {
      const model = modelIndex.load();

      // Check conventions from all generators before generating
      const allViolations: Array<{ generator: string; convention: string; errors: string[] }> = [];
      for (const g of model.generators) {
        const generatorName = typeof g === 'string' ? g : (g as GeneratorReference).generator || '';
        const generatorPaths = [
          generatorName + '.json',
          path.resolve(generatorName + '.json'),
          path.resolve(path.join(path.dirname(modelIndex.path), generatorName + '.json')),
          path.resolve(path.join(path.dirname(modelIndex.path), generatorName, 'generator.json')),
          path.resolve(path.join('clay', 'generators', generatorName, 'generator.json')),
          generatorName,
          path.resolve(generatorName),
          path.resolve(path.join(path.dirname(modelIndex.path), generatorName)),
        ].filter(fs.existsSync);

        if (generatorPaths.length > 0) {
          try {
            const conventions = loadConventions(generatorPaths[0]);
            if (conventions.length > 0) {
              const violations = runConventions(conventions, model.model);
              for (const v of violations) {
                allViolations.push({ generator: generatorName, convention: v.convention, errors: v.errors });
              }
            }
          } catch {
            // If conventions can't be loaded, skip (generator may not support them yet)
          }
        }
      }

      if (allViolations.length > 0) {
        const messages = allViolations.flatMap(v =>
          v.errors.map(e => `[${v.generator}/${v.convention}] ${e}`)
        );
        throw new Error(`Convention violations found:\n${messages.join('\n')}`);
      }

      await Promise.all(
        model.generators.map((g: string | GeneratorReference) =>
          resolve_generator(
            g,
            path.dirname(modelIndex.path),
            modelIndex
          ).generate(model, modelIndex.output || '')
        )
      );
    })
  );
};
```

**Step 4: Run tests**

Run: `cd /Users/morten/src/opensource/clay && npm test`

Expected: All tests pass including the new integration test

**Step 5: Commit**

```bash
git add src/command-line.ts test/conventions.test.ts
git commit -m "feat: enforce conventions in CLI generate pipeline"
```

---

### Task 4: Create MCP conventions helper

**Files:**
- Create: `mcp/shared/conventions.ts`
- Test: `test/mcp-conventions.test.ts`

**Step 1: Write the failing tests**

Create `test/mcp-conventions.test.ts`:

```typescript
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * CJS-compatible test for convention checking logic used by MCP tools.
 * Tests the pattern: load model -> find generators -> load conventions -> run.
 */

// Re-use core conventions module (CJS compatible since it's in src/)
import { loadConventions, runConventions } from '../src/conventions';

describe('MCP conventions helper', function () {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-mcp-conv-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should load conventions from generators referenced in model', () => {
    // Create generator with conventions
    const genDir = path.join(testDir, 'clay', 'generators', 'my-gen');
    fs.mkdirSync(genDir, { recursive: true });
    fs.writeFileSync(path.join(genDir, 'generator.json'), JSON.stringify({
      partials: [],
      formatters: [],
      steps: [],
      conventions: [
        { name: 'test-conv', description: 'Test convention', function: '(model) => []' },
      ],
    }));

    const generatorPath = path.join(genDir, 'generator.json');
    const conventions = loadConventions(generatorPath);
    expect(conventions).to.have.lengthOf(1);
    expect(conventions[0].name).to.equal('test-conv');
  });

  it('should run conventions and return violations', () => {
    const genDir = path.join(testDir, 'clay', 'generators', 'my-gen');
    fs.mkdirSync(genDir, { recursive: true });
    fs.writeFileSync(path.join(genDir, 'generator.json'), JSON.stringify({
      partials: [],
      formatters: [],
      steps: [],
      conventions: [
        {
          name: 'no-auto',
          description: 'No auto fields',
          function: "(model) => (model.entities || []).flatMap(e => (e.fields || []).filter(f => f.name === 'created_at').map(f => `${e.name}: remove '${f.name}'`))",
        },
      ],
    }));

    const conventions = loadConventions(path.join(genDir, 'generator.json'));
    const violations = runConventions(conventions, {
      entities: [{ name: 'User', fields: [{ name: 'created_at', type: 'Date' }] }],
    });

    expect(violations).to.have.lengthOf(1);
    expect(violations[0].errors[0]).to.include('created_at');
  });

  it('should return empty violations when model is valid', () => {
    const genDir = path.join(testDir, 'clay', 'generators', 'my-gen');
    fs.mkdirSync(genDir, { recursive: true });
    fs.writeFileSync(path.join(genDir, 'generator.json'), JSON.stringify({
      partials: [],
      formatters: [],
      steps: [],
      conventions: [
        {
          name: 'no-auto',
          description: 'No auto fields',
          function: "(model) => (model.entities || []).flatMap(e => (e.fields || []).filter(f => f.name === 'created_at').map(f => `${e.name}: remove '${f.name}'`))",
        },
      ],
    }));

    const conventions = loadConventions(path.join(genDir, 'generator.json'));
    const violations = runConventions(conventions, {
      entities: [{ name: 'User', fields: [{ name: 'email', type: 'string' }] }],
    });

    expect(violations).to.deep.equal([]);
  });
});
```

**Step 2: Run tests**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "MCP conventions"`

Expected: PASS (since we're just testing the core module from MCP context)

**Step 3: Create MCP conventions helper**

Create `mcp/shared/conventions.ts`:

```typescript
/**
 * MCP conventions helper.
 * Loads conventions from generators referenced by a model and runs them.
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readExpandedModel } from './model-file.js';

const require = createRequire(import.meta.url);
const { loadConventions, runConventions } = require('../../dist/src/conventions.js');

export interface ConventionViolation {
  generator: string;
  convention: string;
  errors: string[];
}

/**
 * Check conventions for a model by loading conventions from all its generators.
 * Returns violations grouped by generator and convention.
 */
export function checkConventions(
  modelPath: string,
  workingDirectory: string
): ConventionViolation[] {
  // Read the raw model to get generator references
  const rawContent = fs.readFileSync(path.resolve(modelPath), 'utf-8');
  const rawModel = JSON.parse(rawContent);

  if (!rawModel.generators || !Array.isArray(rawModel.generators)) {
    return [];
  }

  // Load expanded model for convention checking
  const expandedModel = readExpandedModel(modelPath);

  const allViolations: ConventionViolation[] = [];

  for (const g of rawModel.generators) {
    const generatorName = typeof g === 'string' ? g : g.generator || '';
    const modelDir = path.dirname(path.resolve(modelPath));

    // Same resolution order as command-line.ts
    const candidatePaths = [
      generatorName + '.json',
      path.resolve(generatorName + '.json'),
      path.resolve(path.join(modelDir, generatorName + '.json')),
      path.resolve(path.join(modelDir, generatorName, 'generator.json')),
      path.resolve(path.join(workingDirectory, 'clay', 'generators', generatorName, 'generator.json')),
      generatorName,
      path.resolve(generatorName),
      path.resolve(path.join(modelDir, generatorName)),
    ].filter((p) => fs.existsSync(p));

    if (candidatePaths.length === 0) continue;

    try {
      const conventions = loadConventions(candidatePaths[0]);
      if (conventions.length === 0) continue;

      const violations = runConventions(conventions, expandedModel.model);
      for (const v of violations) {
        allViolations.push({
          generator: generatorName,
          convention: v.convention,
          errors: v.errors,
        });
      }
    } catch {
      // If conventions can't be loaded, skip silently
    }
  }

  return allViolations;
}
```

**Step 4: Build MCP**

Run: `cd /Users/morten/src/opensource/clay && npm run build`

Expected: Build succeeds (both main and MCP)

**Step 5: Commit**

```bash
git add mcp/shared/conventions.ts test/mcp-conventions.test.ts
git commit -m "feat: add MCP conventions helper for mutation tools"
```

---

### Task 5: Add convention checking to MCP mutation tools

**Files:**
- Modify: `mcp/tools/model-add.ts`
- Modify: `mcp/tools/model-update.ts`
- Modify: `mcp/tools/model-delete.ts`
- Modify: `mcp/tools/model-rename.ts`
- Modify: `test/mcp-model-crud.test.ts`

**Step 1: Write the failing tests**

Add to `test/mcp-model-crud.test.ts`, inside the main describe block. You'll need the core conventions module:

```typescript
  describe('convention warnings on mutations', () => {
    it('should return convention_violations when add triggers a convention', () => {
      // Create a generator with a convention
      const genDir = path.join(testDir, 'clay', 'generators', 'typescript-api');
      fs.mkdirSync(genDir, { recursive: true });
      fs.writeFileSync(path.join(genDir, 'generator.json'), JSON.stringify({
        partials: [],
        formatters: [],
        steps: [],
        conventions: [
          {
            name: 'no-auto-fields',
            description: 'No auto-generated fields',
            function: "(model) => (model.entities || []).flatMap(e => (e.fields || []).filter(f => f.name === 'created_at').map(f => `${e.name}: remove auto-generated field '${f.name}'`))",
          },
        ],
      }));

      // The sample model references 'typescript-api' generator
      // Add an entity with a forbidden field
      const result = addToModel(modelPath, '$.model.entities', { name: 'Event', fields: [{ name: 'created_at', type: 'Date' }] });
      expect(result.success).to.be.true;

      // Now check conventions (simulating what the MCP tool does after write)
      const { loadConventions, runConventions } = require('../src/conventions');
      const conventions = loadConventions(path.join(genDir, 'generator.json'));

      // Load expanded model
      const clayModel = require('../dist/src/model.js');
      const expanded = clayModel.load(modelPath);

      const violations = runConventions(conventions, expanded.model);
      expect(violations).to.have.lengthOf(1);
      expect(violations[0].convention).to.equal('no-auto-fields');
      expect(violations[0].errors[0]).to.include('created_at');
    });
  });
```

**Step 2: Run test**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "convention warnings"`

Expected: PASS (this tests the pattern, not the MCP tool directly)

**Step 3: Update all 4 mutation tools**

The pattern is the same for all 4 tools. After the `writeModelFile` call and before building the success response, add convention checking.

In each of `model-add.ts`, `model-update.ts`, `model-delete.ts`, `model-rename.ts`:

1. Add import at top:
```typescript
import { checkConventions } from '../shared/conventions.js';
```

2. After `writeModelFile(fullModelPath, modelData);`, add:
```typescript
    // Check conventions (warnings only — mutation already written)
    let conventionViolations: Array<{ generator: string; convention: string; errors: string[] }> | undefined;
    try {
      const violations = checkConventions(fullModelPath, context.workingDirectory);
      if (violations.length > 0) {
        conventionViolations = violations;
      }
    } catch {
      // Convention checking is best-effort — don't fail the mutation
    }
```

3. Include `convention_violations` in the success response (only if present):
```typescript
    const response: Record<string, unknown> = {
      success: true,
      message: `...`,
      // ... tool-specific fields
    };
    if (conventionViolations) {
      response.convention_violations = conventionViolations;
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
    };
```

**Step 4: Build MCP**

Run: `cd /Users/morten/src/opensource/clay/mcp && npm run build`

Expected: Build succeeds

**Step 5: Run all tests**

Run: `cd /Users/morten/src/opensource/clay && npm test`

Expected: All tests pass

**Step 6: Commit**

```bash
git add mcp/tools/model-add.ts mcp/tools/model-update.ts mcp/tools/model-delete.ts mcp/tools/model-rename.ts test/mcp-model-crud.test.ts
git commit -m "feat: add convention warnings to MCP mutation tools"
```

---

### Task 6: Final verification and build

**Step 1: Run full test suite**

Run: `cd /Users/morten/src/opensource/clay && npm test`

Expected: All tests pass

**Step 2: Full build**

Run: `cd /Users/morten/src/opensource/clay && npm run build`

Expected: Build succeeds

**Step 3: Verify convention checking end-to-end**

Create a quick manual test:

```bash
cd /tmp && mkdir clay-conv-test && cd clay-conv-test
# Create .clay, model, and generator with convention
# Run clay generate with a violating model
# Verify it fails with convention error
```

**Step 4: Commit if any fixes needed**

```bash
git add -A && git commit -m "chore: final verification for model conventions"
```
