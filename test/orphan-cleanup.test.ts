/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import crypto from 'crypto';
import {
  hasMissingGeneratedFiles,
  markOwnedPath,
  removeOrphanGeneratedFiles,
} from '../src/orphan-cleanup';
import { normalizeClayPath } from '../src/clay_file';
import { createHashStage } from '../src/pipeline/stages/hash';
import type { ClayModelEntry } from '../src/types/clay-file';
import type { RenderedItem } from '../src/pipeline/types';
import type { GeneratorStepGenerate } from '../src/types/generator';

async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of gen) result.push(item);
  return result;
}

function makeModelIndex(
  generatedFiles: Record<string, { md5: string; date: string }> = {},
  overrides?: Partial<ClayModelEntry>
): ClayModelEntry {
  const generated_files = { ...generatedFiles };
  return {
    path: 'model.json',
    generated_files,
    setFileCheckSum: (filePath: string, md5: string) => {
      const key = normalizeClayPath(filePath);
      generated_files[key] = { md5, date: new Date().toISOString() };
    },
    getFileCheckSum: (filePath: string) => {
      const key = normalizeClayPath(filePath);
      return generated_files[key]?.md5 ?? null;
    },
    delFileCheckSum: (filePath: string) => {
      const key = normalizeClayPath(filePath);
      delete generated_files[key];
    },
    load: () => ({}),
    ...overrides,
  };
}

describe('orphan cleanup', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-orphan-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.removeSync(tmpDir);
  });

  describe('normalizeClayPath', () => {
    it('normalizes absolute paths to cwd-relative POSIX keys', () => {
      const abs = path.resolve('src/entities/Order.ts');
      expect(normalizeClayPath(abs)).to.equal('src/entities/Order.ts');
    });

    it('canonicalizes relative inputs (./ and ..)', () => {
      expect(normalizeClayPath('./src/foo.ts')).to.equal('src/foo.ts');
      fs.ensureDirSync('src');
      expect(normalizeClayPath('src/../src/foo.ts')).to.equal('src/foo.ts');
    });
  });

  describe('markOwnedPath', () => {
    it('adds normalized paths (touch and non-touch both protected by membership)', () => {
      const expected = new Set<string>();
      markOwnedPath(expected, path.resolve('a.ts'));
      markOwnedPath(expected, 'b.ts');
      expect(expected.has('a.ts')).to.equal(true);
      expect(expected.has('b.ts')).to.equal(true);
    });
  });

  describe('hasMissingGeneratedFiles', () => {
    it('returns true when a tracked file is missing', () => {
      const model = makeModelIndex({
        'out/gone.ts': { md5: 'x', date: '2025-01-01' },
      });
      expect(hasMissingGeneratedFiles(model)).to.equal(true);
    });

    it('returns false when all tracked files exist', () => {
      fs.ensureDirSync('out');
      fs.writeFileSync('out/kept.ts', 'ok');
      const model = makeModelIndex({
        'out/kept.ts': { md5: 'x', date: '2025-01-01' },
      });
      expect(hasMissingGeneratedFiles(model)).to.equal(false);
    });
  });

  describe('removeOrphanGeneratedFiles', () => {
    it('removes paths not in expected from index and disk', () => {
      const orphanRel = 'out/orphan.ts';
      const keptRel = 'out/kept.ts';
      fs.ensureDirSync('out');
      fs.writeFileSync(orphanRel, 'gone');
      fs.writeFileSync(keptRel, 'stay');

      const modelA = makeModelIndex({
        [orphanRel]: { md5: 'x', date: '2025-01-01' },
        [keptRel]: { md5: 'y', date: '2025-01-01' },
      });
      const expected = new Set([keptRel]);

      const result = removeOrphanGeneratedFiles({
        modelIndex: modelA,
        expected,
        allModels: [modelA],
      });

      expect(result.removedFromIndex).to.deep.equal([orphanRel]);
      expect(result.deletedFromDisk).to.deep.equal([orphanRel]);
      expect(modelA.generated_files[orphanRel]).to.equal(undefined);
      expect(modelA.generated_files[keptRel]).to.exist;
      expect(fs.existsSync(orphanRel)).to.equal(false);
      expect(fs.existsSync(keptRel)).to.equal(true);
    });

    it('keeps hash-skipped (expected) files', () => {
      const file = 'out/same.ts';
      fs.ensureDirSync('out');
      fs.writeFileSync(file, 'content');

      const modelA = makeModelIndex({
        [file]: { md5: 'abc', date: '2025-01-01' },
      });

      const result = removeOrphanGeneratedFiles({
        modelIndex: modelA,
        expected: new Set([file]),
        allModels: [modelA],
      });

      expect(result.removedFromIndex).to.have.lengthOf(0);
      expect(fs.existsSync(file)).to.equal(true);
      expect(modelA.generated_files[file]).to.exist;
    });

    it('does not cascade into another model entry (map isolation)', () => {
      const aFile = 'out/a-only.ts';
      const bFile = 'out/b-only.ts';
      fs.ensureDirSync('out');
      fs.writeFileSync(aFile, 'a');
      fs.writeFileSync(bFile, 'b');

      const modelA = makeModelIndex({
        [aFile]: { md5: 'a', date: '2025-01-01' },
      });
      modelA.path = 'a.json';
      const modelB = makeModelIndex({
        [bFile]: { md5: 'b', date: '2025-01-01' },
      });
      modelB.path = 'b.json';

      // A produces nothing this pass — only A orphans clear
      removeOrphanGeneratedFiles({
        modelIndex: modelA,
        expected: new Set(),
        allModels: [modelA, modelB],
      });

      expect(modelA.generated_files[aFile]).to.equal(undefined);
      expect(modelB.generated_files[bFile]).to.exist;
      expect(fs.existsSync(bFile)).to.equal(true);
      expect(fs.existsSync(aFile)).to.equal(false);
    });

    it('drops from current index but keeps disk if another model claims path', () => {
      const shared = 'out/shared.ts';
      fs.ensureDirSync('out');
      fs.writeFileSync(shared, 'shared');

      const modelA = makeModelIndex({
        [shared]: { md5: 'a', date: '2025-01-01' },
      });
      modelA.path = 'a.json';
      const modelB = makeModelIndex({
        [shared]: { md5: 'b', date: '2025-01-01' },
      });
      modelB.path = 'b.json';

      const result = removeOrphanGeneratedFiles({
        modelIndex: modelA,
        expected: new Set(),
        allModels: [modelA, modelB],
      });

      expect(result.removedFromIndex).to.deep.equal([shared]);
      expect(result.deletedFromDisk).to.have.lengthOf(0);
      expect(modelA.generated_files[shared]).to.equal(undefined);
      expect(modelB.generated_files[shared]).to.exist;
      expect(fs.existsSync(shared)).to.equal(true);
    });

    it('does not delete untracked files', () => {
      const tracked = 'out/tracked.ts';
      const untracked = 'out/hand-written.ts';
      fs.ensureDirSync('out');
      fs.writeFileSync(tracked, 't');
      fs.writeFileSync(untracked, 'hand');

      const modelA = makeModelIndex({
        [tracked]: { md5: 't', date: '2025-01-01' },
      });

      removeOrphanGeneratedFiles({
        modelIndex: modelA,
        expected: new Set(),
        allModels: [modelA],
      });

      expect(fs.existsSync(tracked)).to.equal(false);
      expect(fs.existsSync(untracked)).to.equal(true);
    });

    it('keeps touch-protected paths that remain in the ledger', () => {
      const touchFile = 'out/scaffold.ts';
      fs.ensureDirSync('out');
      fs.writeFileSync(touchFile, 'hand edited');

      const modelA = makeModelIndex({
        [touchFile]: { md5: 'old', date: '2025-01-01' },
      });
      // Step flipped to touch:true — path still listed historically but protected this pass
      const expected = new Set([touchFile]);

      const result = removeOrphanGeneratedFiles({
        modelIndex: modelA,
        expected,
        allModels: [modelA],
      });

      expect(result.removedFromIndex).to.have.lengthOf(0);
      expect(fs.existsSync(touchFile)).to.equal(true);
      expect(modelA.generated_files[touchFile]).to.exist;
    });

    it('does not recursively delete directory keys', () => {
      const dirKey = 'out/copied-tree';
      fs.ensureDirSync(path.join(dirKey, 'nested'));
      fs.writeFileSync(path.join(dirKey, 'nested', 'hand.ts'), 'keep');

      const modelA = makeModelIndex({
        [dirKey]: { md5: '', date: '2025-01-01' },
      });

      const result = removeOrphanGeneratedFiles({
        modelIndex: modelA,
        expected: new Set(),
        allModels: [modelA],
      });

      expect(result.removedFromIndex).to.deep.equal([dirKey]);
      expect(result.deletedFromDisk).to.have.lengthOf(0);
      expect(fs.existsSync(path.join(dirKey, 'nested', 'hand.ts'))).to.equal(true);
    });
  });

  describe('hash stage marks owned paths including hash-skipped', () => {
    const step: GeneratorStepGenerate = {
      generate: 't.hbs',
      select: '$.entities[*]',
    };

    it('invokes onOwnedPath for changed and unchanged items', async () => {
      const content = 'same content';
      const md5 = crypto.createHash('md5').update(content).digest('hex');
      fs.ensureDirSync('out');
      fs.writeFileSync('out/unchanged.ts', content);
      const modelIndex = makeModelIndex({
        'out/unchanged.ts': { md5, date: '2025-01-01' },
      });

      const seen: Array<{ file: string; touch: boolean }> = [];
      const stage = createHashStage(undefined, (filename, isTouch) => {
        seen.push({ file: filename, touch: isTouch });
      });

      const items: RenderedItem[] = [
        {
          filename: path.resolve('out/unchanged.ts'),
          content,
          step,
          modelIndex,
          formatters: [],
        },
        {
          filename: path.resolve('out/changed.ts'),
          content: 'new',
          step,
          modelIndex: makeModelIndex(),
          formatters: [],
        },
        {
          filename: path.resolve('out/touch.ts'),
          content: 'scaffold',
          step: { ...step, touch: true },
          modelIndex: makeModelIndex(),
          formatters: [],
        },
      ];

      const results = await collect(stage(fromArray(items)));
      expect(seen).to.have.lengthOf(3);
      expect(results).to.have.lengthOf(2); // unchanged on-disk filtered; touch+changed pass
      expect(seen.map((s) => s.touch)).to.deep.equal([false, false, true]);
    });

    it('does not skip when checksum matches but file is missing on disk', async () => {
      const content = 'same content';
      const md5 = crypto.createHash('md5').update(content).digest('hex');
      const modelIndex = makeModelIndex({
        'out/missing.ts': { md5, date: '2025-01-01' },
      });
      const stage = createHashStage();
      const items: RenderedItem[] = [
        {
          filename: path.resolve('out/missing.ts'),
          content,
          step,
          modelIndex,
          formatters: [],
        },
      ];
      const results = await collect(stage(fromArray(items)));
      expect(results).to.have.lengthOf(1);
    });
  });
});

describe('generate() orphan orchestration', () => {
  let tmpDir: string;
  let originalCwd: string;
  let originalWorkers: string | undefined;

  beforeEach(() => {
    originalCwd = process.cwd();
    originalWorkers = process.env.CLAY_WORKERS;
    // Keep tests on the main-thread pipeline for determinism.
    process.env.CLAY_WORKERS = '0';
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-orphan-gen-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.removeSync(tmpDir);
    if (originalWorkers === undefined) {
      delete process.env.CLAY_WORKERS;
    } else {
      process.env.CLAY_WORKERS = originalWorkers;
    }
  });

  function scaffoldProject(entities: string[], resetClay = false): void {
    if (resetClay || !fs.existsSync('.clay')) {
      fs.writeFileSync(
        '.clay',
        JSON.stringify({ models: [] }, null, 2)
      );
    }
    fs.ensureDirSync('gen');
    fs.writeFileSync(
      'gen/generator.json',
      JSON.stringify(
        {
          partials: [],
          formatters: [],
          steps: [
            {
              generate: '{{name}}.ts',
              select: '$.model.entities[*]',
              target: 'src/',
            },
          ],
        },
        null,
        2
      )
    );
    fs.writeFileSync('gen/{{name}}.ts', 'export const {{name}} = true;\n');
    fs.writeFileSync(
      'model.json',
      JSON.stringify(
        {
          generators: ['gen/generator'],
          model: {
            entities: entities.map((name) => ({ name })),
          },
        },
        null,
        2
      )
    );
  }

  it('removes orphan entity files after model shrinks and saves ledger', async () => {
    const { generate } = require('../src/generate-api');

    scaffoldProject(['User', 'Order'], true);
    await generate(tmpDir, {
      workers: false,
      force: true,
      modelPath: 'model.json',
      verbose: false,
    });

    expect(fs.existsSync('src/User.ts')).to.equal(true);
    expect(fs.existsSync('src/Order.ts')).to.equal(true);

    const clayAfterFirst = JSON.parse(fs.readFileSync('.clay', 'utf8'));
    const filesAfterFirst = Object.keys(clayAfterFirst.models[0].generated_files || {});
    expect(filesAfterFirst.some((f: string) => f.endsWith('Order.ts'))).to.equal(true);

    // Shrink model — Order is gone
    scaffoldProject(['User']); // keep .clay ledger from first pass
    await generate(tmpDir, {
      workers: false,
      force: true,
      modelPath: 'model.json',
      verbose: false,
    });

    expect(fs.existsSync('src/User.ts')).to.equal(true);
    expect(fs.existsSync('src/Order.ts')).to.equal(false);

    const clayAfter = JSON.parse(fs.readFileSync('.clay', 'utf8'));
    const filesAfter = Object.keys(clayAfter.models[0].generated_files || {});
    expect(filesAfter.some((f: string) => f.endsWith('Order.ts'))).to.equal(false);
    expect(filesAfter.some((f: string) => f.endsWith('User.ts'))).to.equal(true);
  });

  it('forces regenerate when a tracked file is missing (ledger drift)', async () => {
    const { generate } = require('../src/generate-api');

    scaffoldProject(['User'], true);
    await generate(tmpDir, {
      workers: false,
      force: true,
      modelPath: 'model.json',
      verbose: false,
    });
    expect(fs.existsSync('src/User.ts')).to.equal(true);

    fs.removeSync('src/User.ts');
    expect(fs.existsSync('src/User.ts')).to.equal(false);

    // No model change — without drift detection this would skip
    await generate(tmpDir, {
      workers: false,
      force: false,
      modelPath: 'model.json',
      verbose: false,
    });
    expect(fs.existsSync('src/User.ts')).to.equal(true);
  });

  it('does not sweep orphans when a sibling model fails', async () => {
    const { generate } = require('../src/generate-api');

    fs.writeFileSync('.clay', JSON.stringify({ models: [] }, null, 2));

    fs.ensureDirSync('genA');
    fs.writeFileSync(
      'genA/generator.json',
      JSON.stringify({
        partials: [],
        formatters: [],
        steps: [
          {
            generate: '{{name}}.ts',
            select: '$.model.entities[*]',
            target: 'outA/',
          },
        ],
      })
    );
    fs.writeFileSync('genA/{{name}}.ts', 'A {{name}}\n');
    fs.writeFileSync(
      'modelA.json',
      JSON.stringify({
        generators: ['genA/generator'],
        model: { entities: [{ name: 'Keep' }, { name: 'Drop' }] },
      })
    );

    fs.ensureDirSync('genB');
    fs.writeFileSync(
      'genB/generator.json',
      JSON.stringify({
        partials: [],
        formatters: [],
        steps: [
          {
            generate: '{{name}}.ts',
            select: '$.model.entities[*]',
            target: 'outB/',
          },
        ],
      })
    );
    fs.writeFileSync('genB/{{name}}.ts', 'B {{name}}\n');
    fs.writeFileSync(
      'modelB.json',
      JSON.stringify({
        generators: ['genB/generator'],
        model: { entities: [{ name: 'Other' }] },
      })
    );

    // Register both models in .clay
    await generate(tmpDir, {
      workers: false,
      force: true,
      modelPath: 'modelA.json',
      verbose: false,
    });
    await generate(tmpDir, {
      workers: false,
      force: true,
      modelPath: 'modelB.json',
      verbose: false,
    });
    expect(fs.existsSync('outA/Drop.ts')).to.equal(true);

    // Shrink A (would orphan Drop) and break B's generator
    fs.writeFileSync(
      'modelA.json',
      JSON.stringify({
        generators: ['genA/generator'],
        model: { entities: [{ name: 'Keep' }] },
      })
    );
    fs.writeFileSync(
      'modelB.json',
      JSON.stringify({
        generators: ['genMissing/generator'],
        model: { entities: [{ name: 'Other' }] },
      })
    );

    let threw = false;
    try {
      await generate(tmpDir, { workers: false, force: true, verbose: false });
    } catch {
      threw = true;
    }
    expect(threw).to.equal(true);

    // Barrier failure: no orphan sweep — Drop.ts must still exist
    expect(fs.existsSync('outA/Drop.ts')).to.equal(true);
    expect(fs.existsSync('outA/Keep.ts')).to.equal(true);
  });
});
