const sinon = require('sinon')
const {expect} = require('chai')
const output = require('../src/output')
const chalk = require('chalk')

describe('the output module', ()=>{
  before(()=>{
    sinon.stub(console, 'log')
    sinon.stub(console, 'warn')
    sinon.stub(process, 'exit')
    process.isCLI = true
  });
  after(()=>{
    console.log.restore()    
    console.warn.restore()
    process.exit.restore();
  })
  it('will print to the log for logging', ()=>{
    output.log('test')
    expect(console.log.calledWithMatch('test')).to.be.true;
  });
  it('will print to the log for copy', ()=>{
    output.copy('t2est', 'test2')
    sinon.assert.calledWith(console.log,chalk.magenta('copying: '), 't2est', chalk.magenta(' -> '), 'test2');
  });
  it('will print to the log for move', ()=>{
    output.move('t2es2t', 'te2st2')
    sinon.assert.calledWith(console.log,chalk.green('moving: '), 't2es2t', chalk.green(' -> '), 'te2st2');
  });
  it('will print to the log for write', ()=>{
    output.write('te12st')
    sinon.assert.calledWith(console.log,chalk.green('writing: '), 'te12st');
  });
  it('will print to the log for execute', ()=>{
    output.execute('tes2t')
    sinon.assert.calledWith(console.log,chalk.blue('executing: '), 'tes2t');
  });
  it('will print to the stderr for warn', ()=>{
    output.warn('test')
    sinon.assert.calledWith(console.warn,chalk.red('Warning! '), 'test');
  });
  it('will print to the stderr for critical and quit', ()=>{
    output.critical('test')
    sinon.assert.calledWith(console.warn,chalk.red('CRITICAL! '), 'test');
    expect(process.exit.calledOnce).to.be.true;
  });
})
