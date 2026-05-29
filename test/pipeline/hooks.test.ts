// test/pipeline/hooks.test.ts
import { expect } from 'chai';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { executePostGenerateHooks } from '../../src/pipeline/hooks';
import type { WrittenItem } from '../../src/pipeline/types';
import type { GeneratorStepGenerate } from '../../src/types/generator';

const hooksDir = path.resolve('test/samples/hooks');

function makeTouchStep(): GeneratorStepGenerate {
  return { generate: 'template.hbs', select: '$.types[*]', touch: true };
}

function makeGenerateStep(): GeneratorStepGenerate {
  return { generate: 'template.hbs', select: '$.types[*]' };
}

const dummyModelIndex: any = {
  path: 'model.json',
  output: '',
  generated_files: {},
  setFileCheckSum: () => {},
  getFileCheckSum: () => null,
  delFileCheckSum: () => {},
  load: () => ({}),
};

describe('post-generation hooks', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-hooks-'));
  });

  afterEach(() => {
    fs.removeSync(testDir);
  });

  describe('TypeScript hooks', () => {
    it('executes a TS hook with HookContext', async () => {
      const writtenItems: WrittenItem[] = [
        { filename: '/tmp/src/UserService.ts', md5: 'abc', step: makeTouchStep(), modelIndex: dummyModelIndex },
        { filename: '/tmp/src/User.ts', md5: 'def', step: makeGenerateStep(), modelIndex: dummyModelIndex },
      ];

      const model = {
        types: [{ name: 'User', fields: [{ name: 'id', type: 'string' }] }],
      };

      await executePostGenerateHooks(
        [{ run: 'test-hook.ts', select: '$.types[*]' }],
        model,
        writtenItems,
        testDir,
        hooksDir
      );

      const markerPath = path.join(testDir, 'hook-ran-User.txt');
      expect(fs.existsSync(markerPath)).to.be.true;
      const content = fs.readFileSync(markerPath, 'utf-8');
      expect(content).to.include('name: User');
      expect(content).to.include('hasHelpers: true');
      expect(content).to.include('generatedFiles: 2');
    });

    it('passes touch files to hook context', async () => {
      const writtenItems: WrittenItem[] = [
        { filename: '/tmp/src/OrderService.ts', md5: 'abc', step: makeTouchStep(), modelIndex: dummyModelIndex },
      ];

      const model = {
        types: [{ name: 'Order', fields: [] }],
      };

      await executePostGenerateHooks(
        [{ run: 'test-hook.ts', select: '$.types[*]' }],
        model,
        writtenItems,
        testDir,
        hooksDir
      );

      const content = fs.readFileSync(path.join(testDir, 'hook-ran-Order.txt'), 'utf-8');
      expect(content).to.include('touchFiles: 1');
    });

    it('skips items with onlyNewTouchFiles when no touch files created', async () => {
      const writtenItems: WrittenItem[] = [
        { filename: '/tmp/src/User.ts', md5: 'abc', step: makeGenerateStep(), modelIndex: dummyModelIndex },
      ];

      const model = {
        types: [{ name: 'User', fields: [] }],
      };

      await executePostGenerateHooks(
        [{ run: 'test-hook.ts', select: '$.types[*]', onlyNewTouchFiles: true }],
        model,
        writtenItems,
        testDir,
        hooksDir
      );

      // Hook should not have run — no marker file
      expect(fs.existsSync(path.join(testDir, 'hook-ran-User.txt'))).to.be.false;
    });

    it('runs hook without select for full model', async () => {
      const writtenItems: WrittenItem[] = [
        { filename: '/tmp/src/Service.ts', md5: 'abc', step: makeTouchStep(), modelIndex: dummyModelIndex },
      ];

      const model = { name: 'test-model', types: [] };

      await executePostGenerateHooks(
        [{ run: 'test-hook.ts' }],
        model,
        writtenItems,
        testDir,
        hooksDir
      );

      const markerPath = path.join(testDir, 'hook-ran-test-model.txt');
      expect(fs.existsSync(markerPath)).to.be.true;
    });
  });

  describe('failure handling', () => {
    it('logs warning but does not throw on hook failure', async () => {
      const writtenItems: WrittenItem[] = [];
      const model = { types: [{ name: 'Test' }] };

      // Should not throw
      await executePostGenerateHooks(
        [{ run: 'failing-hook.ts', select: '$.types[*]' }],
        model,
        writtenItems,
        testDir,
        hooksDir
      );
    });

    it('continues to next hook after a failure', async () => {
      const writtenItems: WrittenItem[] = [
        { filename: '/tmp/src/Thing.ts', md5: 'abc', step: makeTouchStep(), modelIndex: dummyModelIndex },
      ];
      const model = { name: 'test', types: [{ name: 'Thing' }] };

      await executePostGenerateHooks(
        [
          { run: 'failing-hook.ts', select: '$.types[*]' },
          { run: 'test-hook.ts' },
        ],
        model,
        writtenItems,
        testDir,
        hooksDir
      );

      // Second hook should have run despite first failing
      expect(fs.existsSync(path.join(testDir, 'hook-ran-test.txt'))).to.be.true;
    });

    it('warns on hooks without a run method', async () => {
      const writtenItems: WrittenItem[] = [];
      const model = { types: [{ name: 'X' }] };

      // Should not throw (warning only)
      await executePostGenerateHooks(
        [{ run: 'bad-hook.ts', select: '$.types[*]' }],
        model,
        writtenItems,
        testDir,
        hooksDir
      );
    });
  });

  describe('command hooks', () => {
    it('executes a shell command hook', async () => {
      const outFile = path.join(testDir, 'command-ran.txt');
      const writtenItems: WrittenItem[] = [];
      const model = {};

      await executePostGenerateHooks(
        [{ runCommand: `echo "hello" > "${outFile}"` }],
        model,
        writtenItems,
        testDir,
        testDir
      );

      expect(fs.existsSync(outFile)).to.be.true;
      expect(fs.readFileSync(outFile, 'utf-8').trim()).to.equal('hello');
    });

    it('applies Handlebars templating to commands with select', async () => {
      const namesFile = path.join(testDir, 'names.txt');
      const writtenItems: WrittenItem[] = [];
      const model = {
        types: [{ name: 'User' }, { name: 'Order' }],
      };

      await executePostGenerateHooks(
        [{ runCommand: `echo "{{name}}" >> "${namesFile}"`, select: '$.types[*]' }],
        model,
        writtenItems,
        testDir,
        testDir
      );

      const content = fs.readFileSync(namesFile, 'utf-8');
      expect(content).to.include('User');
      expect(content).to.include('Order');
    });
  });

  describe('sequential execution', () => {
    it('runs hooks in order', async () => {
      const logFile = path.join(testDir, 'order.txt');
      const writtenItems: WrittenItem[] = [];
      const model = {};

      await executePostGenerateHooks(
        [
          { runCommand: `echo "first" > "${logFile}"` },
          { runCommand: `echo "second" >> "${logFile}"` },
        ],
        model,
        writtenItems,
        testDir,
        testDir
      );

      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines[0]).to.equal('first');
      expect(lines[1]).to.equal('second');
    });
  });
});
