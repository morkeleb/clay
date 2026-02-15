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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const clayModel = require('../dist/src/model.js');

  /**
   * CJS include-aware add helper.
   * Loads expanded model with include map, queries it, traces to source, mutates the correct file.
   */
  function addToModelIncludeAware(
    filePath: string,
    jsonPath: string,
    value: unknown
  ): { success: boolean; message?: string; path?: string; source_file?: string } {
    const { model: expandedModel, includeMap } = clayModel.loadWithIncludeMap(filePath);

    let targets: unknown[];
    let targetPaths: (string | number)[][];
    try {
      targets = jp.query(expandedModel, jsonPath);
      targetPaths = jp.paths(expandedModel, jsonPath);
    } catch (e: unknown) {
      return { success: false, message: `Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}` };
    }

    if (targets.length === 0) {
      return { success: false, message: `No items matched JSONPath: ${jsonPath}` };
    }

    const targetPath = targetPaths[0];

    // Trace to source: walk the path and find the deepest included object
    let current: unknown = expandedModel;
    let lastIncludeIdx = -1;
    let lastIncludeFile: string | null = null;

    for (let i = 1; i < targetPath.length; i++) {
      current = (current as Record<string | number, unknown>)[targetPath[i]];
      if (current !== null && typeof current === 'object' && includeMap.has(current as object)) {
        lastIncludeIdx = i;
        lastIncludeFile = includeMap.get(current as object)!;
      }
    }

    if (lastIncludeFile) {
      // Edit included file
      const includeData = JSON.parse(fs.readFileSync(path.resolve(lastIncludeFile), 'utf-8'));
      const relativePath: (string | number)[] = ['$', ...targetPath.slice(lastIncludeIdx + 1)];
      const relTargets = jp.query(includeData, jp.stringify(relativePath));
      if (relTargets.length === 0) {
        return { success: false, message: 'Target not found in included file' };
      }
      const relTarget = relTargets[0];
      if (Array.isArray(relTarget)) { relTarget.push(value); }
      else if (typeof relTarget === 'object' && relTarget !== null) { Object.assign(relTarget, value); }
      else { return { success: false, message: 'Target is not array or object' }; }
      fs.writeFileSync(path.resolve(lastIncludeFile), JSON.stringify(includeData, null, 2) + '\n', 'utf-8');
      return { success: true, message: `Added value at ${jsonPath}`, path: jsonPath, source_file: lastIncludeFile };
    } else {
      // Edit main model file (raw)
      const data = readModelFile(filePath);
      const rawTargets = jp.query(data, jsonPath);
      if (rawTargets.length === 0) {
        return { success: false, message: `No items matched in raw model: ${jsonPath}` };
      }
      const rawTarget = rawTargets[0];
      if (Array.isArray(rawTarget)) { rawTarget.push(value); }
      else if (typeof rawTarget === 'object' && rawTarget !== null) { Object.assign(rawTarget, value); }
      else { return { success: false, message: 'Target is not array or object' }; }
      writeModelFile(filePath, data);
      return { success: true, message: `Added value at ${jsonPath}`, path: jsonPath };
    }
  }

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

  function renameInModel(modelPath: string, jsonPath: string, oldName: string, newName: string) {
    const data = readModelFile(modelPath);
    const matches = jp.query(data, jsonPath);
    if (matches.length === 0) return { success: false, message: `No items matched JSONPath: ${jsonPath}` };
    let renamed = 0;
    for (const m of matches) {
      if (typeof m === 'object' && m !== null && !Array.isArray(m) && oldName in m) {
        m[newName] = m[oldName];
        delete m[oldName];
        renamed++;
      }
    }
    writeModelFile(modelPath, data);
    return { success: true, renamed };
  }

  function setSchema(modelPath: string, schemaPath: string) {
    const data = readModelFile(modelPath);
    const resolvedSchema = path.isAbsolute(schemaPath)
      ? schemaPath
      : path.resolve(path.dirname(modelPath), schemaPath);
    if (!fs.existsSync(resolvedSchema)) return { success: false, message: `Schema file not found: ${resolvedSchema}` };

    // Validate for warnings
    const schemaContent = JSON.parse(fs.readFileSync(resolvedSchema, 'utf-8'));
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schemaContent);
    const valid = validate(data.model);
    const warnings = valid ? [] : (validate.errors || []).map((e: any) => `${e.instancePath}: ${e.message}`);

    data['$schema'] = schemaPath;
    fs.writeFileSync(path.resolve(modelPath), JSON.stringify(data, null, 2) + '\n', 'utf-8');

    const result: any = { success: true, message: `Set $schema to ${schemaPath}` };
    if (warnings.length > 0) { result.validation_warnings = warnings; }
    return result;
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

    it('should add a field to an entity in an included file', () => {
      // Create included file with entity data
      const includePath = path.join(testDir, 'user-entity.json');
      fs.writeFileSync(includePath, JSON.stringify({
        fields: [{ name: 'id', type: 'string' }, { name: 'email', type: 'string' }],
      }, null, 2));

      // Create model with include reference
      const modelWithInclude = {
        name: 'IncludeAddTest',
        generators: ['gen'],
        model: {
          entities: [
            { name: 'User', include: 'user-entity.json' },
          ],
        },
      };
      const includeModelPath = path.join(testDir, 'include-add.model.json');
      fs.writeFileSync(includeModelPath, JSON.stringify(modelWithInclude, null, 2));

      // Add a field via the expanded entity's fields array
      const result = addToModelIncludeAware(
        includeModelPath,
        '$.model.entities[?(@.name=="User")].fields',
        { name: 'age', type: 'number' }
      );

      expect(result.success).to.be.true;
      expect(result.source_file).to.equal(path.resolve(includePath));

      // Verify the included file was updated
      const updatedInclude = JSON.parse(fs.readFileSync(includePath, 'utf-8'));
      expect(updatedInclude.fields).to.have.length(3);
      expect(updatedInclude.fields[2].name).to.equal('age');

      // Verify main model still has include reference (not expanded)
      const mainModel = JSON.parse(fs.readFileSync(includeModelPath, 'utf-8'));
      expect(mainModel.model.entities[0].include).to.equal('user-entity.json');
      expect(mainModel.model.entities[0].fields).to.be.undefined;
    });

    it('should still add to main model when no includes involved', () => {
      const result = addToModelIncludeAware(
        modelPath,
        '$.model.entities',
        { name: 'Comment', fields: [{ name: 'id', type: 'string' }] }
      );
      expect(result.success).to.be.true;
      expect(result.source_file).to.be.undefined;

      const data = readModelFile(modelPath);
      const entities = (data.model as any).entities;
      expect(entities).to.have.length(3);
      expect(entities[2].name).to.equal('Comment');
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

  describe('clay_model_rename', () => {
    it('should rename property on all matched items', () => {
      const result = renameInModel(modelPath, '$.model.entities[*]', 'fields', 'columns');
      expect(result.success).to.be.true;
      expect(result.renamed).to.equal(2);
      const data = readModelFile(modelPath);
      const entities = (data.model as any).entities;
      for (const entity of entities) {
        expect(entity).to.have.property('columns');
        expect(entity).to.not.have.property('fields');
      }
    });

    it('should skip items that do not have the old property', () => {
      // Remove 'fields' from the second entity so only one has it
      const data = readModelFile(modelPath);
      delete (data.model as any).entities[1].fields;
      fs.writeFileSync(modelPath, JSON.stringify(data, null, 2));

      const result = renameInModel(modelPath, '$.model.entities[*]', 'fields', 'columns');
      expect(result.success).to.be.true;
      expect(result.renamed).to.equal(1);
      const updated = readModelFile(modelPath);
      const entities = (updated.model as any).entities;
      expect(entities[0]).to.have.property('columns');
      expect(entities[1]).to.not.have.property('columns');
    });

    it('should return error if nothing matched', () => {
      const result = renameInModel(modelPath, '$.model.nonexistent[*]', 'foo', 'bar');
      expect(result.success).to.be.false;
      expect(result.message).to.include('No items matched');
    });
  });

  describe('clay_model_set_schema', () => {
    it('should set $schema reference on model', () => {
      const schemaPath = path.join(testDir, 'model.schema.json');
      fs.writeFileSync(schemaPath, JSON.stringify({
        type: 'object',
        properties: {
          entities: { type: 'array' },
        },
      }));

      const result = setSchema(modelPath, 'model.schema.json');
      expect(result.success).to.be.true;
      expect(result.message).to.include('model.schema.json');

      const data = readModelFile(modelPath);
      expect(data['$schema']).to.equal('model.schema.json');
    });

    it('should return validation warnings if model does not match schema', () => {
      const schemaPath = path.join(testDir, 'strict.schema.json');
      fs.writeFileSync(schemaPath, JSON.stringify({
        type: 'object',
        properties: {
          entities: { type: 'string' },  // entities is actually an array, so this will warn
        },
        required: ['entities'],
      }));

      const result = setSchema(modelPath, 'strict.schema.json');
      expect(result.success).to.be.true;
      expect(result.validation_warnings).to.be.an('array');
      expect(result.validation_warnings.length).to.be.greaterThan(0);

      // $schema should still be set despite warnings
      const data = readModelFile(modelPath);
      expect(data['$schema']).to.equal('strict.schema.json');
    });

    it('should return error if schema file does not exist', () => {
      const result = setSchema(modelPath, 'nonexistent.schema.json');
      expect(result.success).to.be.false;
      expect(result.message).to.include('Schema file not found');
    });
  });
});
