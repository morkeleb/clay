# MCP Model CRUD Tools Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 6 new MCP tools for querying, adding, updating, deleting, renaming, and schema-setting on Clay model JSON files.

**Architecture:** Each tool is a separate TypeScript file in `mcp/tools/`, following the existing pattern. A shared `model-file.ts` module handles read/write/validate. Tools operate directly on JSON files via `fs` + `jsonpath` (no CLI wrapping). Optional `$schema` validation via Ajv.

**Tech Stack:** TypeScript, jsonpath, Ajv, Zod (for input schemas), Mocha/Chai (tests)

---

### Task 1: Install dependencies

**Files:**
- Modify: `mcp/package.json`

**Step 1: Install jsonpath and ajv in the mcp package**

Run:
```bash
cd /Users/morten/src/opensource/clay/mcp && npm install jsonpath ajv
```

**Step 2: Install jsonpath types in root (already has @types/jsonpath in devDependencies)**

The root package already has `@types/jsonpath`. The MCP package uses the root's TypeScript config indirectly, but since MCP compiles independently, add the type:

Run:
```bash
cd /Users/morten/src/opensource/clay/mcp && npm install --save-dev @types/jsonpath
```

**Step 3: Verify installation**

Run:
```bash
cd /Users/morten/src/opensource/clay/mcp && node -e "require('jsonpath'); require('ajv'); console.log('OK')"
```

Expected: `OK`

**Step 4: Commit**

```bash
git add mcp/package.json mcp/package-lock.json
git commit -m "chore: add jsonpath and ajv dependencies to MCP package"
```

---

### Task 2: Create shared model-file.ts helper

**Files:**
- Create: `mcp/shared/model-file.ts`
- Test: `test/mcp-model-file.test.ts`

**Step 1: Write the failing tests**

Create `test/mcp-model-file.test.ts`:

```typescript
import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

// We test the helper functions by importing them directly
// These are pure functions that operate on the file system
import { readModelFile, writeModelFile, validateAgainstSchema } from '../mcp/shared/model-file.js';

describe('model-file helper', function () {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clay-model-file-test-'));
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('readModelFile', () => {
    it('should read and parse a valid model JSON file', async () => {
      const modelPath = path.join(testDir, 'test.model.json');
      await fs.writeJson(modelPath, {
        name: 'TestModel',
        generators: ['gen1'],
        model: { entities: [{ name: 'User' }] },
      });

      const result = readModelFile(modelPath);
      expect(result.name).to.equal('TestModel');
      expect(result.model.entities).to.have.lengthOf(1);
    });

    it('should throw if file does not exist', () => {
      const modelPath = path.join(testDir, 'nonexistent.json');
      expect(() => readModelFile(modelPath)).to.throw();
    });

    it('should throw if file contains invalid JSON', async () => {
      const modelPath = path.join(testDir, 'bad.json');
      await fs.writeFile(modelPath, '{ broken json }');
      expect(() => readModelFile(modelPath)).to.throw();
    });
  });

  describe('writeModelFile', () => {
    it('should write model data as formatted JSON with trailing newline', () => {
      const modelPath = path.join(testDir, 'output.model.json');
      const data = { name: 'Test', generators: [], model: { items: [] } };

      writeModelFile(modelPath, data);

      const content = fs.readFileSync(modelPath, 'utf8');
      expect(content).to.equal(JSON.stringify(data, null, 2) + '\n');
    });

    it('should preserve unknown top-level properties', () => {
      const modelPath = path.join(testDir, 'output.model.json');
      const data = { name: 'Test', generators: [], model: {}, custom_field: 'preserved' };

      writeModelFile(modelPath, data);

      const result = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
      expect(result.custom_field).to.equal('preserved');
    });

    it('should validate against $schema if present and reject invalid data', async () => {
      const schemaPath = path.join(testDir, 'test.schema.json');
      await fs.writeJson(schemaPath, {
        type: 'object',
        required: ['entities'],
        properties: {
          entities: { type: 'array' },
        },
      });

      const modelPath = path.join(testDir, 'output.model.json');
      const data = {
        name: 'Test',
        generators: [],
        '$schema': schemaPath,
        model: { not_entities: 'wrong' },
      };

      expect(() => writeModelFile(modelPath, data)).to.throw(/schema validation failed/i);
    });

    it('should write successfully when $schema validation passes', async () => {
      const schemaPath = path.join(testDir, 'test.schema.json');
      await fs.writeJson(schemaPath, {
        type: 'object',
        required: ['entities'],
        properties: {
          entities: { type: 'array' },
        },
      });

      const modelPath = path.join(testDir, 'output.model.json');
      const data = {
        name: 'Test',
        generators: [],
        '$schema': schemaPath,
        model: { entities: [] },
      };

      writeModelFile(modelPath, data);
      const result = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
      expect(result.model.entities).to.deep.equal([]);
    });

    it('should write without validation when no $schema present', () => {
      const modelPath = path.join(testDir, 'output.model.json');
      const data = { name: 'Test', generators: [], model: { anything: 'goes' } };

      writeModelFile(modelPath, data);
      const result = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
      expect(result.model.anything).to.equal('goes');
    });
  });

  describe('validateAgainstSchema', () => {
    it('should return empty errors for valid data', async () => {
      const schemaPath = path.join(testDir, 'test.schema.json');
      await fs.writeJson(schemaPath, {
        type: 'object',
        properties: { name: { type: 'string' } },
      });

      const errors = validateAgainstSchema({ name: 'test' }, schemaPath);
      expect(errors).to.deep.equal([]);
    });

    it('should return error messages for invalid data', async () => {
      const schemaPath = path.join(testDir, 'test.schema.json');
      await fs.writeJson(schemaPath, {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      });

      const errors = validateAgainstSchema({}, schemaPath);
      expect(errors).to.be.an('array').with.lengthOf.at.least(1);
    });

    it('should throw if schema file not found', () => {
      expect(() => validateAgainstSchema({}, '/nonexistent/schema.json')).to.throw(/not found/i);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "model-file helper"`

Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `mcp/shared/model-file.ts`:

```typescript
/**
 * Shared helpers for reading, writing, and validating Clay model JSON files
 */
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

/**
 * Read and parse a model JSON file
 */
export function readModelFile(modelPath: string): Record<string, any> {
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Model file not found: ${modelPath}`);
  }
  const content = fs.readFileSync(modelPath, 'utf8');
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid JSON in model file ${modelPath}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Write model data to a JSON file. Validates against $schema if present.
 */
export function writeModelFile(modelPath: string, data: Record<string, any>): void {
  // Validate against $schema if present
  if (data['$schema']) {
    const schemaPath = path.isAbsolute(data['$schema'])
      ? data['$schema']
      : path.resolve(path.dirname(modelPath), data['$schema']);
    const errors = validateAgainstSchema(data.model, schemaPath);
    if (errors.length > 0) {
      throw new Error(`Schema validation failed:\n${errors.join('\n')}`);
    }
  }

  fs.writeFileSync(modelPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Validate data against a JSON Schema file. Returns array of error messages (empty if valid).
 */
export function validateAgainstSchema(data: unknown, schemaPath: string): string[] {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  let schema: Record<string, unknown>;
  try {
    schema = JSON.parse(schemaContent);
  } catch (e) {
    throw new Error(`Invalid JSON in schema file ${schemaPath}: ${e instanceof Error ? e.message : String(e)}`);
  }

  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return [];
  }

  return (validate.errors || []).map((err) => {
    const path = err.instancePath || '/';
    return `${path}: ${err.message}`;
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "model-file helper"`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add mcp/shared/model-file.ts test/mcp-model-file.test.ts
git commit -m "feat: add shared model-file helper for MCP model CRUD tools"
```

---

### Task 3: Add Zod schemas for all 6 new tools

**Files:**
- Modify: `mcp/shared/schemas.ts`

**Step 1: Add the 6 new input schemas to schemas.ts**

Append to `mcp/shared/schemas.ts` after the existing schemas:

```typescript
// ============================================================================
// clay_model_query schemas
// ============================================================================

export const ModelQueryInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema,
    json_path: z
      .string()
      .describe('JSONPath expression to query (e.g., "$.model.entities[?(@.name==\'User\')]")'),
  })
  .describe('Query model data using JSONPath. Returns matched items only.');

export type ModelQueryInput = z.infer<typeof ModelQueryInputSchema>;

// ============================================================================
// clay_model_add schemas
// ============================================================================

export const ModelAddInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema,
    json_path: z
      .string()
      .describe('JSONPath to the target array or object (e.g., "$.model.entities")'),
    value: z
      .any()
      .describe('Value to add: appended if target is array, merged if target is object'),
  })
  .describe('Add an item to an array or property to an object at a JSONPath location.');

export type ModelAddInput = z.infer<typeof ModelAddInputSchema>;

// ============================================================================
// clay_model_update schemas
// ============================================================================

export const ModelUpdateInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema,
    json_path: z
      .string()
      .describe('JSONPath expression matching items to update'),
    fields: z
      .record(z.any())
      .describe('Fields to merge into each matched item'),
  })
  .describe('Update fields on all items matched by JSONPath.');

export type ModelUpdateInput = z.infer<typeof ModelUpdateInputSchema>;

// ============================================================================
// clay_model_delete schemas
// ============================================================================

export const ModelDeleteInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema,
    json_path: z
      .string()
      .describe('JSONPath expression matching items to remove from their parent'),
  })
  .describe('Remove items matched by JSONPath from their parent arrays/objects.');

export type ModelDeleteInput = z.infer<typeof ModelDeleteInputSchema>;

// ============================================================================
// clay_model_rename schemas
// ============================================================================

export const ModelRenameInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema,
    json_path: z
      .string()
      .describe('JSONPath expression matching items whose property to rename'),
    old_name: z
      .string()
      .describe('Current property name to rename'),
    new_name: z
      .string()
      .describe('New property name'),
  })
  .describe('Rename a property key across all items matched by JSONPath.');

export type ModelRenameInput = z.infer<typeof ModelRenameInputSchema>;

// ============================================================================
// clay_model_set_schema schemas
// ============================================================================

export const ModelSetSchemaInputSchema = z
  .object({
    working_directory: WorkingDirectorySchema,
    model_path: ModelPathSchema,
    schema_path: z
      .string()
      .describe('Path to JSON Schema file (relative to model file or absolute)'),
  })
  .describe('Set or update the $schema reference on a model file.');

export type ModelSetSchemaInput = z.infer<typeof ModelSetSchemaInputSchema>;
```

**Step 2: Verify MCP builds**

Run: `cd /Users/morten/src/opensource/clay/mcp && npm run build`

Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add mcp/shared/schemas.ts
git commit -m "feat: add Zod schemas for 6 MCP model CRUD tools"
```

---

### Task 4: Implement clay_model_query

**Files:**
- Create: `mcp/tools/model-query.ts`
- Test: `test/mcp-model-crud.test.ts`

**Step 1: Write the failing test**

Create `test/mcp-model-crud.test.ts` (this file will accumulate tests for all 6 tools):

```typescript
import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

describe('MCP Model CRUD Tools', function () {
  let testDir: string;
  let modelPath: string;

  const sampleModel = {
    name: 'TestAPI',
    generators: ['typescript-api'],
    model: {
      entities: [
        { name: 'User', fields: [{ name: 'id', type: 'string' }, { name: 'email', type: 'string' }] },
        { name: 'Post', fields: [{ name: 'id', type: 'string' }, { name: 'title', type: 'string' }] },
      ],
    },
  };

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clay-model-crud-test-'));
    modelPath = path.join(testDir, 'api.model.json');
    await fs.writeJson(modelPath, sampleModel, { spaces: 2 });
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('clay_model_query', () => {
    // Dynamic import since MCP uses ES modules
    let modelQueryTool: (args: unknown) => Promise<any>;

    before(async () => {
      const mod = await import('../mcp/tools/model-query.js');
      modelQueryTool = mod.modelQueryTool;
    });

    it('should return matched items for a valid JSONPath', async () => {
      const result = await modelQueryTool({
        model_path: modelPath,
        json_path: '$.model.entities[?(@.name=="User")]',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.true;
      expect(parsed.count).to.equal(1);
      expect(parsed.results[0].name).to.equal('User');
    });

    it('should return all entities with wildcard', async () => {
      const result = await modelQueryTool({
        model_path: modelPath,
        json_path: '$.model.entities[*]',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.true;
      expect(parsed.count).to.equal(2);
    });

    it('should return empty results for non-matching path', async () => {
      const result = await modelQueryTool({
        model_path: modelPath,
        json_path: '$.model.entities[?(@.name=="Nonexistent")]',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.true;
      expect(parsed.count).to.equal(0);
      expect(parsed.results).to.deep.equal([]);
    });

    it('should return error for invalid JSONPath', async () => {
      const result = await modelQueryTool({
        model_path: modelPath,
        json_path: 'not a valid path',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.false;
    });

    it('should return error for nonexistent model file', async () => {
      const result = await modelQueryTool({
        model_path: path.join(testDir, 'nonexistent.json'),
        json_path: '$.model',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.false;
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "clay_model_query"`

Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `mcp/tools/model-query.ts`:

```typescript
/**
 * clay_model_query tool - Query model data using JSONPath
 */
import { validateInput } from '../shared/validation.js';
import { ModelQueryInputSchema } from '../shared/schemas.js';
import { readModelFile } from '../shared/model-file.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';

export async function modelQueryTool(args: unknown) {
  const validation = validateInput(ModelQueryInputSchema, args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: validation.error }, null, 2) }],
    };
  }

  const input = validation.data;

  try {
    const context = getWorkspaceContext(input.working_directory);
    const fullModelPath = resolvePath(context.workingDirectory, input.model_path);
    const modelData = readModelFile(fullModelPath);

    let results: unknown[];
    try {
      results = jp.query(modelData, input.json_path);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`,
        }, null, 2) }],
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true,
        count: results.length,
        results,
      }, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: errorMessage }, null, 2) }],
    };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "clay_model_query"`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add mcp/tools/model-query.ts test/mcp-model-crud.test.ts
git commit -m "feat: add clay_model_query MCP tool"
```

---

### Task 5: Implement clay_model_add

**Files:**
- Create: `mcp/tools/model-add.ts`
- Modify: `test/mcp-model-crud.test.ts`

**Step 1: Write the failing tests**

Add to `test/mcp-model-crud.test.ts` inside the main describe block:

```typescript
  describe('clay_model_add', () => {
    let modelAddTool: (args: unknown) => Promise<any>;

    before(async () => {
      const mod = await import('../mcp/tools/model-add.js');
      modelAddTool = mod.modelAddTool;
    });

    it('should append to an array', async () => {
      const result = await modelAddTool({
        model_path: modelPath,
        json_path: '$.model.entities',
        value: { name: 'Comment', fields: [] },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.true;

      const updated = await fs.readJson(modelPath);
      expect(updated.model.entities).to.have.lengthOf(3);
      expect(updated.model.entities[2].name).to.equal('Comment');
    });

    it('should merge into an object', async () => {
      const result = await modelAddTool({
        model_path: modelPath,
        json_path: '$.model',
        value: { version: '1.0' },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.true;

      const updated = await fs.readJson(modelPath);
      expect(updated.model.version).to.equal('1.0');
      expect(updated.model.entities).to.have.lengthOf(2); // existing data preserved
    });

    it('should error if path matches nothing', async () => {
      const result = await modelAddTool({
        model_path: modelPath,
        json_path: '$.model.nonexistent',
        value: { name: 'test' },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.false;
    });

    it('should reject if $schema validation fails', async () => {
      const schemaPath = path.join(testDir, 'strict.schema.json');
      await fs.writeJson(schemaPath, {
        type: 'object',
        properties: {
          entities: {
            type: 'array',
            maxItems: 2,
          },
        },
      });

      // Add $schema to model
      const model = await fs.readJson(modelPath);
      model['$schema'] = schemaPath;
      await fs.writeJson(modelPath, model, { spaces: 2 });

      const result = await modelAddTool({
        model_path: modelPath,
        json_path: '$.model.entities',
        value: { name: 'TooMany', fields: [] },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.false;
      expect(parsed.message).to.match(/schema validation/i);
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "clay_model_add"`

Expected: FAIL

**Step 3: Write the implementation**

Create `mcp/tools/model-add.ts`:

```typescript
/**
 * clay_model_add tool - Add items to arrays or properties to objects
 */
import { validateInput } from '../shared/validation.js';
import { ModelAddInputSchema } from '../shared/schemas.js';
import { readModelFile, writeModelFile } from '../shared/model-file.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';

export async function modelAddTool(args: unknown) {
  const validation = validateInput(ModelAddInputSchema, args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: validation.error }, null, 2) }],
    };
  }

  const input = validation.data;

  try {
    const context = getWorkspaceContext(input.working_directory);
    const fullModelPath = resolvePath(context.workingDirectory, input.model_path);
    const modelData = readModelFile(fullModelPath);

    let targets: unknown[];
    try {
      targets = jp.query(modelData, input.json_path);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`,
        }, null, 2) }],
      };
    }

    if (targets.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `No items matched JSONPath: ${input.json_path}`,
        }, null, 2) }],
      };
    }

    const target = targets[0];

    if (Array.isArray(target)) {
      target.push(input.value);
    } else if (typeof target === 'object' && target !== null) {
      Object.assign(target, input.value);
    } else {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Target at ${input.json_path} is not an array or object (got ${typeof target})`,
        }, null, 2) }],
      };
    }

    writeModelFile(fullModelPath, modelData);

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true,
        message: `Added value at ${input.json_path}`,
        path: input.json_path,
      }, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: errorMessage }, null, 2) }],
    };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "clay_model_add"`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add mcp/tools/model-add.ts test/mcp-model-crud.test.ts
git commit -m "feat: add clay_model_add MCP tool"
```

---

### Task 6: Implement clay_model_update

**Files:**
- Create: `mcp/tools/model-update.ts`
- Modify: `test/mcp-model-crud.test.ts`

**Step 1: Write the failing tests**

Add to `test/mcp-model-crud.test.ts`:

```typescript
  describe('clay_model_update', () => {
    let modelUpdateTool: (args: unknown) => Promise<any>;

    before(async () => {
      const mod = await import('../mcp/tools/model-update.js');
      modelUpdateTool = mod.modelUpdateTool;
    });

    it('should merge fields into matched items', async () => {
      const result = await modelUpdateTool({
        model_path: modelPath,
        json_path: '$.model.entities[?(@.name=="User")]',
        fields: { tableName: 'users', active: true },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.true;
      expect(parsed.matched).to.equal(1);

      const updated = await fs.readJson(modelPath);
      const user = updated.model.entities.find((e: any) => e.name === 'User');
      expect(user.tableName).to.equal('users');
      expect(user.active).to.be.true;
      expect(user.fields).to.have.lengthOf(2); // existing fields preserved
    });

    it('should update multiple matched items', async () => {
      const result = await modelUpdateTool({
        model_path: modelPath,
        json_path: '$.model.entities[*]',
        fields: { version: 1 },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.true;
      expect(parsed.matched).to.equal(2);

      const updated = await fs.readJson(modelPath);
      expect(updated.model.entities[0].version).to.equal(1);
      expect(updated.model.entities[1].version).to.equal(1);
    });

    it('should error if nothing matched', async () => {
      const result = await modelUpdateTool({
        model_path: modelPath,
        json_path: '$.model.entities[?(@.name=="Nonexistent")]',
        fields: { test: true },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.false;
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "clay_model_update"`

Expected: FAIL

**Step 3: Write the implementation**

Create `mcp/tools/model-update.ts`:

```typescript
/**
 * clay_model_update tool - Update fields on matched items
 */
import { validateInput } from '../shared/validation.js';
import { ModelUpdateInputSchema } from '../shared/schemas.js';
import { readModelFile, writeModelFile } from '../shared/model-file.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';

export async function modelUpdateTool(args: unknown) {
  const validation = validateInput(ModelUpdateInputSchema, args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: validation.error }, null, 2) }],
    };
  }

  const input = validation.data;

  try {
    const context = getWorkspaceContext(input.working_directory);
    const fullModelPath = resolvePath(context.workingDirectory, input.model_path);
    const modelData = readModelFile(fullModelPath);

    let matches: unknown[];
    try {
      matches = jp.query(modelData, input.json_path);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`,
        }, null, 2) }],
      };
    }

    if (matches.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `No items matched JSONPath: ${input.json_path}`,
        }, null, 2) }],
      };
    }

    let updated = 0;
    for (const match of matches) {
      if (typeof match === 'object' && match !== null && !Array.isArray(match)) {
        Object.assign(match, input.fields);
        updated++;
      }
    }

    writeModelFile(fullModelPath, modelData);

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true,
        message: `Updated ${updated} item(s) at ${input.json_path}`,
        matched: updated,
      }, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: errorMessage }, null, 2) }],
    };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "clay_model_update"`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add mcp/tools/model-update.ts test/mcp-model-crud.test.ts
git commit -m "feat: add clay_model_update MCP tool"
```

---

### Task 7: Implement clay_model_delete

**Files:**
- Create: `mcp/tools/model-delete.ts`
- Modify: `test/mcp-model-crud.test.ts`

**Step 1: Write the failing tests**

Add to `test/mcp-model-crud.test.ts`:

```typescript
  describe('clay_model_delete', () => {
    let modelDeleteTool: (args: unknown) => Promise<any>;

    before(async () => {
      const mod = await import('../mcp/tools/model-delete.js');
      modelDeleteTool = mod.modelDeleteTool;
    });

    it('should remove matched item from array', async () => {
      const result = await modelDeleteTool({
        model_path: modelPath,
        json_path: '$.model.entities[?(@.name=="Post")]',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.true;
      expect(parsed.removed).to.equal(1);

      const updated = await fs.readJson(modelPath);
      expect(updated.model.entities).to.have.lengthOf(1);
      expect(updated.model.entities[0].name).to.equal('User');
    });

    it('should remove matched property from object', async () => {
      // Add a property to delete
      const model = await fs.readJson(modelPath);
      model.model.metadata = { created: '2024-01-01' };
      await fs.writeJson(modelPath, model, { spaces: 2 });

      const result = await modelDeleteTool({
        model_path: modelPath,
        json_path: '$.model.metadata',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.true;

      const updated = await fs.readJson(modelPath);
      expect(updated.model.metadata).to.be.undefined;
    });

    it('should error if nothing matched', async () => {
      const result = await modelDeleteTool({
        model_path: modelPath,
        json_path: '$.model.entities[?(@.name=="Nonexistent")]',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.false;
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "clay_model_delete"`

Expected: FAIL

**Step 3: Write the implementation**

Create `mcp/tools/model-delete.ts`:

```typescript
/**
 * clay_model_delete tool - Remove items matched by JSONPath
 */
import { validateInput } from '../shared/validation.js';
import { ModelDeleteInputSchema } from '../shared/schemas.js';
import { readModelFile, writeModelFile } from '../shared/model-file.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';

export async function modelDeleteTool(args: unknown) {
  const validation = validateInput(ModelDeleteInputSchema, args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: validation.error }, null, 2) }],
    };
  }

  const input = validation.data;

  try {
    const context = getWorkspaceContext(input.working_directory);
    const fullModelPath = resolvePath(context.workingDirectory, input.model_path);
    const modelData = readModelFile(fullModelPath);

    let paths: jp.PathComponent[][];
    try {
      paths = jp.paths(modelData, input.json_path);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`,
        }, null, 2) }],
      };
    }

    if (paths.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `No items matched JSONPath: ${input.json_path}`,
        }, null, 2) }],
      };
    }

    // Process in reverse order so array indices remain valid
    const sortedPaths = [...paths].reverse();
    let removed = 0;

    for (const pathComponents of sortedPaths) {
      // pathComponents is like ['$', 'model', 'entities', 0]
      const parentPath = pathComponents.slice(0, -1);
      const key = pathComponents[pathComponents.length - 1];
      const parent = jp.query(modelData, jp.stringify(parentPath))[0];

      if (Array.isArray(parent) && typeof key === 'number') {
        parent.splice(key, 1);
        removed++;
      } else if (typeof parent === 'object' && parent !== null) {
        delete parent[key as string];
        removed++;
      }
    }

    writeModelFile(fullModelPath, modelData);

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true,
        message: `Removed ${removed} item(s) matching ${input.json_path}`,
        removed,
      }, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: errorMessage }, null, 2) }],
    };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "clay_model_delete"`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add mcp/tools/model-delete.ts test/mcp-model-crud.test.ts
git commit -m "feat: add clay_model_delete MCP tool"
```

---

### Task 8: Implement clay_model_rename

**Files:**
- Create: `mcp/tools/model-rename.ts`
- Modify: `test/mcp-model-crud.test.ts`

**Step 1: Write the failing tests**

Add to `test/mcp-model-crud.test.ts`:

```typescript
  describe('clay_model_rename', () => {
    let modelRenameTool: (args: unknown) => Promise<any>;

    before(async () => {
      const mod = await import('../mcp/tools/model-rename.js');
      modelRenameTool = mod.modelRenameTool;
    });

    it('should rename property on all matched items', async () => {
      const result = await modelRenameTool({
        model_path: modelPath,
        json_path: '$.model.entities[*]',
        old_name: 'fields',
        new_name: 'columns',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.true;
      expect(parsed.renamed).to.equal(2);

      const updated = await fs.readJson(modelPath);
      expect(updated.model.entities[0]).to.have.property('columns');
      expect(updated.model.entities[0]).to.not.have.property('fields');
      expect(updated.model.entities[1]).to.have.property('columns');
    });

    it('should skip items that do not have the old property', async () => {
      // Remove 'fields' from one entity
      const model = await fs.readJson(modelPath);
      delete model.model.entities[1].fields;
      await fs.writeJson(modelPath, model, { spaces: 2 });

      const result = await modelRenameTool({
        model_path: modelPath,
        json_path: '$.model.entities[*]',
        old_name: 'fields',
        new_name: 'columns',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.true;
      expect(parsed.renamed).to.equal(1);
    });

    it('should error if nothing matched', async () => {
      const result = await modelRenameTool({
        model_path: modelPath,
        json_path: '$.model.nonexistent[*]',
        old_name: 'a',
        new_name: 'b',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.false;
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "clay_model_rename"`

Expected: FAIL

**Step 3: Write the implementation**

Create `mcp/tools/model-rename.ts`:

```typescript
/**
 * clay_model_rename tool - Rename a property on matched items
 */
import { validateInput } from '../shared/validation.js';
import { ModelRenameInputSchema } from '../shared/schemas.js';
import { readModelFile, writeModelFile } from '../shared/model-file.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';

export async function modelRenameTool(args: unknown) {
  const validation = validateInput(ModelRenameInputSchema, args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: validation.error }, null, 2) }],
    };
  }

  const input = validation.data;

  try {
    const context = getWorkspaceContext(input.working_directory);
    const fullModelPath = resolvePath(context.workingDirectory, input.model_path);
    const modelData = readModelFile(fullModelPath);

    let matches: unknown[];
    try {
      matches = jp.query(modelData, input.json_path);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`,
        }, null, 2) }],
      };
    }

    if (matches.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `No items matched JSONPath: ${input.json_path}`,
        }, null, 2) }],
      };
    }

    let renamed = 0;
    for (const match of matches) {
      if (typeof match === 'object' && match !== null && !Array.isArray(match)) {
        const obj = match as Record<string, unknown>;
        if (input.old_name in obj) {
          obj[input.new_name] = obj[input.old_name];
          delete obj[input.old_name];
          renamed++;
        }
      }
    }

    writeModelFile(fullModelPath, modelData);

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true,
        message: `Renamed '${input.old_name}' to '${input.new_name}' on ${renamed} item(s)`,
        renamed,
      }, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: errorMessage }, null, 2) }],
    };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "clay_model_rename"`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add mcp/tools/model-rename.ts test/mcp-model-crud.test.ts
git commit -m "feat: add clay_model_rename MCP tool"
```

---

### Task 9: Implement clay_model_set_schema

**Files:**
- Create: `mcp/tools/model-set-schema.ts`
- Modify: `test/mcp-model-crud.test.ts`

**Step 1: Write the failing tests**

Add to `test/mcp-model-crud.test.ts`:

```typescript
  describe('clay_model_set_schema', () => {
    let modelSetSchemaTool: (args: unknown) => Promise<any>;

    before(async () => {
      const mod = await import('../mcp/tools/model-set-schema.js');
      modelSetSchemaTool = mod.modelSetSchemaTool;
    });

    it('should set $schema reference on model', async () => {
      const schemaPath = path.join(testDir, 'api.schema.json');
      await fs.writeJson(schemaPath, {
        type: 'object',
        properties: { entities: { type: 'array' } },
      });

      const result = await modelSetSchemaTool({
        model_path: modelPath,
        schema_path: schemaPath,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.true;

      const updated = await fs.readJson(modelPath);
      expect(updated['$schema']).to.equal(schemaPath);
    });

    it('should return validation warnings if model does not match schema', async () => {
      const schemaPath = path.join(testDir, 'strict.schema.json');
      await fs.writeJson(schemaPath, {
        type: 'object',
        required: ['nonexistent_field'],
      });

      const result = await modelSetSchemaTool({
        model_path: modelPath,
        schema_path: schemaPath,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.true; // Still writes the reference
      expect(parsed.validation_warnings).to.be.an('array').with.lengthOf.at.least(1);

      const updated = await fs.readJson(modelPath);
      expect(updated['$schema']).to.equal(schemaPath);
    });

    it('should error if schema file does not exist', async () => {
      const result = await modelSetSchemaTool({
        model_path: modelPath,
        schema_path: path.join(testDir, 'nonexistent.schema.json'),
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).to.be.false;
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "clay_model_set_schema"`

Expected: FAIL

**Step 3: Write the implementation**

Create `mcp/tools/model-set-schema.ts`:

```typescript
/**
 * clay_model_set_schema tool - Set $schema reference on a model file
 */
import { validateInput } from '../shared/validation.js';
import { ModelSetSchemaInputSchema } from '../shared/schemas.js';
import { readModelFile, validateAgainstSchema } from '../shared/model-file.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import fs from 'fs';
import path from 'path';

export async function modelSetSchemaTool(args: unknown) {
  const validation = validateInput(ModelSetSchemaInputSchema, args);
  if (!validation.success) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: validation.error }, null, 2) }],
    };
  }

  const input = validation.data;

  try {
    const context = getWorkspaceContext(input.working_directory);
    const fullModelPath = resolvePath(context.workingDirectory, input.model_path);
    const modelData = readModelFile(fullModelPath);

    // Resolve schema path
    const schemaPath = path.isAbsolute(input.schema_path)
      ? input.schema_path
      : path.resolve(path.dirname(fullModelPath), input.schema_path);

    if (!fs.existsSync(schemaPath)) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          message: `Schema file not found: ${schemaPath}`,
        }, null, 2) }],
      };
    }

    // Validate current model against schema (warnings only — still write the reference)
    const warnings = validateAgainstSchema(modelData.model, schemaPath);

    // Set $schema and write (bypass normal writeModelFile validation since we want warnings not errors)
    modelData['$schema'] = input.schema_path;
    fs.writeFileSync(fullModelPath, JSON.stringify(modelData, null, 2) + '\n', 'utf8');

    const response: Record<string, unknown> = {
      success: true,
      message: `Set $schema to ${input.schema_path}`,
    };

    if (warnings.length > 0) {
      response.validation_warnings = warnings;
      response.message = `Set $schema to ${input.schema_path} (${warnings.length} validation warning(s))`;
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: errorMessage }, null, 2) }],
    };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "clay_model_set_schema"`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add mcp/tools/model-set-schema.ts test/mcp-model-crud.test.ts
git commit -m "feat: add clay_model_set_schema MCP tool"
```

---

### Task 10: Register all 6 tools in MCP server index.ts

**Files:**
- Modify: `mcp/index.ts`
- Modify: `test/mcp-server.test.ts` (update tool count from 8 to 14)

**Step 1: Update the tool count test**

In `test/mcp-server.test.ts`, change the assertion:

```typescript
// Change this line:
expect(tools.length).to.equal(8);
// To:
expect(tools.length).to.equal(14);
```

And add expectations for the new tools:

```typescript
expect(toolNames).to.include('clay_model_query');
expect(toolNames).to.include('clay_model_add');
expect(toolNames).to.include('clay_model_update');
expect(toolNames).to.include('clay_model_delete');
expect(toolNames).to.include('clay_model_rename');
expect(toolNames).to.include('clay_model_set_schema');
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "should list"`

Expected: FAIL — still 8 tools

**Step 3: Register tools in index.ts**

Add imports at the top of `mcp/index.ts` (after existing tool imports):

```typescript
import { modelQueryTool } from './tools/model-query.js';
import { modelAddTool } from './tools/model-add.js';
import { modelUpdateTool } from './tools/model-update.js';
import { modelDeleteTool } from './tools/model-delete.js';
import { modelRenameTool } from './tools/model-rename.js';
import { modelSetSchemaTool } from './tools/model-set-schema.js';
```

Add 6 tool definitions to the `tools` array in `ListToolsRequestSchema` handler (after the existing `clay_explain_concepts` entry):

```typescript
        {
          name: 'clay_model_query',
          description:
            'Query model data using JSONPath. Returns only matched items, keeping context small. Use this instead of reading the entire model file.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              json_path: {
                type: 'string',
                description: 'JSONPath expression (e.g., "$.model.entities[?(@.name==\'User\')]")',
              },
            },
            required: ['model_path', 'json_path'],
          },
        },
        {
          name: 'clay_model_add',
          description:
            'Add an item to an array or property to an object in a model file. Appends to arrays, merges into objects. Validates against $schema if present.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              json_path: {
                type: 'string',
                description: 'JSONPath to the target array or object (e.g., "$.model.entities")',
              },
              value: {
                description: 'Value to add: appended if target is array, merged if target is object',
              },
            },
            required: ['model_path', 'json_path', 'value'],
          },
        },
        {
          name: 'clay_model_update',
          description:
            'Update fields on all items matched by JSONPath. Merges provided fields into each match. Validates against $schema if present.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              json_path: {
                type: 'string',
                description: 'JSONPath expression matching items to update',
              },
              fields: {
                type: 'object',
                description: 'Fields to merge into each matched item',
              },
            },
            required: ['model_path', 'json_path', 'fields'],
          },
        },
        {
          name: 'clay_model_delete',
          description:
            'Remove items matched by JSONPath from their parent arrays or objects. Validates against $schema if present.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              json_path: {
                type: 'string',
                description: 'JSONPath expression matching items to remove',
              },
            },
            required: ['model_path', 'json_path'],
          },
        },
        {
          name: 'clay_model_rename',
          description:
            'Rename a property key across all items matched by JSONPath. Validates against $schema if present.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              json_path: {
                type: 'string',
                description: 'JSONPath expression matching items whose property to rename',
              },
              old_name: {
                type: 'string',
                description: 'Current property name to rename',
              },
              new_name: {
                type: 'string',
                description: 'New property name',
              },
            },
            required: ['model_path', 'json_path', 'old_name', 'new_name'],
          },
        },
        {
          name: 'clay_model_set_schema',
          description:
            'Set or update the $schema reference on a model file. Validates current model against the schema and warns of violations.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              schema_path: {
                type: 'string',
                description: 'Path to JSON Schema file (relative to model file or absolute)',
              },
            },
            required: ['model_path', 'schema_path'],
          },
        },
```

Add 6 cases to the `switch` in `CallToolRequestSchema` handler:

```typescript
          case 'clay_model_query':
            return await modelQueryTool(args || {});
          case 'clay_model_add':
            return await modelAddTool(args || {});
          case 'clay_model_update':
            return await modelUpdateTool(args || {});
          case 'clay_model_delete':
            return await modelDeleteTool(args || {});
          case 'clay_model_rename':
            return await modelRenameTool(args || {});
          case 'clay_model_set_schema':
            return await modelSetSchemaTool(args || {});
```

**Step 4: Build MCP to verify compilation**

Run: `cd /Users/morten/src/opensource/clay/mcp && npm run build`

Expected: Build succeeds

**Step 5: Run all tests**

Run: `cd /Users/morten/src/opensource/clay && npm test`

Expected: All tests PASS

**Step 6: Commit**

```bash
git add mcp/index.ts test/mcp-server.test.ts
git commit -m "feat: register 6 model CRUD tools in MCP server"
```

---

### Task 11: Final verification and build

**Step 1: Run full test suite**

Run: `cd /Users/morten/src/opensource/clay && npm test`

Expected: All tests PASS

**Step 2: Full build (root)**

Run: `cd /Users/morten/src/opensource/clay && npm run build`

Expected: Build succeeds

**Step 3: Verify MCP server starts**

Run: `cd /Users/morten/src/opensource/clay && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | timeout 5 node bin/clay-mcp 2>/dev/null || true`

Expected: JSON response with server info

**Step 4: Commit (if any lint/format fixes needed)**

```bash
git add -A && git commit -m "chore: final build verification for model CRUD tools"
```
