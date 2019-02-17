const {expect} = require('chai')

const model = require('../src/model')

describe("the model module", ()=>{
    describe('basic initailization',()=>{
        var result = null;
        beforeEach(()=>{
            result = model.load('./test/samples/example.json');

        })
        it('will load a model from a path', ()=>{
            expect(result).to.not.equal(undefined)
        })

        it('will have a generators section acording to the file', ()=>{
            expect(result.generators).to.deep.equal(['documentation'])
        });
        it('will have a mixin according to the sample', ()=>{
            expect(result.mixins).to.deep.equal([
                {
                    "type":"function",
                    "name":"has_created",
                    "function":"(piece)=>piece.events.push({'name': piece.name+'created'})"
                }
            ]);

        })
        it("will have a model", ()=>{
            expect(result.model).to.deep.equal({
                "types":[
                  {
                    "name": "order",
                    "mixin": ["has_created"],
                    "commands": [
                      {
                        "name": "finish_order",
                        "raise": "order_finished",
                        "parameters": [
                          {
                            "name": "finished"
                          }
                        ]
                      }
                    ],
                    "events": [],
                    "fields": [
                      {
                        "name": "test"
                      }
                    ]
            
                  }
                ]
              });
        })
    })
});