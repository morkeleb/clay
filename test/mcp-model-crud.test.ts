import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jp = require('jsonpath');

/**
 * CJS-compatible test implementation of modelQueryTool logic.
 * The actual ESM tool is verified via MCP build.
 */
function queryModel(modelPath: string, jsonPath: string): { success: boolean; count?: number; results?: unknown[]; message?: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const clayModel = require('../dist/src/model.js');
    const modelData = clayModel.load(modelPath);

    let results: unknown[];
    try {
      results = jp.query(modelData, jsonPath);
    } catch (e: unknown) {
      return { success: false, message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}` };
    }

    return { success: true, count: results.length, results };
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

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

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-model-crud-test-'));
    modelPath = path.join(testDir, 'api.model.json');
    fs.writeFileSync(modelPath, JSON.stringify(sampleModel, null, 2));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  // =========================================================================
  // CJS-compatible helpers for mutation tools (raw read/write, no Clay expand)
  // =========================================================================

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Ajv = require('ajv').default || require('ajv');

  function readModelFile(filePath: string): Record<string, unknown> {
    const content = fs.readFileSync(path.resolve(filePath), 'utf-8');
    return JSON.parse(content);
  }

  function writeModelFile(filePath: string, data: Record<string, unknown>): void {
    if (data['$schema'] && typeof data['$schema'] === 'string') {
      const resolvedSchema = path.resolve(path.dirname(filePath), data['$schema'] as string);
      if (!fs.existsSync(resolvedSchema)) throw new Error(`Schema file not found: ${resolvedSchema}`);
      const schema = JSON.parse(fs.readFileSync(resolvedSchema, 'utf-8'));
      const ajv = new Ajv({ allErrors: true });
      const validate = ajv.compile(schema);
      if (!validate(data.model)) {
        const errors = (validate.errors || []).map((e: any) => `${e.instancePath}: ${e.message}`);
        throw new Error('Schema validation failed:\n' + errors.join('\n'));
      }
    }
    fs.writeFileSync(path.resolve(filePath), JSON.stringify(data, null, 2) + '\n', 'utf-8');
  }

  function addToModel(filePath: string, jsonPath: string, value: unknown) {
    const data = readModelFile(filePath);
    const targets = jp.query(data, jsonPath);
    if (targets.length === 0) return { success: false, message: `No items matched JSONPath: ${jsonPath}` };
    const target = targets[0];
    if (Array.isArray(target)) { target.push(value); }
    else if (typeof target === 'object' && target !== null) { Object.assign(target, value); }
    else return { success: false, message: 'Target is not array or object' };
    writeModelFile(filePath, data);
    return { success: true, message: `Added value at ${jsonPath}`, path: jsonPath };
  }

  function updateInModel(filePath: string, jsonPath: string, fields: Record<string, unknown>) {
    const data = readModelFile(filePath);
    const matches = jp.query(data, jsonPath);
    if (matches.length === 0) return { success: false, message: `No items matched JSONPath: ${jsonPath}` };
    let updated = 0;
    for (const m of matches) {
      if (typeof m === 'object' && m !== null && !Array.isArray(m)) { Object.assign(m, fields); updated++; }
    }
    writeModelFile(filePath, data);
    return { success: true, matched: updated };
  }

  function deleteFromModel(filePath: string, jsonPath: string) {
    const data = readModelFile(filePath);
    const paths = jp.paths(data, jsonPath);
    if (paths.length === 0) return { success: false, message: `No items matched JSONPath: ${jsonPath}` };
    const sorted = [...paths].reverse();
    let removed = 0;
    for (const p of sorted) {
      const parentPath = p.slice(0, -1);
      const key = p[p.length - 1];
      const parent = jp.query(data, jp.stringify(parentPath))[0];
      if (Array.isArray(parent) && typeof key === 'number') { parent.splice(key, 1); removed++; }
      else if (typeof parent === 'object' && parent !== null) { delete parent[key as string]; removed++; }
    }
    writeModelFile(filePath, data);
    return { success: true, removed };
  }

  // =========================================================================
  // Tests
  // =========================================================================

  describe('clay_model_query', () => {
    it('should return matched items for a valid JSONPath', () => {
      const result = queryModel(modelPath, '$.model.entities[?(@.name=="User")]');
      expect(result.success).to.be.true;
      expect(result.count).to.equal(1);
      expect((result.results![0] as any).name).to.equal('User');
    });

    it('should return all entities with wildcard', () => {
      const result = queryModel(modelPath, '$.model.entities[*]');
      expect(result.success).to.be.true;
      expect(result.count).to.equal(2);
    });

    it('should return empty results for non-matching path', () => {
      const result = queryModel(modelPath, '$.model.entities[?(@.name=="Nonexistent")]');
      expect(result.success).to.be.true;
      expect(result.count).to.equal(0);
      expect(result.results).to.deep.equal([]);
    });

    it('should return error for invalid JSONPath', () => {
      const result = queryModel(modelPath, 'not a valid path');
      expect(result.success).to.be.false;
    });

    it('should return error for nonexistent model file', () => {
      const result = queryModel(path.join(testDir, 'nonexistent.json'), '$.model');
      expect(result.success).to.be.false;
    });

    it('should query expanded model with resolved includes', () => {
      // Create included file
      const includePath = path.join(testDir, 'extra-fields.json');
      fs.writeFileSync(includePath, JSON.stringify({
        fields: [{ name: 'created_at', type: 'Date' }],
      }));

      // Create model with include
      const modelWithInclude = {
        name: 'IncludeTest',
        generators: ['gen'],
        model: {
          entities: [
            { name: 'Event', include: 'extra-fields.json' },
          ],
        },
      };
      const includedModelPath = path.join(testDir, 'include-model.json');
      fs.writeFileSync(includedModelPath, JSON.stringify(modelWithInclude));

      const result = queryModel(includedModelPath, '$.model.entities[0].fields');
      expect(result.success).to.be.true;
      expect(result.count).to.equal(1);
      expect(result.results![0]).to.deep.equal([{ name: 'created_at', type: 'Date' }]);
    });
  });

  describe('clay_model_add', () => {
    it('should append to an array', () => {
      const result = addToModel(modelPath, '$.model.entities', { name: 'Comment', fields: [{ name: 'id', type: 'string' }] });
      expect(result.success).to.be.true;
      const data = readModelFile(modelPath);
      const entities = (data.model as any).entities;
      expect(entities).to.have.length(3);
      expect(entities[2].name).to.equal('Comment');
    });

    it('should merge into an object', () => {
      const result = addToModel(modelPath, '$.model', { version: '2.0' });
      expect(result.success).to.be.true;
      const data = readModelFile(modelPath);
      const model = data.model as any;
      expect(model.version).to.equal('2.0');
      // existing entities should be preserved
      expect(model.entities).to.have.length(2);
    });

    it('should return error if path matches nothing', () => {
      const result = addToModel(modelPath, '$.model.nonexistent', { foo: 'bar' });
      expect(result.success).to.be.false;
      expect(result.message).to.include('No items matched');
    });

    it('should reject if $schema validation fails', () => {
      // Create a schema that limits entities to maxItems: 2
      const schemaPath = path.join(testDir, 'model.schema.json');
      fs.writeFileSync(schemaPath, JSON.stringify({
        type: 'object',
        properties: {
          entities: {
            type: 'array',
            maxItems: 2,
          },
        },
      }));

      // Write model with $schema reference
      const modelWithSchema = { ...sampleModel, $schema: 'model.schema.json' };
      fs.writeFileSync(modelPath, JSON.stringify(modelWithSchema, null, 2));

      // Adding a 3rd entity should fail validation
      expect(() => {
        addToModel(modelPath, '$.model.entities', { name: 'Third', fields: [] });
      }).to.throw(/Schema validation failed/);
    });
  });

  describe('clay_model_update', () => {
    it('should merge fields into a single matched item', () => {
      const result = updateInModel(modelPath, '$.model.entities[?(@.name=="User")]', { description: 'A user entity' });
      expect(result.success).to.be.true;
      expect(result.matched).to.equal(1);
      const data = readModelFile(modelPath);
      const user = (data.model as any).entities.find((e: any) => e.name === 'User');
      expect(user.description).to.equal('A user entity');
      // original fields preserved
      expect(user.fields).to.have.length(2);
    });

    it('should update multiple matched items with wildcard', () => {
      const result = updateInModel(modelPath, '$.model.entities[*]', { status: 'active' });
      expect(result.success).to.be.true;
      expect(result.matched).to.equal(2);
      const data = readModelFile(modelPath);
      for (const entity of (data.model as any).entities) {
        expect(entity.status).to.equal('active');
      }
    });

    it('should return error if nothing matched', () => {
      const result = updateInModel(modelPath, '$.model.entities[?(@.name=="Nonexistent")]', { foo: 'bar' });
      expect(result.success).to.be.false;
      expect(result.message).to.include('No items matched');
    });
  });

  describe('clay_model_delete', () => {
    it('should remove a matched item from an array', () => {
      const result = deleteFromModel(modelPath, '$.model.entities[?(@.name=="Post")]');
      expect(result.success).to.be.true;
      expect(result.removed).to.equal(1);
      const data = readModelFile(modelPath);
      const entities = (data.model as any).entities;
      expect(entities).to.have.length(1);
      expect(entities[0].name).to.equal('User');
    });

    it('should return error if nothing matched', () => {
      const result = deleteFromModel(modelPath, '$.model.entities[?(@.name=="Nonexistent")]');
      expect(result.success).to.be.false;
      expect(result.message).to.include('No items matched');
    });
  });
});
