import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * CJS-compatible test for convention checking logic used by MCP tools.
 * Tests the pattern: load model -> find generators -> load conventions -> run.
 *
 * Note: loadConventions expects the path to generator.json.
 */
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

    const conventions = loadConventions(path.join(genDir, 'generator.json'));
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
