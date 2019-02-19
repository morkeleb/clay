const generator = require('../src/generator')
const {expect} = require('chai')

const model = require('../src/model')
const fs = require('fs')
const rimraf = require('rimraf')

describe("a generator", ()=>{
    afterEach((done)=>{
        rimraf('./tmp', done)
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
    describe('generate with template', ()=>{
        describe('with jsonpath statement', ()=>{
            it('will generate the templates using jsonpath selection', ()=>{
                var g = generator.load('./test/samples/just-template-example.json');
                
                g.generate(model.load('./test/samples/example.json'), './tmp/test-output')

                expect(fs.existsSync('./tmp/test-output/order.txt'), 'template file not generated').to.equal(true)
            })
        })

        describe('partials', ()=>{
            it('will use generator partials', ()=>{

                var g = generator.load('./test/samples/just-template-example.json');
                
                g.generate(model.load('./test/samples/example.json'), './tmp/test-output')
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
                
                g.generate(model.load('./test/samples/example.json'), './tmp/test-output')

                expect(fs.existsSync('./tmp/test-output/order'), 'command not run for order').to.equal(true)
                expect(fs.existsSync('./tmp/test-output/product'), 'command not run for product').to.equal(true)
            })
        })

        describe('without jsonpath statement', ()=>{
            it('will run the command once', ()=>{
                var g = generator.load('./test/samples/just-command-example.json');
                
                g.generate(model.load('./test/samples/example.json'), './tmp/test-output')

                expect(fs.existsSync('./tmp/test-output/once'), 'template file not generated').to.equal(true)
            })
        })
    })
    describe('copy foundation', ()=>{
        describe('with jsonpath statement', ()=>{
            it('will copy to a templated path with input from jsonpath')
            it('will copy for each entry')
        })

        describe('without jsonpath statement', ()=>{
            it('will copy once')
        })
        describe('from git', ()=>{
           it('will clone a repo as source before copying')
        })
    })
})