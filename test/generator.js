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
            expect(result).to.deep.equal([
                  {
                    "runCommand": "jhipster microservice"
                  },
                  {
                    "generate": "templates/jdl-files",
                    "select": "jsoniq statement"
                   },
                  {
                    "runCommand": "jhipster import-jdl {{service.name}}",
                    "select": "jsoniq statement"
                  },
                  {
                    "copyFoundation": "git+morkeleb/foundation",
                    "select": "jsoniq statement",
                    "target": "{{microservice}}"
                  }
            ])
        })
    })
    describe('generate with template', ()=>{
        describe('with jsoniq statement', ()=>{
            it('will generate the templates using jsoniq selection', ()=>{
                var g = generator.load('./test/samples/just-template-example.json');
                
                g.generate(model.load('./test/samples/example.json'), './tmp/test-output')

                expect(fs.existsSync('./tmp/test-output/order.txt'), 'template file not generated').to.equal(true)
            })
        })

        describe('partials', ()=>{
            it('will use generator partials')
        })

        describe('without jsoniq statement', ()=>{
            //todo: this isn't a thing right?
        })
    })
    describe('run command', ()=>{
        describe('with jsoniq statement', ()=>{
            it('will run the command templated with input from jsoniq')
            it('will run the command for each entry')
        })

        describe('without jsoniq statement', ()=>{
            it('will run the command once')
        })
    })
    describe('copy foundation', ()=>{
        describe('with jsoniq statement', ()=>{
            it('will copy to a templated path with input from jsoniq')
            it('will copy for each entry')
        })

        describe('without jsoniq statement', ()=>{
            it('will copy once')
        })
        describe('from git', ()=>{
           it('will clone a repo as source before copying')
        })
    })
})