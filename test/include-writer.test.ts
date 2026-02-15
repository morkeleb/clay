/**
 * Tests for include-writer helpers (traceToSource, readIncludeFile, writeIncludeFile)
 * Note: Uses `any` types for test data
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadWithIncludeMap } from '../src/model';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jp = require('jsonpath');

/* ------------------------------------------------------------------ */
/*  Inline CJS-compatible copies of include-writer helpers            */
/* ------------------------------------------------------------------ */

function traceToSource(
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

  const relativePath: (string | number)[] = ['$', ...targetPath.slice(lastIncludeIdx + 1)];
  return { filePath: lastIncludeFile, relativePath };
}

function readIncludeFile(filePath: string): Record<string, unknown> {
  const content = fs.readFileSync(path.resolve(filePath), 'utf-8');
  return JSON.parse(content);
}

function writeIncludeFile(filePath: string, data: unknown): void {
  fs.writeFileSync(
    path.resolve(filePath),
    JSON.stringify(data, null, 2) + '\n',
    'utf-8'
  );
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('include-writer helpers', function () {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-include-writer-'));
  });

  afterEach(() => {
    // Clean up require cache for files in tmpDir
    for (const key of Object.keys(require.cache)) {
      if (key.startsWith(tmpDir)) {
        delete require.cache[key];
      }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /* ---------- traceToSource ---------- */

  describe('traceToSource', () => {
    it('returns null filePath for targets in the main model', () => {
      const modelFile = path.join(tmpDir, 'model.json');
      fs.writeFileSync(
        modelFile,
        JSON.stringify({
          name: 'test',
          generators: ['docs'],
          model: {
            types: [{ name: 'order', fields: [{ name: 'total' }] }],
          },
        })
      );

      const { model, includeMap } = loadWithIncludeMap(modelFile);

      // Path to types[0] (the order entity)
      const targetPath = ['$', 'types', 0];
      const result = traceToSource(model.model as Record<string, unknown>, includeMap, targetPath);

      expect(result.filePath).to.be.null;
      expect(result.relativePath).to.deep.equal(targetPath);
    });

    it('returns included file path for targets that ARE the included object', () => {
      const entitiesDir = path.join(tmpDir, 'entities');
      fs.mkdirSync(entitiesDir);

      const orderFile = path.join(entitiesDir, 'order.json');
      fs.writeFileSync(
        orderFile,
        JSON.stringify({ name: 'order', fields: [{ name: 'total' }] })
      );

      const modelFile = path.join(tmpDir, 'model.json');
      fs.writeFileSync(
        modelFile,
        JSON.stringify({
          name: 'test',
          generators: ['docs'],
          model: {
            types: [{ include: 'entities/order.json' }],
          },
        })
      );

      const { model, includeMap } = loadWithIncludeMap(modelFile);

      // Path to types[0] which is the included object itself
      const targetPath = ['$', 'types', 0];
      const result = traceToSource(model.model as Record<string, unknown>, includeMap, targetPath);

      expect(result.filePath).to.equal(path.resolve(orderFile));
      // relativePath should be just '$' since the target IS the included object
      expect(result.relativePath).to.deep.equal(['$']);
    });

    it('returns relative path within included file for nested targets', () => {
      const entitiesDir = path.join(tmpDir, 'entities');
      fs.mkdirSync(entitiesDir);

      const orderFile = path.join(entitiesDir, 'order.json');
      fs.writeFileSync(
        orderFile,
        JSON.stringify({ name: 'order', fields: [{ name: 'total' }] })
      );

      const modelFile = path.join(tmpDir, 'model.json');
      fs.writeFileSync(
        modelFile,
        JSON.stringify({
          name: 'test',
          generators: ['docs'],
          model: {
            types: [{ include: 'entities/order.json' }],
          },
        })
      );

      const { model, includeMap } = loadWithIncludeMap(modelFile);

      // Path to types[0].fields (a property inside the included object)
      const targetPath = ['$', 'types', 0, 'fields'];
      const result = traceToSource(model.model as Record<string, unknown>, includeMap, targetPath);

      expect(result.filePath).to.equal(path.resolve(orderFile));
      expect(result.relativePath).to.deep.equal(['$', 'fields']);
    });
  });

  /* ---------- full workflow: add field to included entity ---------- */

  describe('full mutation workflow', () => {
    let modelFile: string;
    let orderFile: string;

    beforeEach(() => {
      const entitiesDir = path.join(tmpDir, 'entities');
      fs.mkdirSync(entitiesDir);

      orderFile = path.join(entitiesDir, 'order.json');
      fs.writeFileSync(
        orderFile,
        JSON.stringify({
          name: 'order',
          fields: [{ name: 'total', type: 'number' }],
        })
      );

      modelFile = path.join(tmpDir, 'model.json');
      fs.writeFileSync(
        modelFile,
        JSON.stringify({
          name: 'test',
          generators: ['docs'],
          model: {
            types: [{ include: 'entities/order.json' }],
          },
        })
      );
    });

    it('can add a field to an included entity file', () => {
      const { model, includeMap } = loadWithIncludeMap(modelFile);

      // Query expanded model for the fields array
      const fieldsPath = ['$', 'types', 0, 'fields'];
      const trace = traceToSource(model.model as Record<string, unknown>, includeMap, fieldsPath);

      expect(trace.filePath).to.equal(path.resolve(orderFile));
      expect(trace.relativePath).to.deep.equal(['$', 'fields']);

      // Read the include file, mutate, write back
      const includeData = readIncludeFile(trace.filePath!);
      const fields = jp.query(includeData, jp.stringify(trace.relativePath));
      expect(fields).to.have.lengthOf(1);

      // Add new field
      (includeData.fields as any[]).push({ name: 'currency', type: 'string' });
      writeIncludeFile(trace.filePath!, includeData);

      // Verify the written file
      const updated = readIncludeFile(trace.filePath!);
      expect((updated.fields as any[]).length).to.equal(2);
      expect((updated.fields as any[])[1].name).to.equal('currency');
    });

    it('can update a property in an included entity file', () => {
      const { model, includeMap } = loadWithIncludeMap(modelFile);

      // Trace to the 'name' property inside the included entity
      const namePath = ['$', 'types', 0, 'name'];
      const trace = traceToSource(model.model as Record<string, unknown>, includeMap, namePath);

      expect(trace.filePath).to.equal(path.resolve(orderFile));
      expect(trace.relativePath).to.deep.equal(['$', 'name']);

      // Read include, update name, write back
      const includeData = readIncludeFile(trace.filePath!);
      includeData.name = 'purchase_order';
      writeIncludeFile(trace.filePath!, includeData);

      // Verify
      const updated = readIncludeFile(trace.filePath!);
      expect(updated.name).to.equal('purchase_order');
    });

    it('can delete from an included entity file', () => {
      const { model, includeMap } = loadWithIncludeMap(modelFile);

      // Trace to fields[0] inside the included entity
      const fieldPath = ['$', 'types', 0, 'fields', 0];
      const trace = traceToSource(model.model as Record<string, unknown>, includeMap, fieldPath);

      expect(trace.filePath).to.equal(path.resolve(orderFile));
      expect(trace.relativePath).to.deep.equal(['$', 'fields', 0]);

      // Read include, delete the first field, write back
      const includeData = readIncludeFile(trace.filePath!);
      (includeData.fields as any[]).splice(0, 1);
      writeIncludeFile(trace.filePath!, includeData);

      // Verify
      const updated = readIncludeFile(trace.filePath!);
      expect((updated.fields as any[])).to.have.lengthOf(0);
    });

    it('main model file include reference stays unchanged after editing included file', () => {
      // Read original main model
      const originalMainModel = JSON.parse(fs.readFileSync(modelFile, 'utf-8'));
      expect(originalMainModel.model.types[0].include).to.equal('entities/order.json');

      // Load, trace, mutate the included file
      const { model, includeMap } = loadWithIncludeMap(modelFile);

      const fieldsPath = ['$', 'types', 0, 'fields'];
      const trace = traceToSource(model.model as Record<string, unknown>, includeMap, fieldsPath);

      const includeData = readIncludeFile(trace.filePath!);
      (includeData.fields as any[]).push({ name: 'status', type: 'string' });
      writeIncludeFile(trace.filePath!, includeData);

      // Re-read main model file — include reference should be untouched
      const afterMainModel = JSON.parse(fs.readFileSync(modelFile, 'utf-8'));
      expect(afterMainModel.model.types[0].include).to.equal('entities/order.json');
      expect(afterMainModel.model.types[0].fields).to.be.undefined;
    });
  });
});
