/**
 * Model tests
 * Note: Uses `any` types for test data
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

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

  describe('include with missing file', () => {
    let result: any;

    beforeEach(() => {
      result = model.load('./test/samples/include-missing.json');
    });

    it('will resolve valid includes and skip missing ones', () => {
      // First type has a valid include that resolves
      expect(result.model.types[0].events).to.deep.equal([
        { name: 'ordercreated' },
      ]);
      // Second type has a missing include - should keep the include reference
      expect(result.model.types[1].include).to.equal('entities/nonexistent.json');
      expect(result.model.types[1].name).to.equal('placeholder');
    });
  });

  describe('loadWithIncludeMap with missing file', () => {
    let result: any;

    beforeEach(() => {
      result = model.loadWithIncludeMap('./test/samples/include-missing.json');
    });

    it('will not throw on missing includes', () => {
      expect(result.model).to.not.equal(undefined);
      expect(result.includeMap).to.be.an.instanceOf(Map);
    });

    it('will resolve valid includes into the map', () => {
      expect(result.includeMap.size).to.equal(1);
    });
  });
});
