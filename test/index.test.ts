import sinon from 'sinon';
import { expect } from 'chai';
import cmd from '../src/command-line';

describe('index.js', () => {
  let parseStub: sinon.SinonStub;
  let outputHelpStub: sinon.SinonStub;

  beforeEach(() => {
    parseStub = sinon.stub(cmd, 'parse');
    outputHelpStub = sinon.stub(cmd, 'outputHelp');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('will call the commandline functions', async () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'clay'];

    // Clear the module cache and re-import
    delete require.cache[require.resolve('../index')];
    await import('../index');

    process.argv = originalArgv;

    expect(parseStub.calledOnce, 'parse not called').to.be.true;
    expect(outputHelpStub.calledOnce, 'outputhelp not called').to.be.true;
  });
});
