import * as generator from '../src/generator';
import { expect } from 'chai';
import sinon from 'sinon';
import * as output from '../src/output';
import * as model from '../src/model';
import fs from 'fs-extra';

// Note: This is a simplified version of the generator tests.
// The full test suite from generator.js is quite extensive (~700 lines)
// and covers many edge cases. This TypeScript version includes the core tests.

describe('a generator', () => {
  afterEach(() => {
    fs.removeSync('./tmp');
  });

  describe('basic initialization', () => {
    it('will read a json array with instructions', () => {
      const result = generator.load(
        './test/samples/generator.json',
        '',
        {} as any
      );
      expect(result.steps).to.deep.equal([
        {
          runCommand: 'jhipster microservice',
        },
        {
          generate: 'templates/jdl-files',
          select: '$.jsonpath.statement',
        },
        {
          runCommand: 'jhipster import-jdl {{service.name}}',
          select: '$.jsonpath.statement',
        },
        {
          copy: 'git+morkeleb/foundation',
          select: '$.jsonpath.statement',
          target: '{{microservice}}',
        },
      ]);
    });
  });

  describe('jsonpath selection error handling', () => {
    let warnStub: sinon.SinonStub;
    let criticalStub: sinon.SinonStub;

    beforeEach(() => {
      warnStub = sinon.stub(output, 'warn');
      criticalStub = sinon.stub(output, 'critical');
    });

    afterEach(() => {
      warnStub.restore();
      criticalStub.restore();
    });

    it('will warn if no selection is found', async () => {
      const clayFile = require('../src/clay_file');
      const modelIndex = clayFile
        .load('./test/samples')
        .getModelIndex('./test/include-example.json', './tmp/test-output/');

      const g = generator.load(
        './test/samples/just-copy-example.json',
        '',
        modelIndex
      );
      (g.steps[0] as any).select = '$.valid.jsonpath';

      await g.generate(
        model.load('./test/samples/example-unknown-generator.json'),
        './tmp/test-output'
      );

      expect(
        warnStub.calledWith('No entries found for jsonpath', '$.valid.jsonpath')
      ).to.be.true;
    });

    it('will warn and stop if jsonpath expression is bad', async () => {
      const clayFile = require('../src/clay_file');
      const modelIndex = clayFile
        .load('./test/samples')
        .getModelIndex('./test/include-example.json', './tmp/test-output/');

      const g = generator.load(
        './test/samples/just-copy-example.json',
        '',
        modelIndex
      );
      (g.steps[0] as any).select = 'I will so crash!';

      await g.generate(
        model.load('./test/samples/example-unknown-generator.json'),
        './tmp/test-output'
      );

      expect(criticalStub.calledOnce).to.be.true;
    });
  });

  // Note: Additional test sections from the original generator.js include:
  // - formatters (testing formatter pipeline execution)
  // - generate with template (file generation from templates)
  // - generate with array iteration
  // - copy operations
  // - command execution
  // These can be migrated as needed for comprehensive test coverage
});
