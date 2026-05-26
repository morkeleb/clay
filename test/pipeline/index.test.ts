// test/pipeline/index.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { buildGeneratePipeline } from '../../src/pipeline/index';
import { FormatterCache } from '../../src/pipeline/formatter-cache';
import type { Generator } from '../../src/types/generator';
import type { ClayModelEntry } from '../../src/types/clay-file';

describe('pipeline factory', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-pipeline-'));
  });

  afterEach(() => {
    fs.removeSync(testDir);
  });

  it('builds a working pipeline that generates files', async () => {
    // Create a simple template
    const templateDir = path.join(testDir, 'templates');
    fs.mkdirSync(templateDir, { recursive: true });
    fs.writeFileSync(
      path.join(templateDir, '{{name}}.ts'),
      'export class {{name}} {}',
      'utf8'
    );

    const generator: Generator = {
      steps: [{ generate: '{{name}}.ts', select: '$.entities[*]', target: 'src/' }],
      partials: [],
      formatters: [],
    };

    const written: string[] = [];
    const modelIndex: ClayModelEntry = {
      path: 'model.json',
      generated_files: {},
      setFileCheckSum: (f: string) => { written.push(f); },
      getFileCheckSum: () => null,
      delFileCheckSum: () => {},
      load: () => ({}),
    };

    const outputDir = path.join(testDir, 'output');
    const cache = new FormatterCache(() => ({ apply: (_f: string, c: string) => c }));

    const run = buildGeneratePipeline(generator, cache);
    const model = { entities: [{ name: 'User' }, { name: 'Order' }] };
    const step = generator.steps[0] as any;

    await run(model, '$.entities[*]', templateDir, '{{name}}.ts', outputDir, modelIndex, step);

    expect(written).to.have.lengthOf(2);
    // Files should exist at outputDir/src/User.ts and outputDir/src/Order.ts
    const userFile = path.join(outputDir, 'src', 'User.ts');
    const orderFile = path.join(outputDir, 'src', 'Order.ts');
    expect(fs.existsSync(userFile)).to.be.true;
    expect(fs.existsSync(orderFile)).to.be.true;
    expect(fs.readFileSync(userFile, 'utf8')).to.equal('export class User {}');
    expect(fs.readFileSync(orderFile, 'utf8')).to.equal('export class Order {}');
  });
});
