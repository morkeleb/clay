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

  it('will call the commandline functions', () => {
    process.argv = ['node', 'clay'];
    require('../index');
    expect(parseStub.calledOnce, 'parse not called').to.be.true;
    expect(outputHelpStub.calledOnce, 'outputhelp not called').to.be.true;
  });
});
