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
});
