const generator = require('../src/generator')
const {expect} = require('chai')
const sinon = require('sinon')
const output = require('../src/output')

const model = require('../src/model')
const fs = require('fs-extra')
const path = require('path')

describe("a generator", ()=>{
  afterEach(()=>{
    fs.removeSync('./tmp')
  })
  describe("basic initialization", ()=>{
    it('will read a json array with instructions', ()=>{
      var result = generator.load('./test/samples/generator.json')
      expect(result.steps).to.deep.equal([
        {
          "runCommand": "jhipster microservice"
        },
        {
          "generate": "templates/jdl-files",
          "select": "jsonpath statement"
        },
        {
          "runCommand": "jhipster import-jdl {{service.name}}",
          "select": "jsonpath statement"
        },
        {
          "copy": "git+morkeleb/foundation",
          "select": "jsonpath statement",
          "target": "{{microservice}}"
        }
      ])
    })
  })
  describe('jsonpath selection error handling', ()=>{
    afterEach(()=>{
      output.warn.restore()
      output.critical.restore()
    })
    beforeEach(()=>{
      sinon.stub(output, 'warn')

      sinon.stub(output, 'critical')
    })
    it('will warn if no selection is found', ()=>{
      var g = generator.load('./test/samples/just-copy-example.json');
        
      g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output')

      expect(output.warn.calledWith('No entires found for jsonpath ', g.steps[5].select));
      
    })
    it('will warn and stop if jsonpath expression is bad', ()=>{
      var g = generator.load('./test/samples/just-copy-example.json');
      g.steps[5].select = "I will so crash!"
      g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output')

      expect(output.critical.calledOnce).to.be.true;
    })
  })
  describe('generate with template', ()=>{
    describe('with jsonpath statement', ()=>{
      it('will generate the templates using jsonpath selection',  ()=>{
        var g = generator.load('./test/samples/just-template-example.json');
        
        g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output')
        
        expect(fs.existsSync('./tmp/test-output/order.txt'), 'template file not generated').to.equal(true)
      })
      it('will respect subdirectories', ()=>{
        var g = generator.load('./test/samples/just-template-example.json');
        
        g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output')
        
        expect(fs.existsSync('./tmp/test-output/types/order.tx'), 'template file not generated').to.equal(true)    
      })
      it('will respect targets with templating', ()=>{
        var g = generator.load('./test/samples/just-template-example.json');
        
        g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output')
        
        expect(fs.existsSync('./tmp/test-output/t1/order/order.txt'), 'template file not generated').to.equal(true)    
      })

      it('if target is just a single file, it will just template that file', ()=>{
        var g = generator.load('./test/samples/just-template-example.json');
        
        g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output')
        
        expect(fs.existsSync('./tmp/test-output/justfileorder.txt'), 'template file not generated').to.equal(true)    
      })
    })
    
    describe('partials', ()=>{
      it('will use generator partials', ()=>{
        
        var g = generator.load('./test/samples/just-template-example.json');
        
        g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output')
        var result = fs.readFileSync('./tmp/test-output/order.txt', 'utf8')
        
        expect(result).to.equal('hello\norder')
      })
    })
    
    describe('without jsonpath statement', ()=>{
      //todo: this isn't a thing right?
    })
  })
  describe('run command', ()=>{
    describe('with jsonpath statement', ()=>{
      it('will run the command for each result from jsonpath', ()=>{
        var g = generator.load('./test/samples/just-command-example.json');
        
        g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output')
        
        expect(fs.existsSync('./tmp/test-output/order'), 'command not run for order').to.equal(true)
        expect(fs.existsSync('./tmp/test-output/product'), 'command not run for product').to.equal(true)
      })
    })
    
    describe('without jsonpath statement', ()=>{
      it('will run the command once', ()=>{
        var g = generator.load('./test/samples/just-command-example.json');
        
        g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output')
        
        expect(fs.existsSync('./tmp/test-output/once'), 'template file not generated').to.equal(true)
      })
    })
  })
  describe('copy foundation', ()=>{
    describe('with jsonpath statement', ()=>{
      it('will copy to a templated path with input from jsonpath', ()=>{
        var g = generator.load('./test/samples/just-copy-example.json');
        
        g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output')
        
        expect(fs.existsSync('./tmp/test-output/copies/product/product/product/hi'), 'file not copied').to.equal(true)
        expect(fs.existsSync('./tmp/test-output/copies/order/order/order/hi'), 'file not copied').to.equal(true)
        expect(fs.existsSync('./tmp/test-output/order/hi'), 'file not copied').to.equal(true)
      })
    })
    
    describe('without jsonpath statement', ()=>{
      it('will copy once', ()=>{
        
        var g = generator.load('./test/samples/just-copy-example.json');
        
        g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output')
        
        expect(fs.existsSync('./tmp/test-output/once'), 'file not copied').to.equal(true)
      })
      it('will copy overwrite existing files', ()=>{
        
        var g = generator.load('./test/samples/just-copy-example.json');
        fs.ensureDirSync(path.resolve('./tmp/test-output/'))
        fs.writeFileSync(path.resolve('./tmp/test-output/once'), 'hi!');
        g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output')
        
        expect(fs.readFileSync('./tmp/test-output/once', 'utf8'), 'file not copied').to.equal('once')
      })
      it('will copy directories', ()=>{
        
        var g = generator.load('./test/samples/just-copy-example.json');
        
        g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output')
        
        expect(fs.existsSync('./tmp/test-output/level1/static'), 'file not copied').to.equal(true)
      })
    })
  })
})
