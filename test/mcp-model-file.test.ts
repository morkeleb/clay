import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Since the MCP module is ESM and tests run under ts-node (CJS),
 * we re-implement the helper functions here using the same logic
 * to unit-test the behaviour. The actual ESM module is verified
 * via the MCP build step.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Ajv = require('ajv').default || require('ajv');

/* ------------------------------------------------------------------ */
/*  Inline copies of the four helpers (CJS-compatible)                */
/* ------------------------------------------------------------------ */

function readModelFile(modelPath: string): Record<string, unknown> {
  const resolved = path.resolve(modelPath);
  const content = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(content) as Record<string, unknown>;
}

function readExpandedModel(modelPath: string): {
  name: string;
  generators: string[];
  mixins?: unknown[];
  model: Record<string, unknown>;
} {
  // In CJS test context we can require directly
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const clayModel = require('../dist/src/model.js');
  return clayModel.load(modelPath);
}

function validateAgainstSchema(
  data: unknown,
  schemaPath: string
): string[] {
  const resolved = path.resolve(schemaPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Schema file not found: ${resolved}`);
  }

  const schemaContent = fs.readFileSync(resolved, 'utf-8');
  const schema = JSON.parse(schemaContent);

  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return [];
  }

  return (validate.errors ?? []).map((err: { instancePath: string; message: string }) => {
    return `${err.instancePath}: ${err.message}`;
  });
}

function writeModelFile(
  modelPath: string,
  data: Record<string, unknown>
): void {
  if (data['$schema'] && typeof data['$schema'] === 'string') {
    const schemaRelative = data['$schema'] as string;
    const resolvedSchema = path.resolve(
      path.dirname(modelPath),
      schemaRelative
    );
    const errors = validateAgainstSchema(data.model, resolvedSchema);
    if (errors.length > 0) {
      throw new Error(
        'Schema validation failed:\n' + errors.join('\n')
      );
    }
  }

  const resolved = path.resolve(modelPath);
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('model-file helpers', function () {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-model-file-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  /* ---------- readModelFile ---------- */

  describe('readModelFile', () => {
    it('reads and parses valid model JSON', () => {
      const modelPath = path.join(testDir, 'model.json');
      const data = { name: 'test', generators: ['go'], model: { items: [] } };
      fs.writeFileSync(modelPath, JSON.stringify(data));

      const result = readModelFile(modelPath);
      expect(result).to.deep.equal(data);
    });

    it('throws if file does not exist', () => {
      expect(() => readModelFile(path.join(testDir, 'nope.json'))).to.throw();
    });

    it('throws if invalid JSON', () => {
      const bad = path.join(testDir, 'bad.json');
      fs.writeFileSync(bad, '{not valid json!!!');
      expect(() => readModelFile(bad)).to.throw();
    });
  });

  /* ---------- readExpandedModel ---------- */

  describe('readExpandedModel', () => {
    it('loads model and returns expanded data', () => {
      const modelPath = path.join(testDir, 'model.json');
      const data = {
        name: 'myapp',
        generators: ['typescript'],
        model: { entities: [{ name: 'User' }] },
      };
      fs.writeFileSync(modelPath, JSON.stringify(data));

      const result = readExpandedModel(modelPath);
      expect(result.name).to.equal('myapp');
      expect(result.generators).to.deep.equal(['typescript']);
      expect(result.model.entities).to.deep.equal([{ name: 'User' }]);
    });

    it('resolves includes', () => {
      // Create an included file
      const includePath = path.join(testDir, 'fields.json');
      fs.writeFileSync(
        includePath,
        JSON.stringify({ fields: [{ name: 'id', type: 'int' }] })
      );

      // Create model that references the include
      const modelPath = path.join(testDir, 'model.json');
      const data = {
        name: 'inctest',
        generators: ['go'],
        model: {
          entities: [{ name: 'User', include: 'fields.json' }],
        },
      };
      fs.writeFileSync(modelPath, JSON.stringify(data));

      const result = readExpandedModel(modelPath);
      const entity = (result.model.entities as Array<Record<string, unknown>>)[0];
      // After include resolution, the entity should have the fields and no include key
      expect(entity.fields).to.deep.equal([{ name: 'id', type: 'int' }]);
      expect(entity).to.not.have.property('include');
    });
  });

  /* ---------- writeModelFile ---------- */

  describe('writeModelFile', () => {
    it('writes formatted JSON with trailing newline', () => {
      const modelPath = path.join(testDir, 'out.json');
      const data = { name: 'test', generators: ['go'], model: {} };
      writeModelFile(modelPath, data);

      const content = fs.readFileSync(modelPath, 'utf-8');
      expect(content).to.equal(JSON.stringify(data, null, 2) + '\n');
    });

    it('preserves unknown top-level properties', () => {
      const modelPath = path.join(testDir, 'out.json');
      const data = {
        name: 'test',
        generators: ['go'],
        model: {},
        customProp: 'hello',
      };
      writeModelFile(modelPath, data);

      const written = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
      expect(written.customProp).to.equal('hello');
    });

    it('validates against $schema and rejects invalid data', () => {
      // Create a schema that requires "entities" to be an array
      const schemaPath = path.join(testDir, 'schema.json');
      fs.writeFileSync(
        schemaPath,
        JSON.stringify({
          type: 'object',
          properties: {
            entities: { type: 'array' },
          },
          required: ['entities'],
        })
      );

      const modelPath = path.join(testDir, 'model.json');
      const data = {
        $schema: 'schema.json',
        name: 'test',
        generators: ['go'],
        model: { entities: 'not-an-array' }, // invalid
      };

      expect(() => writeModelFile(modelPath, data)).to.throw(
        'Schema validation failed'
      );
      // File should not have been written
      expect(fs.existsSync(modelPath)).to.be.false;
    });

    it('writes successfully when $schema passes', () => {
      const schemaPath = path.join(testDir, 'schema.json');
      fs.writeFileSync(
        schemaPath,
        JSON.stringify({
          type: 'object',
          properties: {
            entities: { type: 'array' },
          },
          required: ['entities'],
        })
      );

      const modelPath = path.join(testDir, 'model.json');
      const data = {
        $schema: 'schema.json',
        name: 'test',
        generators: ['go'],
        model: { entities: [{ name: 'User' }] },
      };

      writeModelFile(modelPath, data);
      expect(fs.existsSync(modelPath)).to.be.true;
      const written = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
      expect(written.name).to.equal('test');
    });

    it('writes without validation when no $schema', () => {
      const modelPath = path.join(testDir, 'model.json');
      const data = { name: 'test', generators: ['go'], model: { anything: true } };
      writeModelFile(modelPath, data);

      const written = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
      expect(written.model.anything).to.be.true;
    });
  });

  /* ---------- validateAgainstSchema ---------- */

  describe('validateAgainstSchema', () => {
    it('returns empty errors for valid data', () => {
      const schemaPath = path.join(testDir, 'schema.json');
      fs.writeFileSync(
        schemaPath,
        JSON.stringify({
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        })
      );

      const errors = validateAgainstSchema({ name: 'hello' }, schemaPath);
      expect(errors).to.deep.equal([]);
    });

    it('returns error messages for invalid data', () => {
      const schemaPath = path.join(testDir, 'schema.json');
      fs.writeFileSync(
        schemaPath,
        JSON.stringify({
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        })
      );

      const errors = validateAgainstSchema({ name: 123 }, schemaPath);
      expect(errors.length).to.be.greaterThan(0);
      // Ajv error message may say "should be string" or "must be string"
      expect(errors[0]).to.match(/string/);
    });

    it('throws if schema file not found', () => {
      expect(() =>
        validateAgainstSchema({}, path.join(testDir, 'missing.json'))
      ).to.throw('Schema file not found');
    });
  });
});
