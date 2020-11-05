const {expect} = require('chai')
const fs = require('fs-extra')

function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve, ms));
}

describe('the command line interface', ()=>{
  afterEach(()=>{
    fs.removeSync('./tmp')
  })
  describe('the generate command', ()=>{
    it('will generate using a specified model', async ()=>{
      const cmdln = require('../src/command-line')

      cmdln.parse(['node', 'clay', 'generate', 'test/samples/cmd-example.json', 'tmp/output'])
      await sleep(1);
      expect(fs.existsSync('./tmp/output/order.txt'), 'template file not generated').to.equal(true)
    })

    it('will throw exceptions if generator not found', ()=>{
      const cmdln = require('../src/command-line')

      const args = ['node', 'clay', 'generate', 'test/samples/example-unknown-generator.json', 'tmp/output'] 
      
      expect(()=>cmdln.parse(args)).to.throw(/.*generator not found.*/g)
    })

    it('will supply the generator with a specified output if specified', async ()=>{
      const cmdln = require('../src/command-line')

      cmdln.parse(['node', 'clay', 'generate', 'test/samples/cmd-example.json', 'tmp/output'])
      await sleep(1);
      expect(fs.existsSync('./tmp/output/otheroutput/order.txt'), 'template file not generated').to.equal(true)
    })
  })
})
