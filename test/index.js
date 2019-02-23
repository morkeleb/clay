const sinon = require('sinon')
const {expect} = require('chai')
const cmd = require('../src/command-line')

describe('index.js', ()=>{
  beforeEach(()=>{
    sinon.replace(cmd, 'parse', sinon.fake())
    sinon.replace(cmd, 'outputHelp', sinon.fake())
  });
  it('will call the commandline functions', ()=>{
    process.argv = ['node', 'clay']
    require('../index');
    expect(cmd.parse.calledOnce).to.be.true;
    expect(cmd.outputHelp.calledOnce).to.be.true;
  });
})
