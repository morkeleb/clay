import { expect } from 'chai';
import * as model from '../src/model';

describe('the model module', () => {
  describe('basic initialization', () => {
    let result: any;

    beforeEach(() => {
      result = model.load('./test/samples/example-unknown-generator.json');
    });

    it('will load a model from a path', () => {
      expect(result).to.not.equal(undefined);
    });

    it('will have a generators section according to the file', () => {
      expect(result.generators).to.deep.equal(['unknown']);
    });

    it('will have a mixin according to the sample', () => {
      expect(result.mixins).to.deep.equal([
        {
          type: 'function',
          name: 'has_created',
          function:
            "(piece)=>piece.events.push({'name': piece.name+'created'})",
        },
      ]);
    });

    it('will have a model', () => {
      expect(result.model).to.deep.equal({
        types: [
          {
            name: 'order',
            commands: [
              {
                name: 'finish_order',
                raise: 'order_finished',
                parameters: [
                  {
                    name: 'finished',
                  },
                ],
              },
            ],
            events: [{ name: 'ordercreated' }],
            fields: [
              {
                name: 'test',
              },
            ],
          },
          {
            name: 'product',
            events: [{ name: 'productcreated' }],
          },
        ],
      });
    });
  });

  describe('mixins', () => {
    let result: any;

    beforeEach(() => {
      result = model.load('./test/samples/example-unknown-generator.json');
    });

    it('will be able to add function to an entity', () => {
      expect(result.model.types[0].events).to.deep.equal([
        { name: 'ordercreated' },
      ]);
    });

    it('wont show in the resulting model', () => {
      expect(result.model.types[0].mixins).to.equal(undefined);
    });
  });

  describe('include', () => {
    let result: any;

    beforeEach(() => {
      result = model.load('./test/samples/include-example.json');
    });

    it('will include a file instead of its current object', () => {
      expect(result.model.types[0].events).to.deep.equal([
        { name: 'ordercreated' },
      ]);
    });

    it('wont show in the resulting model', () => {
      expect(result.model.types[0].include).to.equal(undefined);
    });
  });
});
