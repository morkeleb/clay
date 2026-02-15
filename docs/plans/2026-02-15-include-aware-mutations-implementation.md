# Include-Aware Mutations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make MCP mutation tools query the expanded model (includes resolved) to find targets, then trace back to the source file (main model or included file) to make the actual edit.

**Architecture:** A new `loadWithIncludeMap()` in `src/model.ts` builds a `Map<object, string>` during include resolution. A new `mcp/shared/include-writer.ts` helper uses this map to trace JSONPath targets back to their source files and apply mutations there. All 4 mutation tools switch from "query raw" to "query expanded, trace to source, edit source."

**Tech Stack:** TypeScript, jsonpath, Node.js fs

---

### Task 1: Add `loadWithIncludeMap` to core model module

**Files:**
- Modify: `src/model.ts`
- Test: `test/include-map.test.ts`

**Step 1: Write the failing tests**

Create `test/include-map.test.ts`:

```typescript
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { loadWithIncludeMap } from '../src/model';

describe('loadWithIncludeMap', function () {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-include-map-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should return empty includeMap when no includes', () => {
    const modelPath = path.join(testDir, 'model.json');
    fs.writeFileSync(modelPath, JSON.stringify({
      name: 'test',
      generators: ['gen'],
      model: { entities: [{ name: 'User' }] },
    }));

    const { model, includeMap } = loadWithIncludeMap(modelPath);
    expect(model.name).to.equal('test');
    expect(includeMap.size).to.equal(0);
  });

  it('should track included objects in the map', () => {
    // Create included entity file
    const entityFile = path.join(testDir, 'user.json');
    fs.writeFileSync(entityFile, JSON.stringify({
      name: 'User',
      fields: [{ name: 'id', type: 'string' }],
    }));

    const modelPath = path.join(testDir, 'model.json');
    fs.writeFileSync(modelPath, JSON.stringify({
      name: 'test',
      generators: ['gen'],
      model: {
        entities: [{ include: 'user.json' }],
      },
    }));

    const { model, includeMap } = loadWithIncludeMap(modelPath);

    // The entity object should be in the includeMap
    const entities = (model.model as any).entities;
    expect(entities).to.have.length(1);
    expect(entities[0].name).to.equal('User');
    expect(includeMap.has(entities[0])).to.be.true;
    expect(includeMap.get(entities[0])).to.equal(path.resolve(testDir, 'user.json'));
  });

  it('should handle multiple includes', () => {
    fs.writeFileSync(path.join(testDir, 'user.json'), JSON.stringify({
      name: 'User', fields: [],
    }));
    fs.writeFileSync(path.join(testDir, 'order.json'), JSON.stringify({
      name: 'Order', fields: [],
    }));

    const modelPath = path.join(testDir, 'model.json');
    fs.writeFileSync(modelPath, JSON.stringify({
      name: 'test',
      generators: ['gen'],
      model: {
        entities: [
          { include: 'user.json' },
          { include: 'order.json' },
        ],
      },
    }));

    const { model, includeMap } = loadWithIncludeMap(modelPath);
    expect(includeMap.size).to.equal(2);
    const entities = (model.model as any).entities;
    expect(includeMap.get(entities[0])).to.include('user.json');
    expect(includeMap.get(entities[1])).to.include('order.json');
  });

  it('should resolve nested includes', () => {
    // Create a nested include: entity includes a fields file
    fs.writeFileSync(path.join(testDir, 'user-fields.json'), JSON.stringify({
      fields: [{ name: 'id', type: 'string' }],
    }));

    fs.writeFileSync(path.join(testDir, 'user.json'), JSON.stringify({
      name: 'User',
      fieldDef: { include: 'user-fields.json' },
    }));

    const modelPath = path.join(testDir, 'model.json');
    fs.writeFileSync(modelPath, JSON.stringify({
      name: 'test',
      generators: ['gen'],
      model: {
        entities: [{ include: 'user.json' }],
      },
    }));

    const { model, includeMap } = loadWithIncludeMap(modelPath);
    // Both the entity and the nested fieldDef should be in the map
    expect(includeMap.size).to.equal(2);
    const entities = (model.model as any).entities;
    expect(includeMap.has(entities[0])).to.be.true;
    expect(includeMap.has(entities[0].fieldDef)).to.be.true;
  });

  it('should still apply mixins after includes', () => {
    fs.writeFileSync(path.join(testDir, 'user.json'), JSON.stringify({
      name: 'User',
      mixin: ['add_id'],
      fields: [],
    }));

    const modelPath = path.join(testDir, 'model.json');
    fs.writeFileSync(modelPath, JSON.stringify({
      name: 'test',
      generators: ['gen'],
      mixins: [{
        type: 'function',
        name: 'add_id',
        function: "(item) => { item.fields.push({ name: 'id', type: 'string' }) }",
      }],
      model: {
        entities: [{ include: 'user.json' }],
      },
    }));

    const { model } = loadWithIncludeMap(modelPath);
    const entities = (model.model as any).entities;
    expect(entities[0].fields).to.deep.include({ name: 'id', type: 'string' });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "loadWithIncludeMap"`

Expected: FAIL — `loadWithIncludeMap` not found

**Step 3: Write the implementation**

In `src/model.ts`, add a new version of `executeIncludes` that builds the map, and export `loadWithIncludeMap`:

```typescript
/**
 * Execute includes and build a map tracking which objects came from which files.
 * The map key is the object reference (identity), value is the resolved file path.
 */
function executeIncludesWithMap(
  model: any,
  modelPath: string
): Map<object, string> {
  const includeMap = new Map<object, string>();

  const check = (m: any): void => {
    if (m === null || m === undefined) return;

    if (Object.prototype.hasOwnProperty.call(m, 'include')) {
      const includePath = path.resolve(
        path.join(path.dirname(modelPath), m.include)
      );
      const includeData = require(includePath);

      for (const key in includeData) {
        if (Object.prototype.hasOwnProperty.call(includeData, key)) {
          m[key] = includeData[key];
        }
      }
      delete m.include;

      // Record this object as coming from the included file
      includeMap.set(m, includePath);
    }

    if (Array.isArray(m)) {
      for (let index = 0; index < m.length; index++) {
        const element = m[index];
        if (typeof element === 'object' && element !== null) {
          check(element);
        }
      }
    }

    for (const property in m) {
      if (Object.prototype.hasOwnProperty.call(m, property)) {
        const e = m[property];
        if (typeof e === 'object' && e !== null) {
          check(e);
        }
      }
    }
  };

  for (const modelproperty in model) {
    if (Object.prototype.hasOwnProperty.call(model, modelproperty)) {
      const element = model[modelproperty];
      check(element);
    }
  }

  return includeMap;
}

/**
 * Load a Clay model and build an include map tracking which objects came from included files.
 * Used by MCP mutation tools to trace JSONPath targets back to source files.
 */
export function loadWithIncludeMap(modelPath: string): {
  model: ClayModel;
  includeMap: Map<object, string>;
} {
  const resolvedPath = path.resolve(modelPath);
  const model = requireNew(resolvedPath) as ClayModel;

  const includeMap = executeIncludesWithMap(model, modelPath);
  executeMixins(model);

  return { model, includeMap };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "loadWithIncludeMap"`

Expected: All 5 tests PASS

**Step 5: Build**

Run: `cd /Users/morten/src/opensource/clay && npm run build`

Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/model.ts test/include-map.test.ts
git commit -m "feat: add loadWithIncludeMap for include-aware mutations"
```

---

### Task 2: Create include-writer helper for MCP

**Files:**
- Create: `mcp/shared/include-writer.ts`
- Modify: `mcp/shared/model-file.ts`
- Test: `test/include-writer.test.ts`

**Step 1: Write the failing tests**

Create `test/include-writer.test.ts`:

```typescript
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jp = require('jsonpath');

import { loadWithIncludeMap } from '../src/model';

/**
 * CJS-compatible reimplementation of the include-writer traceToSource logic.
 *
 * Given an expanded model, an include map, and a JSONPath target path array,
 * determines which file the target lives in and the relative path within that file.
 */
function traceToSource(
  expandedModel: Record<string, unknown>,
  includeMap: Map<object, string>,
  targetPath: (string | number)[]
): { filePath: string | null; relativePath: (string | number)[] } {
  // Walk down the path, checking each object against the include map
  let current: any = expandedModel;
  let lastIncludeIdx = -1;
  let lastIncludeFile: string | null = null;

  for (let i = 1; i < targetPath.length; i++) {
    current = current[targetPath[i]];
    if (current !== null && typeof current === 'object' && includeMap.has(current)) {
      lastIncludeIdx = i;
      lastIncludeFile = includeMap.get(current)!;
    }
  }

  if (lastIncludeFile === null) {
    return { filePath: null, relativePath: targetPath };
  }

  // The relative path is everything after the included object
  const relativePath = ['$', ...targetPath.slice(lastIncludeIdx + 1)];
  return { filePath: lastIncludeFile, relativePath };
}

describe('include-writer', function () {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-include-writer-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('traceToSource', () => {
    it('should return null filePath for targets in the main model', () => {
      const modelPath = path.join(testDir, 'model.json');
      fs.writeFileSync(modelPath, JSON.stringify({
        name: 'test',
        generators: ['gen'],
        model: { entities: [{ name: 'User', fields: [] }] },
      }));

      const { model, includeMap } = loadWithIncludeMap(modelPath);
      const paths = jp.paths(model, '$.model.entities[0]');
      const result = traceToSource(model as any, includeMap, paths[0]);
      expect(result.filePath).to.be.null;
    });

    it('should return included file path for targets in included objects', () => {
      fs.writeFileSync(path.join(testDir, 'user.json'), JSON.stringify({
        name: 'User',
        fields: [{ name: 'id', type: 'string' }],
      }));

      const modelPath = path.join(testDir, 'model.json');
      fs.writeFileSync(modelPath, JSON.stringify({
        name: 'test',
        generators: ['gen'],
        model: { entities: [{ include: 'user.json' }] },
      }));

      const { model, includeMap } = loadWithIncludeMap(modelPath);

      // Target the entity itself
      const entityPaths = jp.paths(model, '$.model.entities[0]');
      const entityResult = traceToSource(model as any, includeMap, entityPaths[0]);
      expect(entityResult.filePath).to.include('user.json');
      expect(entityResult.relativePath).to.deep.equal(['$']);
    });

    it('should return relative path within included file for nested targets', () => {
      fs.writeFileSync(path.join(testDir, 'user.json'), JSON.stringify({
        name: 'User',
        fields: [{ name: 'id', type: 'string' }],
      }));

      const modelPath = path.join(testDir, 'model.json');
      fs.writeFileSync(modelPath, JSON.stringify({
        name: 'test',
        generators: ['gen'],
        model: { entities: [{ include: 'user.json' }] },
      }));

      const { model, includeMap } = loadWithIncludeMap(modelPath);

      // Target the fields array inside the included entity
      const fieldsPaths = jp.paths(model, '$.model.entities[0].fields');
      const fieldsResult = traceToSource(model as any, includeMap, fieldsPaths[0]);
      expect(fieldsResult.filePath).to.include('user.json');
      expect(fieldsResult.relativePath).to.deep.equal(['$', 'fields']);
    });
  });

  describe('writing to included files', () => {
    it('should add a field to an included entity file', () => {
      fs.writeFileSync(path.join(testDir, 'user.json'), JSON.stringify({
        name: 'User',
        fields: [{ name: 'id', type: 'string' }],
      }));

      const modelPath = path.join(testDir, 'model.json');
      fs.writeFileSync(modelPath, JSON.stringify({
        name: 'test',
        generators: ['gen'],
        model: { entities: [{ include: 'user.json' }] },
      }));

      const { model, includeMap } = loadWithIncludeMap(modelPath);

      // Find the fields array
      const targets = jp.query(model, '$.model.entities[0].fields');
      const targetPaths = jp.paths(model, '$.model.entities[0].fields');
      const trace = traceToSource(model as any, includeMap, targetPaths[0]);

      // The target is the fields array inside user.json
      expect(trace.filePath).to.include('user.json');

      // Simulate writing: read include file, apply mutation, write back
      const includeData = JSON.parse(fs.readFileSync(trace.filePath!, 'utf-8'));
      const relTarget = jp.query(includeData, jp.stringify(trace.relativePath));
      relTarget[0].push({ name: 'email', type: 'string' });
      fs.writeFileSync(trace.filePath!, JSON.stringify(includeData, null, 2) + '\n');

      // Verify the included file was updated
      const updated = JSON.parse(fs.readFileSync(trace.filePath!, 'utf-8'));
      expect(updated.fields).to.have.length(2);
      expect(updated.fields[1].name).to.equal('email');

      // Verify main model file is unchanged
      const mainModel = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
      expect(mainModel.model.entities[0]).to.have.property('include', 'user.json');
    });

    it('should update a field in an included entity file', () => {
      fs.writeFileSync(path.join(testDir, 'user.json'), JSON.stringify({
        name: 'User',
        fields: [{ name: 'id', type: 'string' }],
      }));

      const modelPath = path.join(testDir, 'model.json');
      fs.writeFileSync(modelPath, JSON.stringify({
        name: 'test',
        generators: ['gen'],
        model: { entities: [{ include: 'user.json' }] },
      }));

      const { model, includeMap } = loadWithIncludeMap(modelPath);

      // Find the entity
      const targetPaths = jp.paths(model, '$.model.entities[0]');
      const trace = traceToSource(model as any, includeMap, targetPaths[0]);

      // Update the entity's name in the included file
      const includeData = JSON.parse(fs.readFileSync(trace.filePath!, 'utf-8'));
      const relTarget = jp.query(includeData, jp.stringify(trace.relativePath));
      Object.assign(relTarget[0], { description: 'A user entity' });
      fs.writeFileSync(trace.filePath!, JSON.stringify(includeData, null, 2) + '\n');

      const updated = JSON.parse(fs.readFileSync(trace.filePath!, 'utf-8'));
      expect(updated.description).to.equal('A user entity');
      expect(updated.name).to.equal('User');
    });

    it('should delete from an included entity file', () => {
      fs.writeFileSync(path.join(testDir, 'user.json'), JSON.stringify({
        name: 'User',
        fields: [{ name: 'id', type: 'string' }, { name: 'email', type: 'string' }],
      }));

      const modelPath = path.join(testDir, 'model.json');
      fs.writeFileSync(modelPath, JSON.stringify({
        name: 'test',
        generators: ['gen'],
        model: { entities: [{ include: 'user.json' }] },
      }));

      const { model, includeMap } = loadWithIncludeMap(modelPath);

      // Find the second field
      const targetPaths = jp.paths(model, '$.model.entities[0].fields[1]');
      const trace = traceToSource(model as any, includeMap, targetPaths[0]);

      expect(trace.filePath).to.include('user.json');
      expect(trace.relativePath).to.deep.equal(['$', 'fields', 1]);

      // Delete it
      const includeData = JSON.parse(fs.readFileSync(trace.filePath!, 'utf-8'));
      includeData.fields.splice(1, 1);
      fs.writeFileSync(trace.filePath!, JSON.stringify(includeData, null, 2) + '\n');

      const updated = JSON.parse(fs.readFileSync(trace.filePath!, 'utf-8'));
      expect(updated.fields).to.have.length(1);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "include-writer"`

Expected: PASS (these tests use `loadWithIncludeMap` from Task 1 plus inline helper logic)

Actually these tests should pass since they use inline `traceToSource`. But they validate the algorithm.

**Step 3: Add `readExpandedModelWithIncludeMap` to `mcp/shared/model-file.ts`**

Add after the existing `readExpandedModel` function:

```typescript
/**
 * Uses Clay's model.loadWithIncludeMap() to resolve includes (with tracking) and apply mixins.
 * Returns the expanded model plus a map of object references to their source file paths.
 */
export function readExpandedModelWithIncludeMap(modelPath: string): {
  model: { name: string; generators: string[]; mixins?: unknown[]; model: Record<string, unknown> };
  includeMap: Map<object, string>;
} {
  const clayModel = require('../../dist/src/model.js');
  return clayModel.loadWithIncludeMap(modelPath);
}
```

**Step 4: Create `mcp/shared/include-writer.ts`**

```typescript
/**
 * Include-aware mutation helper.
 * Traces JSONPath targets back to source files (main model or included files)
 * and applies mutations to the correct file.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import jp from 'jsonpath';

/**
 * Given an expanded model, an include map, and a JSONPath target path array,
 * determines which file the target lives in and the relative path within that file.
 *
 * Returns:
 * - filePath: the included file path, or null if the target is in the main model
 * - relativePath: the JSONPath components within the source file (starts with '$')
 */
export function traceToSource(
  expandedModel: Record<string, unknown>,
  includeMap: Map<object, string>,
  targetPath: (string | number)[]
): { filePath: string | null; relativePath: (string | number)[] } {
  let current: any = expandedModel;
  let lastIncludeIdx = -1;
  let lastIncludeFile: string | null = null;

  for (let i = 1; i < targetPath.length; i++) {
    current = current[targetPath[i]];
    if (current !== null && typeof current === 'object' && includeMap.has(current)) {
      lastIncludeIdx = i;
      lastIncludeFile = includeMap.get(current)!;
    }
  }

  if (lastIncludeFile === null) {
    return { filePath: null, relativePath: targetPath };
  }

  const relativePath = ['$', ...targetPath.slice(lastIncludeIdx + 1)];
  return { filePath: lastIncludeFile, relativePath };
}

/**
 * Read an included JSON file and return parsed data.
 */
export function readIncludeFile(filePath: string): Record<string, unknown> {
  const content = fs.readFileSync(path.resolve(filePath), 'utf-8');
  return JSON.parse(content);
}

/**
 * Write an included JSON file as formatted JSON.
 */
export function writeIncludeFile(filePath: string, data: unknown): void {
  fs.writeFileSync(
    path.resolve(filePath),
    JSON.stringify(data, null, 2) + '\n',
    'utf-8'
  );
}

/**
 * Resolve a JSONPath target within an included file's data.
 * relativePath is a path array starting with '$'.
 */
export function resolveInInclude(
  includeData: Record<string, unknown>,
  relativePath: (string | number)[]
): unknown[] {
  return jp.query(includeData, jp.stringify(relativePath));
}
```

**Step 5: Build**

Run: `cd /Users/morten/src/opensource/clay && npm run build`

Expected: Build succeeds (both main and MCP)

**Step 6: Commit**

```bash
git add mcp/shared/include-writer.ts mcp/shared/model-file.ts test/include-writer.test.ts
git commit -m "feat: add include-writer helper for include-aware mutations"
```

---

### Task 3: Update model-add to be include-aware

**Files:**
- Modify: `mcp/tools/model-add.ts`
- Modify: `test/mcp-model-crud.test.ts`

**Step 1: Write the failing test**

Add to `test/mcp-model-crud.test.ts` inside the `clay_model_add` describe block. First, add a new helper that simulates the include-aware add logic:

At the top of the test helpers section, add:

```typescript
  function addToModelIncludeAware(
    modelFilePath: string,
    jsonPath: string,
    value: unknown
  ) {
    const { loadWithIncludeMap } = require('../src/model');
    const { model, includeMap } = loadWithIncludeMap(modelFilePath);

    let targets: unknown[];
    let targetPaths: (string | number)[][];
    try {
      targets = jp.query(model, jsonPath);
      targetPaths = jp.paths(model, jsonPath);
    } catch (e: unknown) {
      return { success: false, message: `Invalid JSONPath: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (targets.length === 0) return { success: false, message: `No items matched JSONPath: ${jsonPath}` };

    const target = targets[0];
    const targetPathArr = targetPaths[0];

    // Trace to source file
    let lastIncludeIdx = -1;
    let lastIncludeFile: string | null = null;
    let current: any = model;
    for (let i = 1; i < targetPathArr.length; i++) {
      current = current[targetPathArr[i]];
      if (current !== null && typeof current === 'object' && includeMap.has(current)) {
        lastIncludeIdx = i;
        lastIncludeFile = includeMap.get(current)!;
      }
    }

    let sourceFile: string | undefined;
    if (lastIncludeFile) {
      // Edit the included file
      const relativePath = ['$', ...targetPathArr.slice(lastIncludeIdx + 1)];
      const includeData = JSON.parse(fs.readFileSync(lastIncludeFile, 'utf-8'));
      const relTargets = jp.query(includeData, jp.stringify(relativePath));
      if (relTargets.length === 0) return { success: false, message: 'Target not found in included file' };
      const relTarget = relTargets[0];
      if (Array.isArray(relTarget)) relTarget.push(value);
      else if (typeof relTarget === 'object' && relTarget !== null) Object.assign(relTarget, value);
      else return { success: false, message: 'Target is not array or object' };
      fs.writeFileSync(lastIncludeFile, JSON.stringify(includeData, null, 2) + '\n');
      sourceFile = lastIncludeFile;
    } else {
      // Edit the main model file (raw)
      const rawData = readModelFile(modelFilePath);
      const rawTargets = jp.query(rawData, jsonPath);
      if (rawTargets.length === 0) return { success: false, message: 'Target not found in raw model' };
      const rawTarget = rawTargets[0];
      if (Array.isArray(rawTarget)) rawTarget.push(value);
      else if (typeof rawTarget === 'object' && rawTarget !== null) Object.assign(rawTarget, value);
      else return { success: false, message: 'Target is not array or object' };
      writeModelFile(modelFilePath, rawData);
    }

    const response: any = { success: true, message: `Added value at ${jsonPath}`, path: jsonPath };
    if (sourceFile) response.source_file = sourceFile;
    return response;
  }
```

Then add the test:

```typescript
    it('should add a field to an entity in an included file', () => {
      // Create included entity
      const userFile = path.join(testDir, 'user.json');
      fs.writeFileSync(userFile, JSON.stringify({
        name: 'User',
        fields: [{ name: 'id', type: 'string' }],
      }));

      // Create model with include
      const inclModelPath = path.join(testDir, 'incl-model.json');
      fs.writeFileSync(inclModelPath, JSON.stringify({
        name: 'test',
        generators: ['gen'],
        model: { entities: [{ include: 'user.json' }] },
      }));

      const result = addToModelIncludeAware(
        inclModelPath,
        '$.model.entities[?(@.name=="User")].fields',
        { name: 'email', type: 'string' }
      );
      expect(result.success).to.be.true;
      expect(result.source_file).to.include('user.json');

      // Verify the included file was updated
      const updatedUser = JSON.parse(fs.readFileSync(userFile, 'utf-8'));
      expect(updatedUser.fields).to.have.length(2);
      expect(updatedUser.fields[1].name).to.equal('email');

      // Verify main model file still has the include reference
      const mainModel = JSON.parse(fs.readFileSync(inclModelPath, 'utf-8'));
      expect(mainModel.model.entities[0]).to.have.property('include', 'user.json');
    });

    it('should still add to main model when no includes involved', () => {
      const result = addToModelIncludeAware(
        modelPath,
        '$.model.entities',
        { name: 'Comment', fields: [] }
      );
      expect(result.success).to.be.true;
      expect(result.source_file).to.be.undefined;

      const data = readModelFile(modelPath);
      expect((data.model as any).entities).to.have.length(3);
    });
```

**Step 2: Run tests to verify they pass**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "included file"`

Expected: PASS

**Step 3: Rewrite `mcp/tools/model-add.ts`**

Replace the entire tool implementation:

```typescript
/**
 * clay_model_add tool - Add items to arrays or properties to objects at a JSONPath location.
 * Include-aware: queries the expanded model, traces targets back to source files.
 */
import { validateInput } from '../shared/validation.js';
import { ModelAddInputSchema } from '../shared/schemas.js';
import { readModelFile, writeModelFile, readExpandedModelWithIncludeMap } from '../shared/model-file.js';
import { traceToSource, readIncludeFile, writeIncludeFile, resolveInInclude } from '../shared/include-writer.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';
import { checkConventions } from '../shared/conventions.js';

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

    // Load expanded model with include tracking
    const { model: expandedModel, includeMap } = readExpandedModelWithIncludeMap(fullModelPath);

    let targets: unknown[];
    let targetPaths: (string | number)[][];
    try {
      targets = jp.query(expandedModel, input.json_path);
      targetPaths = jp.paths(expandedModel, input.json_path);
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
    const targetPath = targetPaths[0];

    // Trace target to source file
    const { filePath: includeFile, relativePath } = traceToSource(
      expandedModel as unknown as Record<string, unknown>,
      includeMap,
      targetPath
    );

    let sourceFile: string | undefined;

    if (includeFile) {
      // Edit the included file
      const includeData = readIncludeFile(includeFile);
      const relTargets = resolveInInclude(includeData, relativePath);
      if (relTargets.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: false,
            message: 'Target not found in included file',
          }, null, 2) }],
        };
      }
      const relTarget = relTargets[0];
      if (Array.isArray(relTarget)) {
        relTarget.push(input.value);
      } else if (typeof relTarget === 'object' && relTarget !== null) {
        Object.assign(relTarget, input.value);
      } else {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: false,
            message: 'Target is not an array or object',
          }, null, 2) }],
        };
      }
      writeIncludeFile(includeFile, includeData);
      sourceFile = includeFile;
    } else {
      // Edit the main model file (raw, preserving includes)
      const modelData = readModelFile(fullModelPath);
      let rawTargets: unknown[];
      try {
        rawTargets = jp.query(modelData, input.json_path);
      } catch {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: false,
            message: 'Target not found in raw model file',
          }, null, 2) }],
        };
      }
      if (rawTargets.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: false,
            message: `No items matched in raw model: ${input.json_path}`,
          }, null, 2) }],
        };
      }
      const rawTarget = rawTargets[0];
      if (Array.isArray(rawTarget)) {
        rawTarget.push(input.value);
      } else if (typeof rawTarget === 'object' && rawTarget !== null) {
        Object.assign(rawTarget, input.value);
      } else {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: false,
            message: 'Target is not an array or object',
          }, null, 2) }],
        };
      }
      writeModelFile(fullModelPath, modelData);
    }

    // Check conventions (warnings only)
    let conventionViolations: Array<{ generator: string; convention: string; errors: string[] }> | undefined;
    try {
      const violations = checkConventions(fullModelPath, context.workingDirectory);
      if (violations.length > 0) {
        conventionViolations = violations;
      }
    } catch {
      // Convention checking is best-effort
    }

    const response: Record<string, unknown> = {
      success: true,
      message: `Added value at ${input.json_path}`,
      path: input.json_path,
    };
    if (sourceFile) {
      response.source_file = sourceFile;
    }
    if (conventionViolations) {
      response.convention_violations = conventionViolations;
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

**Step 4: Build MCP**

Run: `cd /Users/morten/src/opensource/clay && npm run build`

Expected: Build succeeds

**Step 5: Run all tests**

Run: `cd /Users/morten/src/opensource/clay && npm test`

Expected: All tests pass

**Step 6: Commit**

```bash
git add mcp/tools/model-add.ts test/mcp-model-crud.test.ts
git commit -m "feat: make model-add include-aware"
```

---

### Task 4: Update model-update to be include-aware

**Files:**
- Modify: `mcp/tools/model-update.ts`
- Modify: `test/mcp-model-crud.test.ts`

**Step 1: Write the failing test**

Add a helper and test to `test/mcp-model-crud.test.ts`:

```typescript
  function updateInModelIncludeAware(
    modelFilePath: string,
    jsonPath: string,
    fields: Record<string, unknown>
  ) {
    const { loadWithIncludeMap } = require('../src/model');
    const { model, includeMap } = loadWithIncludeMap(modelFilePath);

    let matches: unknown[];
    let matchPaths: (string | number)[][];
    try {
      matches = jp.query(model, jsonPath);
      matchPaths = jp.paths(model, jsonPath);
    } catch (e: unknown) {
      return { success: false, message: `Invalid JSONPath: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (matches.length === 0) return { success: false, message: `No items matched JSONPath: ${jsonPath}` };

    // Group targets by source file
    const fileEdits = new Map<string, { data: any; targets: { relativePath: (string | number)[] }[] }>();
    const mainFileTargetPaths: (string | number)[][] = [];
    const filesModified = new Set<string>();
    let updated = 0;

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      if (typeof match !== 'object' || match === null || Array.isArray(match)) continue;

      let current: any = model;
      let lastIncludeIdx = -1;
      let lastIncludeFile: string | null = null;
      for (let j = 1; j < matchPaths[i].length; j++) {
        current = current[matchPaths[i][j]];
        if (current !== null && typeof current === 'object' && includeMap.has(current)) {
          lastIncludeIdx = j;
          lastIncludeFile = includeMap.get(current)!;
        }
      }

      if (lastIncludeFile) {
        const relativePath = ['$', ...matchPaths[i].slice(lastIncludeIdx + 1)];
        if (!fileEdits.has(lastIncludeFile)) {
          fileEdits.set(lastIncludeFile, {
            data: JSON.parse(fs.readFileSync(lastIncludeFile, 'utf-8')),
            targets: [],
          });
        }
        fileEdits.get(lastIncludeFile)!.targets.push({ relativePath });
        filesModified.add(path.basename(lastIncludeFile));
      } else {
        mainFileTargetPaths.push(matchPaths[i]);
        filesModified.add(path.basename(modelFilePath));
      }
    }

    // Apply to included files
    for (const [filePath, edit] of fileEdits) {
      for (const t of edit.targets) {
        const relTargets = jp.query(edit.data, jp.stringify(t.relativePath));
        if (relTargets.length > 0 && typeof relTargets[0] === 'object') {
          Object.assign(relTargets[0], fields);
          updated++;
        }
      }
      fs.writeFileSync(filePath, JSON.stringify(edit.data, null, 2) + '\n');
    }

    // Apply to main file
    if (mainFileTargetPaths.length > 0) {
      const rawData = readModelFile(modelFilePath);
      const rawMatches = jp.query(rawData, jsonPath);
      for (const m of rawMatches) {
        if (typeof m === 'object' && m !== null && !Array.isArray(m)) {
          Object.assign(m, fields);
          updated++;
        }
      }
      writeModelFile(modelFilePath, rawData);
    }

    const response: any = { success: true, message: `Updated ${updated} item(s) at ${jsonPath}`, matched: updated };
    if (filesModified.size > 1) response.files_modified = [...filesModified];
    return response;
  }
```

Tests:

```typescript
    it('should update an entity in an included file', () => {
      const userFile = path.join(testDir, 'user.json');
      fs.writeFileSync(userFile, JSON.stringify({
        name: 'User',
        fields: [{ name: 'id', type: 'string' }],
      }));

      const inclModelPath = path.join(testDir, 'incl-model.json');
      fs.writeFileSync(inclModelPath, JSON.stringify({
        name: 'test',
        generators: ['gen'],
        model: { entities: [{ include: 'user.json' }] },
      }));

      const result = updateInModelIncludeAware(
        inclModelPath,
        '$.model.entities[?(@.name=="User")]',
        { description: 'A user' }
      );
      expect(result.success).to.be.true;
      expect(result.matched).to.equal(1);

      const updatedUser = JSON.parse(fs.readFileSync(userFile, 'utf-8'));
      expect(updatedUser.description).to.equal('A user');
      expect(updatedUser.name).to.equal('User');
    });
```

**Step 2: Run test**

Run: `cd /Users/morten/src/opensource/clay && npm test -- --grep "included file"`

Expected: PASS

**Step 3: Rewrite `mcp/tools/model-update.ts`**

Apply the same include-aware pattern as model-add: load expanded with include map, query expanded, trace each match, group by source file, apply edits.

```typescript
/**
 * clay_model_update tool - Update fields on items matched by JSONPath.
 * Include-aware: queries the expanded model, traces targets back to source files.
 */
import { validateInput } from '../shared/validation.js';
import { ModelUpdateInputSchema } from '../shared/schemas.js';
import { readModelFile, writeModelFile, readExpandedModelWithIncludeMap } from '../shared/model-file.js';
import { traceToSource, readIncludeFile, writeIncludeFile, resolveInInclude } from '../shared/include-writer.js';
import { resolvePath, getWorkspaceContext } from '../shared/workspace-manager.js';
import jp from 'jsonpath';
import { checkConventions } from '../shared/conventions.js';

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
    const { model: expandedModel, includeMap } = readExpandedModelWithIncludeMap(fullModelPath);

    let matches: unknown[];
    let matchPaths: (string | number)[][];
    try {
      matches = jp.query(expandedModel, input.json_path);
      matchPaths = jp.paths(expandedModel, input.json_path);
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

    // Group by source file
    const includeFileEdits = new Map<string, (string | number)[][]>();
    const mainFileMatches: number[] = [];
    let updated = 0;

    for (let i = 0; i < matches.length; i++) {
      if (typeof matches[i] !== 'object' || matches[i] === null || Array.isArray(matches[i])) continue;

      const { filePath, relativePath } = traceToSource(
        expandedModel as unknown as Record<string, unknown>,
        includeMap,
        matchPaths[i]
      );

      if (filePath) {
        if (!includeFileEdits.has(filePath)) includeFileEdits.set(filePath, []);
        includeFileEdits.get(filePath)!.push(relativePath);
      } else {
        mainFileMatches.push(i);
      }
    }

    const filesModified = new Set<string>();

    // Apply to included files
    for (const [filePath, relativePaths] of includeFileEdits) {
      const includeData = readIncludeFile(filePath);
      for (const relPath of relativePaths) {
        const relTargets = resolveInInclude(includeData, relPath);
        for (const t of relTargets) {
          if (typeof t === 'object' && t !== null && !Array.isArray(t)) {
            Object.assign(t, input.fields);
            updated++;
          }
        }
      }
      writeIncludeFile(filePath, includeData);
      filesModified.add(filePath);
    }

    // Apply to main file
    if (mainFileMatches.length > 0) {
      const modelData = readModelFile(fullModelPath);
      const rawMatches = jp.query(modelData, input.json_path);
      for (const m of rawMatches) {
        if (typeof m === 'object' && m !== null && !Array.isArray(m)) {
          Object.assign(m, input.fields);
          updated++;
        }
      }
      writeModelFile(fullModelPath, modelData);
      filesModified.add(fullModelPath);
    }

    // Check conventions
    let conventionViolations: Array<{ generator: string; convention: string; errors: string[] }> | undefined;
    try {
      const violations = checkConventions(fullModelPath, context.workingDirectory);
      if (violations.length > 0) conventionViolations = violations;
    } catch { /* best-effort */ }

    const response: Record<string, unknown> = {
      success: true,
      message: `Updated ${updated} item(s) at ${input.json_path}`,
      matched: updated,
    };
    if (filesModified.size > 1) {
      response.files_modified = [...filesModified];
    } else if (includeFileEdits.size === 1) {
      response.source_file = [...includeFileEdits.keys()][0];
    }
    if (conventionViolations) response.convention_violations = conventionViolations;

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

**Step 4: Build and test**

Run: `cd /Users/morten/src/opensource/clay && npm run build && npm test`

Expected: Build succeeds, all tests pass

**Step 5: Commit**

```bash
git add mcp/tools/model-update.ts test/mcp-model-crud.test.ts
git commit -m "feat: make model-update include-aware"
```

---

### Task 5: Update model-delete to be include-aware

**Files:**
- Modify: `mcp/tools/model-delete.ts`
- Modify: `test/mcp-model-crud.test.ts`

**Step 1: Write the failing test**

Add test to `test/mcp-model-crud.test.ts`:

```typescript
    it('should delete a field from an entity in an included file', () => {
      const userFile = path.join(testDir, 'user.json');
      fs.writeFileSync(userFile, JSON.stringify({
        name: 'User',
        fields: [{ name: 'id', type: 'string' }, { name: 'temp', type: 'string' }],
      }));

      const inclModelPath = path.join(testDir, 'incl-model.json');
      fs.writeFileSync(inclModelPath, JSON.stringify({
        name: 'test',
        generators: ['gen'],
        model: { entities: [{ include: 'user.json' }] },
      }));

      const result = deleteFromModelIncludeAware(
        inclModelPath,
        '$.model.entities[0].fields[?(@.name=="temp")]'
      );
      expect(result.success).to.be.true;
      expect(result.removed).to.equal(1);

      const updatedUser = JSON.parse(fs.readFileSync(userFile, 'utf-8'));
      expect(updatedUser.fields).to.have.length(1);
      expect(updatedUser.fields[0].name).to.equal('id');
    });

    it('should remove include reference from main model when deleting an included entity', () => {
      const userFile = path.join(testDir, 'user.json');
      fs.writeFileSync(userFile, JSON.stringify({ name: 'User', fields: [] }));

      const inclModelPath = path.join(testDir, 'incl-model.json');
      fs.writeFileSync(inclModelPath, JSON.stringify({
        name: 'test',
        generators: ['gen'],
        model: { entities: [
          { include: 'user.json' },
          { name: 'Post', fields: [] },
        ]},
      }));

      const result = deleteFromModelIncludeAware(
        inclModelPath,
        '$.model.entities[?(@.name=="User")]'
      );
      expect(result.success).to.be.true;

      // Main model should have removed the include entry
      const mainModel = JSON.parse(fs.readFileSync(inclModelPath, 'utf-8'));
      expect(mainModel.model.entities).to.have.length(1);
      expect(mainModel.model.entities[0].name).to.equal('Post');
    });
```

You'll need a `deleteFromModelIncludeAware` helper that implements the include-aware delete pattern:
- For targets INSIDE an included file (child of included object): delete from the included file
- For targets that ARE the included object itself: delete the `{ "include": "..." }` entry from the main model file's raw data

**Step 2: Implement the helper and the MCP tool update**

The delete tool needs special handling: when the target is the included object itself (i.e., the include map entry is at the exact target path), the delete removes the raw `{ "include": "..." }` entry from the main model. When the target is inside an included object, the delete operates on the included file.

Apply the same include-aware pattern to `mcp/tools/model-delete.ts` — use `jp.paths` on expanded model, trace each path, group by file, apply deletions in reverse order within each file.

For the "delete included object itself" case: find the index in the raw model's array and splice it out.

**Step 3: Build and test**

Run: `cd /Users/morten/src/opensource/clay && npm run build && npm test`

**Step 4: Commit**

```bash
git add mcp/tools/model-delete.ts test/mcp-model-crud.test.ts
git commit -m "feat: make model-delete include-aware"
```

---

### Task 6: Update model-rename to be include-aware

**Files:**
- Modify: `mcp/tools/model-rename.ts`
- Modify: `test/mcp-model-crud.test.ts`

**Step 1: Write the failing test**

```typescript
    it('should rename property on an entity in an included file', () => {
      const userFile = path.join(testDir, 'user.json');
      fs.writeFileSync(userFile, JSON.stringify({
        name: 'User',
        fields: [{ name: 'id', type: 'string' }],
      }));

      const inclModelPath = path.join(testDir, 'incl-model.json');
      fs.writeFileSync(inclModelPath, JSON.stringify({
        name: 'test',
        generators: ['gen'],
        model: { entities: [{ include: 'user.json' }] },
      }));

      const result = renameInModelIncludeAware(
        inclModelPath,
        '$.model.entities[?(@.name=="User")]',
        'fields',
        'columns'
      );
      expect(result.success).to.be.true;
      expect(result.renamed).to.equal(1);

      const updatedUser = JSON.parse(fs.readFileSync(userFile, 'utf-8'));
      expect(updatedUser).to.have.property('columns');
      expect(updatedUser).to.not.have.property('fields');
    });
```

**Step 2: Implement**

Apply the same include-aware pattern as model-update to `mcp/tools/model-rename.ts` — trace targets, rename property in the correct source file.

**Step 3: Build and test**

Run: `cd /Users/morten/src/opensource/clay && npm run build && npm test`

**Step 4: Commit**

```bash
git add mcp/tools/model-rename.ts test/mcp-model-crud.test.ts
git commit -m "feat: make model-rename include-aware"
```

---

### Task 7: Final verification

**Step 1: Run full test suite**

Run: `cd /Users/morten/src/opensource/clay && npm test`

Expected: All tests pass

**Step 2: Full build**

Run: `cd /Users/morten/src/opensource/clay && npm run build`

Expected: Build succeeds

**Step 3: Verify include-aware behavior end-to-end**

Create a temp project with included entities and verify:
1. Query finds entities in included files (already works)
2. Add to an included entity's fields writes to the included file
3. Update an included entity writes to the included file
4. Delete from an included entity writes to the included file
5. Delete an included entity removes the include reference from the main file
6. Main-file operations still work unchanged

**Step 4: Commit if any fixes needed**

```bash
git add -A && git commit -m "chore: final verification for include-aware mutations"
```
