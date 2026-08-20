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
      fs.writeFileSync(
        path.join(templateDir, '{{name}}.ts'),
        'export class {{name}} {}'
      );

      const genPath = path.join(testDir, 'generator.json');
      fs.writeJsonSync(genPath, {
        steps: [{ generate: 'templates', select: '$.entities[*]' }],
        partials: [],
      });

      const deps = collectGeneratorDependencies(genPath, testDir);
      expect(deps).to.include(
        path.resolve(path.join(templateDir, '{{name}}.ts'))
      );
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

    it('walks relative imports from generate templates transitively', () => {
      const pack = path.join(testDir, 'pack');
      fs.mkdirSync(path.join(pack, 'templates'), { recursive: true });
      fs.mkdirSync(path.join(pack, 'lib'), { recursive: true });

      const template = path.join(pack, 'templates', 'hub-view.tsx');
      const emit = path.join(pack, 'lib', 'emit.mjs');
      const hub = path.join(pack, 'lib', 'pages-hub.mjs');
      const detail = path.join(pack, 'lib', 'pages-detail.mjs');
      fs.writeFileSync(
        template,
        "import { createNavGen } from '../lib/emit.mjs';\nexport default class {}\n"
      );
      fs.writeFileSync(
        emit,
        "import { hub } from './pages-hub.mjs';\nimport { detail } from './pages-detail.mjs';\nexport function createNavGen() {}\n"
      );
      fs.writeFileSync(hub, 'export const hub = true;\n');
      fs.writeFileSync(detail, 'export const detail = true;\n');

      const genPath = path.join(pack, 'generator.json');
      fs.writeJsonSync(genPath, {
        steps: [{ generate: 'templates', select: '$', engine: 'ts' }],
        partials: [],
      });

      const deps = collectGeneratorDependencies(genPath, pack);
      expect(deps).to.include(path.resolve(template));
      expect(deps).to.include(path.resolve(emit));
      expect(deps).to.include(path.resolve(hub));
      expect(deps).to.include(path.resolve(detail));
    });

    it('invalidates input hash when a transitive import changes', () => {
      const pack = path.join(testDir, 'pack');
      fs.mkdirSync(path.join(pack, 'templates'), { recursive: true });
      fs.mkdirSync(path.join(pack, 'lib'), { recursive: true });

      fs.writeFileSync(
        path.join(pack, 'templates', 'hub-view.tsx'),
        "import { createNavGen } from '../lib/emit.mjs';\n"
      );
      fs.writeFileSync(
        path.join(pack, 'lib', 'emit.mjs'),
        "import { hub } from './pages-hub.mjs';\nexport function createNavGen() {}\n"
      );
      const hub = path.join(pack, 'lib', 'pages-hub.mjs');
      fs.writeFileSync(hub, 'export const hub = 1;\n');

      const genPath = path.join(pack, 'generator.json');
      fs.writeJsonSync(genPath, {
        steps: [
          { generate: 'templates/hub-view.tsx', select: '$', engine: 'ts' },
        ],
        partials: [],
      });

      const deps = collectGeneratorDependencies(genPath, pack);
      const h1 = computeInputHash(deps, '0.3.0');
      fs.writeFileSync(hub, 'export const hub = 2;\n');
      const h2 = computeInputHash(deps, '0.3.0');
      expect(h1).to.not.equal(h2);
    });

    it('collects static relative import syntaxes and skips dynamic/bare specifiers', () => {
      const pack = path.join(testDir, 'pack');
      fs.mkdirSync(path.join(pack, 'lib'), { recursive: true });

      const files: Record<string, string> = {
        'a.ts': 'export const a = 1;',
        'b.ts': 'export const b = 1;',
        'c.ts': 'export const c = 1;',
        'd.ts': 'export const d = 1;',
        'e.ts': 'export const e = 1;',
        'f.ts': 'export const f = 1;',
        'g.ts': 'export const g = 1;',
        'h.ts': 'export const h = 1;',
        'i.ts': 'export const i = 1;',
        'j.ts': 'export const j = 1;',
        'k.json': '{"k":1}',
        'l.ts': 'export const l = 1;',
      };
      for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(pack, 'lib', name), content);
      }

      const template = path.join(pack, 'root.ts');
      fs.writeFileSync(
        template,
        [
          "import def from './lib/a.ts';",
          "import { named } from './lib/b.ts';",
          "import * as ns from './lib/c.ts';",
          "import './lib/d.ts';",
          "export { x } from './lib/e.ts';",
          "export * from './lib/f.ts';",
          "import('./lib/g.ts');",
          "require('./lib/h.ts');",
          "import lodash from 'lodash';",
          "const dyn = './lib/i.ts';",
          'import(dyn);',
          "import('./lib/j.ts',);",
          "import('./lib/k.json', { with: { type: 'json' } });",
          "require('./lib/l.ts',);",
        ].join('\n')
      );

      const genPath = path.join(pack, 'generator.json');
      fs.writeJsonSync(genPath, {
        steps: [{ generate: 'root.ts', select: '$', engine: 'ts' }],
        partials: [],
      });

      const deps = collectGeneratorDependencies(genPath, pack);
      for (const name of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j', 'l']) {
        expect(deps).to.include(
          path.resolve(path.join(pack, 'lib', `${name}.ts`))
        );
      }
      expect(deps).to.include(path.resolve(path.join(pack, 'lib', 'k.json')));
      expect(deps).to.not.include(path.resolve(path.join(pack, 'lib', 'i.ts')));
    });

    it('does not follow imports outside the pack or through node_modules', () => {
      const pack = path.join(testDir, 'pack');
      fs.mkdirSync(path.join(pack, 'templates'), { recursive: true });
      fs.mkdirSync(path.join(pack, 'node_modules', 'pkg'), { recursive: true });

      const outside = path.join(testDir, 'outside.ts');
      fs.writeFileSync(outside, 'export const outside = true;\n');
      const vendored = path.join(pack, 'node_modules', 'pkg', 'index.js');
      fs.writeFileSync(vendored, 'export const vendored = true;\n');

      fs.writeFileSync(
        path.join(pack, 'templates', 'root.ts'),
        [
          "import '../../outside.ts';",
          "import '../node_modules/pkg/index.js';",
        ].join('\n')
      );

      const genPath = path.join(pack, 'generator.json');
      fs.writeJsonSync(genPath, {
        steps: [{ generate: 'templates/root.ts', select: '$', engine: 'ts' }],
        partials: [],
      });

      const deps = collectGeneratorDependencies(genPath, pack);
      expect(deps).to.not.include(path.resolve(outside));
      expect(deps).to.not.include(path.resolve(vendored));
    });

    it('does not loop on circular relative imports', () => {
      const pack = path.join(testDir, 'pack');
      fs.mkdirSync(pack);
      fs.writeFileSync(
        path.join(pack, 'a.ts'),
        "import './b.ts';\nexport const a = 1;\n"
      );
      fs.writeFileSync(
        path.join(pack, 'b.ts'),
        "import './a.ts';\nexport const b = 1;\n"
      );

      const genPath = path.join(pack, 'generator.json');
      fs.writeJsonSync(genPath, {
        steps: [{ generate: 'a.ts', select: '$', engine: 'ts' }],
        partials: [],
      });

      const deps = collectGeneratorDependencies(genPath, pack);
      expect(deps).to.include(path.resolve(path.join(pack, 'a.ts')));
      expect(deps).to.include(path.resolve(path.join(pack, 'b.ts')));
      expect(
        deps.filter((d) => d.endsWith('a.ts') || d.endsWith('b.ts'))
      ).to.have.lengthOf(2);
    });

    it('resolves extensionless and .js specifiers to TypeScript sources', () => {
      const pack = path.join(testDir, 'pack');
      fs.mkdirSync(path.join(pack, 'lib', 'nested'), { recursive: true });
      fs.writeFileSync(
        path.join(pack, 'lib', 'foo.ts'),
        'export const foo = 1;\n'
      );
      fs.writeFileSync(
        path.join(pack, 'lib', 'nested', 'index.ts'),
        'export const nested = 1;\n'
      );

      fs.writeFileSync(
        path.join(pack, 'root.ts'),
        "import { foo } from './lib/foo.js';\nimport { nested } from './lib/nested';\n"
      );

      const genPath = path.join(pack, 'generator.json');
      fs.writeJsonSync(genPath, {
        steps: [{ generate: 'root.ts', select: '$', engine: 'ts' }],
        partials: [],
      });

      const deps = collectGeneratorDependencies(genPath, pack);
      expect(deps).to.include(path.resolve(path.join(pack, 'lib', 'foo.ts')));
      expect(deps).to.include(
        path.resolve(path.join(pack, 'lib', 'nested', 'index.ts'))
      );
    });

    it('does not walk imports from copy sources', () => {
      const pack = path.join(testDir, 'pack');
      fs.mkdirSync(path.join(pack, 'static'), { recursive: true });
      fs.mkdirSync(path.join(pack, 'lib'), { recursive: true });
      fs.writeFileSync(
        path.join(pack, 'static', 'copied.js'),
        "import { hidden } from '../lib/hidden.js';\n"
      );
      fs.writeFileSync(
        path.join(pack, 'lib', 'hidden.js'),
        'export const hidden = 1;\n'
      );

      const genPath = path.join(pack, 'generator.json');
      fs.writeJsonSync(genPath, {
        steps: [{ copy: 'static', target: '.' }],
        partials: [],
      });

      const deps = collectGeneratorDependencies(genPath, pack);
      expect(deps).to.include(
        path.resolve(path.join(pack, 'static', 'copied.js'))
      );
      expect(deps).to.not.include(
        path.resolve(path.join(pack, 'lib', 'hidden.js'))
      );
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
