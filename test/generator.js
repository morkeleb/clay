const generator = require('../src/generator')
const {expect} = require('chai')

describe("a generator", ()=>{
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
            it('will generate the templates using jsoniq selection')
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