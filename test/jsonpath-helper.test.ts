/**
 * JSONPath helper tests - verifies data integrity and mutation safety
 */

import { expect } from 'chai';
import * as jph from '../src/jsonpath-helper';

describe('jsonpath-helper', () => {
  describe('data mutation safety', () => {
    it('should not mutate the original model when selecting', () => {
      const originalModel = {
        model: {
          types: [
            { name: 'User', fields: ['id', 'name'] },
            { name: 'Post', fields: ['id', 'title'] },
          ],
        },
      };

      // Make a deep copy to compare against
      const modelBeforeSelection = JSON.parse(JSON.stringify(originalModel));

      // Perform selection
      jph.select(originalModel, '$.model.types[*]');

      // Original model should be unchanged
      expect(originalModel).to.deep.equal(modelBeforeSelection);
      expect(originalModel.model.types[0]).to.not.have.property('clay_model');
      expect(originalModel.model.types[0]).to.not.have.property('clay_parent');
      expect(originalModel.model.types[0]).to.not.have.property('clay_key');
    });

    it('should handle multiple selections on the same model without corruption', () => {
      const model = {
        model: {
          types: [
            {
              name: 'User',
              actions: [
                { name: 'create', params: ['email'] },
                { name: 'update', params: ['id', 'email'] },
              ],
            },
            {
              name: 'Post',
              actions: [
                { name: 'publish', params: ['id'] },
                { name: 'delete', params: ['id'] },
              ],
            },
          ],
        },
      };

      const modelBeforeSelections = JSON.parse(JSON.stringify(model));

      // First selection
      const types = jph.select(model, '$.model.types[*]');
      expect(types).to.have.lengthOf(2);
      expect(types[0]).to.have.property('clay_model');
      expect(types[0]).to.have.property('clay_json_key');

      // Second selection on same model
      const actions = jph.select(model, '$.model.types[*].actions[*]');
      expect(actions).to.have.lengthOf(4);

      // Verify actions don't have corrupted data like [object Object]
      actions.forEach((action) => {
        expect(action.name).to.be.a('string');
        expect(action.name).to.not.equal('[object Object]');
        // Check that basic properties are intact (can't use JSON.stringify due to circular refs)
        expect(action).to.have.property('params');
        expect(Array.isArray(action.params)).to.be.true;
      });

      // Third selection - even more nested
      const params = jph.select(model, '$.model.types[*].actions[*].params[*]');
      // User: create(email), update(id, email) = 3
      // Post: publish(id), delete(id) = 2
      // Total = 5 params
      expect(params).to.have.lengthOf(5);
      params.forEach((param) => {
        expect(param).to.be.a('string');
        expect(param).to.not.equal('[object Object]');
      });

      // Original model should still be clean
      expect(model).to.deep.equal(modelBeforeSelections);
    });

    it('should not pollute model when used in template-like iteration', () => {
      const model = {
        services: [
          { name: 'UserService', methods: ['get', 'post'] },
          { name: 'AuthService', methods: ['login', 'logout'] },
        ],
      };

      // Simulate what happens in template generation - multiple selections
      const services = jph.select(model, '$.services[*]');

      // For each service, we might select methods (like in a template loop)
      services.forEach((service) => {
        const methods = jph.select(
          model,
          `$.services[?(@.name=='${service.name}')].methods[*]`
        );
        expect(methods.every((m) => typeof m === 'string')).to.be.true;
      });

      // Model should remain clean for subsequent uses
      const modelString = JSON.stringify(model);
      expect(modelString).to.not.include('clay_model');
      expect(modelString).to.not.include('clay_parent');
      expect(modelString).to.not.include('[object Object]');
    });
  });

  describe('clay_* properties', () => {
    it('should add clay_model to selected items', () => {
      const model = {
        model: {
          types: [{ name: 'User' }, { name: 'Post' }],
        },
      };

      const result = jph.select(model, '$.model.types[*]');

      expect(result[0]).to.have.property('clay_model');
      expect(result[0].clay_model).to.be.an('object');
      expect(result[0].clay_model).to.have.nested.property('model.types');
    });

    it('should add clay_parent to selected items', () => {
      const model = {
        model: {
          types: [{ name: 'User' }, { name: 'Post' }],
        },
      };

      const result = jph.select(model, '$.model.types[*]');

      expect(result[0]).to.have.property('clay_parent');
      expect(result[0].clay_parent).to.be.an('object');
    });

    it('should add clay_key to selected items', () => {
      const model = {
        model: {
          types: [{ name: 'User' }, { name: 'Post' }],
        },
      };

      const result = jph.select(model, '$.model.types[*]');

      expect(result[0]).to.have.property('clay_key');
      expect(result[1]).to.have.property('clay_key');
    });

    it('should add clay_json_key to selected items', () => {
      const model = {
        model: {
          types: [{ name: 'User' }, { name: 'Post' }],
        },
      };

      const result = jph.select(model, '$.model.types[*]');

      expect(result[0]).to.have.property('clay_json_key');
      expect(result[1]).to.have.property('clay_json_key');
    });

    it('should handle nested selections with clay_* properties', () => {
      const model = {
        api: {
          resources: [
            {
              name: 'users',
              endpoints: [
                { method: 'GET', path: '/users' },
                { method: 'POST', path: '/users' },
              ],
            },
          ],
        },
      };

      // Select endpoints
      const endpoints = jph.select(model, '$.api.resources[*].endpoints[*]');

      expect(endpoints).to.have.lengthOf(2);
      expect(endpoints[0]).to.have.property('clay_model');
      expect(endpoints[0]).to.have.property('clay_parent');
      expect(endpoints[0].method).to.equal('GET');
      expect(endpoints[0].path).to.equal('/users');
    });
  });

  describe('edge cases', () => {
    it('should handle empty selections gracefully', () => {
      const model = { model: { types: [] } };
      const result = jph.select(model, '$.model.types[*]');

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });

    it('should handle non-existent paths', () => {
      const model = { model: { types: [] } };
      const result = jph.select(model, '$.model.nonexistent[*]');

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });

    it('should not add clay_* properties to primitives', () => {
      const model = {
        model: {
          names: ['Alice', 'Bob', 'Charlie'],
        },
      };

      const result = jph.select(model, '$.model.names[*]');

      // Primitives should be returned as-is
      expect(result[0]).to.equal('Alice');
      expect(result[1]).to.equal('Bob');
      expect(result[2]).to.equal('Charlie');
    });

    it('should not add clay_* properties to arrays', () => {
      const model = {
        model: {
          types: [
            { name: 'User', tags: ['admin', 'user'] },
            { name: 'Post', tags: ['public', 'draft'] },
          ],
        },
      };

      const result = jph.select(model, '$.model.types[*].tags');

      // Arrays should not be modified
      expect(Array.isArray(result[0])).to.be.true;
      expect(result[0]).to.not.have.property('clay_model');
    });
  });

  describe('performance considerations', () => {
    it('should handle large models with multiple selections efficiently', () => {
      const model = {
        entities: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Entity${i}`,
          properties: Array.from({ length: 10 }, (_, j) => ({
            name: `prop${j}`,
            type: 'string',
          })),
        })),
      };

      const start = Date.now();

      // Multiple selections
      jph.select(model, '$.entities[*]');
      jph.select(model, '$.entities[*].properties[*]');
      jph.select(model, '$.entities[?(@.id < 10)]');

      const duration = Date.now() - start;

      // Should complete reasonably fast (< 1 second for this size)
      expect(duration).to.be.lessThan(1000);

      // Original model should still be clean
      expect(JSON.stringify(model)).to.not.include('clay_model');
    });
  });
});
