const {expect} = require('chai')
const fs = require('fs-extra')

describe('the command line interface', ()=>{
  afterEach(()=>{
    fs.removeSync('./tmp')
  })
  describe('the generate command', ()=>{
    it('will generate using a specified model', ()=>{
      const cmdln = require('../src/command-line')

      cmdln.parse(['node', 'clay', 'generate', 'test/samples/cmd-example.json', 'tmp/output'])

      expect(fs.existsSync('./tmp/output/order.txt'), 'template file not generated').to.equal(true)
    })

    it('will throw exceptions if generator not found', ()=>{
      const cmdln = require('../src/command-line')

      const args = ['node', 'clay', 'generate', 'test/samples/example.json', 'tmp/output'] 
      
      expect(()=>cmdln.parse(args)).to.throw(/.*generator not found.*/g)
    })
  })
})
