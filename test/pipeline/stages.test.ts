// test/pipeline/stages.test.ts
import { expect } from 'chai';
import path from 'path';
import crypto from 'crypto';
import { createSelectStage } from '../../src/pipeline/stages/select';
import { createRenderStage } from '../../src/pipeline/stages/render';
import { createHashStage } from '../../src/pipeline/stages/hash';
import type { SelectItem, RenderedItem } from '../../src/pipeline/types';
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

const dummyModelIndex: ClayModelEntry = {
  path: 'model.json',
  output: '',
  generated_files: {},
  setFileCheckSum: () => {},
  getFileCheckSum: () => null,
  delFileCheckSum: () => {},
  load: () => ({}),
};

describe('pipeline stages', () => {
  describe('select', () => {
    it('yields one SelectItem per JSONPath match', async () => {
      const model = { entities: [{ name: 'User' }, { name: 'Order' }] };
      const stage = createSelectStage(
        model,
        '$.entities[*]',
        'templates/entity.hbs',
        'output/{{name}}.ts',
        'src/',
        dummyStep,
        dummyModelIndex
      );

      const items = await collect(stage);
      expect(items).to.have.lengthOf(2);
      // JSONPath helper adds clay_* properties to selected items
      expect((items[0].modelData as any).name).to.equal('User');
      expect((items[1].modelData as any).name).to.equal('Order');
    });
  });

  describe('render', () => {
    it('renders template with model data', async () => {
      const templatePath = path.resolve('test/samples/templates/simple.hbs');
      const items: SelectItem[] = [
        {
          modelData: { name: 'User' },
          templatePath,
          fileNamePattern: 'output/{{name}}.ts',
          outputDir: 'src/',
          step: dummyStep,
          modelIndex: dummyModelIndex,
        },
      ];

      const stage = createRenderStage();
      const results = await collect(stage(fromArray(items)));
      expect(results).to.have.lengthOf(1);
      expect(results[0].filename).to.include('User');
      expect(results[0].content).to.equal('export class User {}');
    });
  });

  describe('hash', () => {
    it('passes through items whose checksum has changed', async () => {
      const items: RenderedItem[] = [
        {
          filename: '/tmp/test-output/changed.ts',
          content: 'new content',
          step: dummyStep,
          modelIndex: { ...dummyModelIndex, getFileCheckSum: () => 'old-md5' },
        },
      ];

      const stage = createHashStage();
      const results = await collect(stage(fromArray(items)));
      expect(results).to.have.lengthOf(1);
      expect(results[0].md5).to.be.a('string');
      expect(results[0].md5).to.have.lengthOf(32);
    });

    it('filters out items whose checksum matches', async () => {
      const content = 'same content';
      const md5 = crypto.createHash('md5').update(content).digest('hex');

      const items: RenderedItem[] = [
        {
          filename: '/tmp/test-output/unchanged.ts',
          content,
          step: dummyStep,
          modelIndex: { ...dummyModelIndex, getFileCheckSum: () => md5 },
        },
      ];

      const stage = createHashStage();
      const results = await collect(stage(fromArray(items)));
      expect(results).to.have.lengthOf(0);
    });
  });
});
