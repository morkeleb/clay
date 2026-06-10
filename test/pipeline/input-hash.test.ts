import { expect } from 'chai';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import {
  collectModelDependencies,
  collectGeneratorDependencies,
  computeInputHash,
  checkInputHash,
} from '../../src/pipeline/input-hash';

describe('input-hash', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-hash-'));
  });

  afterEach(() => {
    fs.removeSync(testDir);
  });

  describe('collectModelDependencies', () => {
    it('includes the model file itself', () => {
      const modelPath = path.join(testDir, 'model.json');
      fs.writeJsonSync(modelPath, { model: { entities: [] } });

      const deps = collectModelDependencies(modelPath);
      expect(deps).to.include(path.resolve(modelPath));
    });

    it('collects include file paths recursively', () => {
      const includePath = path.join(testDir, 'entity.json');
      fs.writeJsonSync(includePath, { name: 'User', fields: [] });

      const modelPath = path.join(testDir, 'model.json');
      fs.writeJsonSync(modelPath, {
        model: {
          entities: [{ include: 'entity.json' }],
        },
      });

      const deps = collectModelDependencies(modelPath);
      expect(deps).to.include(path.resolve(includePath));
    });

    it('handles nested includes', () => {
      const deepInclude = path.join(testDir, 'deep.json');
      fs.writeJsonSync(deepInclude, { name: 'Deep' });

      const midInclude = path.join(testDir, 'mid.json');
      fs.writeJsonSync(midInclude, { nested: { include: 'deep.json' } });

      const modelPath = path.join(testDir, 'model.json');
      fs.writeJsonSync(modelPath, {
        model: { items: [{ include: 'mid.json' }] },
      });

      const deps = collectModelDependencies(modelPath);
      expect(deps).to.include(path.resolve(deepInclude));
      expect(deps).to.include(path.resolve(midInclude));
    });

    it('does not loop on circular includes', () => {
      const a = path.join(testDir, 'a.json');
      const b = path.join(testDir, 'b.json');
      fs.writeJsonSync(a, { ref: { include: 'b.json' } });
      fs.writeJsonSync(b, { ref: { include: 'a.json' } });

      const deps = collectModelDependencies(a);
      expect(deps).to.have.lengthOf(2);
    });

    it('includes missing include file paths so hash detects when they appear', () => {
      const modelPath = path.join(testDir, 'model.json');
      fs.writeJsonSync(modelPath, {
        model: { items: [{ include: 'nonexistent.json' }] },
      });

      const deps = collectModelDependencies(modelPath);
      expect(deps).to.have.lengthOf(2); // model + missing include path
      expect(deps[1]).to.include('nonexistent.json');
    });
  });

  describe('collectGeneratorDependencies', () => {
    it('includes the generator file itself', () => {
      const genPath = path.join(testDir, 'generator.json');
      fs.writeJsonSync(genPath, { steps: [], partials: [] });

      const deps = collectGeneratorDependencies(genPath, testDir);
      expect(deps).to.include(path.resolve(genPath));
    });

    it('collects template files from generate steps', () => {
      const templateDir = path.join(testDir, 'templates');
      fs.mkdirSync(templateDir);
      fs.writeFileSync(path.join(templateDir, '{{name}}.ts'), 'export class {{name}} {}');

      const genPath = path.join(testDir, 'generator.json');
      fs.writeJsonSync(genPath, {
        steps: [{ generate: 'templates', select: '$.entities[*]' }],
        partials: [],
      });

      const deps = collectGeneratorDependencies(genPath, testDir);
      expect(deps).to.include(path.resolve(path.join(templateDir, '{{name}}.ts')));
    });

    it('collects partial files', () => {
      const partial = path.join(testDir, 'partials', 'header.hbs');
      fs.mkdirSync(path.join(testDir, 'partials'));
      fs.writeFileSync(partial, '{{! header partial }}');

      const genPath = path.join(testDir, 'generator.json');
      fs.writeJsonSync(genPath, {
        steps: [],
        partials: ['partials/header.hbs'],
      });

      const deps = collectGeneratorDependencies(genPath, testDir);
      expect(deps).to.include(path.resolve(partial));
    });

    it('collects convention include files', () => {
      const convFile = path.join(testDir, 'conventions', 'naming.json');
      fs.mkdirSync(path.join(testDir, 'conventions'));
      fs.writeJsonSync(convFile, { rules: [] });

      const genPath = path.join(testDir, 'generator.json');
      fs.writeJsonSync(genPath, {
        steps: [],
        partials: [],
        conventions: [
          { name: 'inline-conv', description: 'test', function: '() => []' },
          { include: 'conventions/naming.json' },
        ],
      });

      const deps = collectGeneratorDependencies(genPath, testDir);
      expect(deps).to.include(path.resolve(convFile));
    });

    it('skips git+ copy sources', () => {
      const genPath = path.join(testDir, 'generator.json');
      fs.writeJsonSync(genPath, {
        steps: [{ copy: 'git+morkeleb/foundation', target: '{{name}}' }],
        partials: [],
      });

      const deps = collectGeneratorDependencies(genPath, testDir);
      expect(deps).to.have.lengthOf(1); // just the generator itself
    });
  });

  describe('computeInputHash', () => {
    it('produces a consistent hash for the same files', () => {
      const f = path.join(testDir, 'file.txt');
      fs.writeFileSync(f, 'content');

      const h1 = computeInputHash([f], '0.3.0');
      const h2 = computeInputHash([f], '0.3.0');
      expect(h1).to.equal(h2);
    });

    it('produces different hash when file content changes', () => {
      const f = path.join(testDir, 'file.txt');
      fs.writeFileSync(f, 'original');
      const h1 = computeInputHash([f], '0.3.0');

      fs.writeFileSync(f, 'modified');
      const h2 = computeInputHash([f], '0.3.0');
      expect(h1).to.not.equal(h2);
    });

    it('produces different hash when Clay version changes', () => {
      const f = path.join(testDir, 'file.txt');
      fs.writeFileSync(f, 'content');

      const h1 = computeInputHash([f], '0.3.0');
      const h2 = computeInputHash([f], '0.4.0');
      expect(h1).to.not.equal(h2);
    });

    it('produces different hash when a file is added', () => {
      const f1 = path.join(testDir, 'a.txt');
      fs.writeFileSync(f1, 'a');

      const h1 = computeInputHash([f1], '0.3.0');

      const f2 = path.join(testDir, 'b.txt');
      fs.writeFileSync(f2, 'b');

      const h2 = computeInputHash([f1, f2], '0.3.0');
      expect(h1).to.not.equal(h2);
    });

    it('handles missing files by including them in the hash', () => {
      const h1 = computeInputHash(['/nonexistent/file.txt'], '0.3.0');
      expect(h1).to.be.a('string').with.lengthOf(32);
    });
  });

  describe('checkInputHash', () => {
    it('returns changed:false when hash matches', () => {
      const f = path.join(testDir, 'file.txt');
      fs.writeFileSync(f, 'content');

      const hash = computeInputHash([f], '0.3.0');
      const result = checkInputHash(hash, [f], '0.3.0');
      expect(result.changed).to.be.false;
    });

    it('returns changed:true when hash differs', () => {
      const f = path.join(testDir, 'file.txt');
      fs.writeFileSync(f, 'content');

      const result = checkInputHash('old-hash', [f], '0.3.0');
      expect(result.changed).to.be.true;
    });

    it('returns changed:true when no stored hash', () => {
      const f = path.join(testDir, 'file.txt');
      fs.writeFileSync(f, 'content');

      const result = checkInputHash(undefined, [f], '0.3.0');
      expect(result.changed).to.be.true;
    });
  });
});
