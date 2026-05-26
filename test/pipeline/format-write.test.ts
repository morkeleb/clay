// test/pipeline/format-write.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { createFormatStage } from '../../src/pipeline/stages/format';
import { createWriteStage } from '../../src/pipeline/stages/write';
import { FormatterCache } from '../../src/pipeline/formatter-cache';
import type { ChangedItem, FormattedItem } from '../../src/pipeline/types';
import type { GeneratorStepGenerate } from '../../src/types/generator';
import type { ClayModelEntry } from '../../src/types/clay-file';

async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of gen) result.push(item);
  return result;
}

const dummyStep: GeneratorStepGenerate = {
  generate: 'template.hbs',
  select: '$.entities[*]',
};

function makeModelIndex(overrides?: Partial<ClayModelEntry>): ClayModelEntry {
  return {
    path: 'model.json',
    generated_files: {},
    setFileCheckSum: () => {},
    getFileCheckSum: () => null,
    delFileCheckSum: () => {},
    load: () => ({}),
    ...overrides,
  };
}

describe('format stage', () => {
  it('passes content through formatters', async () => {
    const cache = new FormatterCache(() => ({
      apply: (_file: string, content: string) => content.toUpperCase(),
    }));

    const modelIndex = makeModelIndex();

    const items: ChangedItem[] = [
      {
        filename: '/tmp/test.ts',
        content: 'hello world',
        md5: 'abc',
        step: dummyStep,
        modelIndex,
        formatters: [{ pkg: 'my-formatter', options: {}, isNew: false }],
      },
    ];

    const stage = createFormatStage(cache);
    const results = await collect(stage(fromArray(items)));
    expect(results[0].content).to.equal('HELLO WORLD');
  });

  it('throws with diagnostic message when formatter fails', async () => {
    const cache = new FormatterCache(() => ({
      apply: () => { throw new Error('prettier crashed'); },
    }));

    const modelIndex = makeModelIndex();

    const items: ChangedItem[] = [
      {
        filename: '/tmp/test.ts',
        content: 'hello',
        md5: 'abc',
        step: dummyStep,
        modelIndex,
        formatters: [{ pkg: 'bad-formatter', options: {}, isNew: false }],
      },
    ];

    const stage = createFormatStage(cache);
    try {
      await collect(stage(fromArray(items)));
      expect.fail('should have thrown');
    } catch (e: any) {
      expect(e.message).to.equal('prettier crashed');
    }
  });

  it('passes through unchanged when no formatters', async () => {
    const cache = new FormatterCache(() => ({ apply: (_f: string, c: string) => c }));
    const modelIndex = makeModelIndex();

    const items: ChangedItem[] = [
      { filename: '/tmp/test.ts', content: 'hello', md5: 'abc', step: dummyStep, modelIndex, formatters: [] },
    ];

    const stage = createFormatStage(cache);
    const results = await collect(stage(fromArray(items)));
    expect(results[0].content).to.equal('hello');
  });
});

describe('write stage', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-write-'));
  });

  afterEach(() => {
    fs.removeSync(testDir);
  });

  it('writes file to disk and updates checksum', async () => {
    let checksumFile = '';
    let checksumMd5 = '';

    const modelIndex = makeModelIndex({
      setFileCheckSum: (f: string, md5: string) => {
        checksumFile = f;
        checksumMd5 = md5;
      },
    });

    const filename = path.join(testDir, 'output', 'test.ts');
    const items: FormattedItem[] = [
      { filename, content: 'generated code', md5: 'abc123', step: dummyStep, modelIndex },
    ];

    const stage = createWriteStage();
    const results = await collect(stage(fromArray(items)));

    expect(results).to.have.lengthOf(1);
    expect(results[0].filename).to.equal(filename);
    expect(fs.readFileSync(filename, 'utf8')).to.equal('generated code');
    expect(checksumFile).to.equal(filename);
    expect(checksumMd5).to.equal('abc123');
  });

  it('creates directories as needed', async () => {
    const modelIndex = makeModelIndex();

    const filename = path.join(testDir, 'deep', 'nested', 'dir', 'test.ts');
    const items: FormattedItem[] = [
      { filename, content: 'code', md5: 'x', step: dummyStep, modelIndex },
    ];

    const stage = createWriteStage();
    await collect(stage(fromArray(items)));

    expect(fs.existsSync(filename)).to.be.true;
  });
});
