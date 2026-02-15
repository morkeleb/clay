/**
 * Tests for loadWithIncludeMap
 * Note: Uses `any` types for test data
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadWithIncludeMap } from '../src/model';

describe('loadWithIncludeMap', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-include-map-'));
  });

  afterEach(() => {
    // Clean up require cache for files in tmpDir
    for (const key of Object.keys(require.cache)) {
      if (key.startsWith(tmpDir)) {
        delete require.cache[key];
      }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty includeMap when no includes', () => {
    const modelFile = path.join(tmpDir, 'model.json');
    fs.writeFileSync(
      modelFile,
      JSON.stringify({
        name: 'test',
        generators: ['docs'],
        model: {
          types: [{ name: 'order' }],
        },
      })
    );

    const { model, includeMap } = loadWithIncludeMap(modelFile);

    expect(model.name).to.equal('test');
    expect(includeMap.size).to.equal(0);
  });

  it('tracks included objects in the map with correct file path', () => {
    const entitiesDir = path.join(tmpDir, 'entities');
    fs.mkdirSync(entitiesDir);

    const orderFile = path.join(entitiesDir, 'order.json');
    fs.writeFileSync(
      orderFile,
      JSON.stringify({
        name: 'order',
        fields: [{ name: 'total' }],
      })
    );

    const modelFile = path.join(tmpDir, 'model.json');
    fs.writeFileSync(
      modelFile,
      JSON.stringify({
        name: 'test',
        generators: ['docs'],
        model: {
          types: [{ include: 'entities/order.json' }],
        },
      })
    );

    const { model, includeMap } = loadWithIncludeMap(modelFile);

    // The include should be resolved
    expect((model.model as any).types[0].name).to.equal('order');
    expect((model.model as any).types[0].include).to.be.undefined;

    // The object identity should be in the map
    const includedObj = (model.model as any).types[0];
    expect(includeMap.has(includedObj)).to.be.true;
    expect(includeMap.get(includedObj)).to.equal(path.resolve(orderFile));
  });

  it('handles multiple includes from different files', () => {
    const entitiesDir = path.join(tmpDir, 'entities');
    fs.mkdirSync(entitiesDir);

    const orderFile = path.join(entitiesDir, 'order.json');
    fs.writeFileSync(
      orderFile,
      JSON.stringify({ name: 'order', fields: [{ name: 'total' }] })
    );

    const productFile = path.join(entitiesDir, 'product.json');
    fs.writeFileSync(
      productFile,
      JSON.stringify({ name: 'product', fields: [{ name: 'sku' }] })
    );

    const modelFile = path.join(tmpDir, 'model.json');
    fs.writeFileSync(
      modelFile,
      JSON.stringify({
        name: 'test',
        generators: ['docs'],
        model: {
          types: [
            { include: 'entities/order.json' },
            { include: 'entities/product.json' },
          ],
        },
      })
    );

    const { model, includeMap } = loadWithIncludeMap(modelFile);

    expect(includeMap.size).to.equal(2);

    const orderObj = (model.model as any).types[0];
    const productObj = (model.model as any).types[1];

    expect(includeMap.get(orderObj)).to.equal(path.resolve(orderFile));
    expect(includeMap.get(productObj)).to.equal(path.resolve(productFile));
  });

  it('resolves nested includes', () => {
    const entitiesDir = path.join(tmpDir, 'entities');
    const subDir = path.join(tmpDir, 'entities', 'sub');
    fs.mkdirSync(entitiesDir);
    fs.mkdirSync(subDir);

    const addressFile = path.join(subDir, 'address.json');
    fs.writeFileSync(
      addressFile,
      JSON.stringify({ street: 'Main St', city: 'Springfield' })
    );

    const orderFile = path.join(entitiesDir, 'order.json');
    fs.writeFileSync(
      orderFile,
      JSON.stringify({
        name: 'order',
        address: { include: 'entities/sub/address.json' },
      })
    );

    const modelFile = path.join(tmpDir, 'model.json');
    fs.writeFileSync(
      modelFile,
      JSON.stringify({
        name: 'test',
        generators: ['docs'],
        model: {
          types: [{ include: 'entities/order.json' }],
        },
      })
    );

    const { model, includeMap } = loadWithIncludeMap(modelFile);

    // Top-level include resolved
    const orderObj = (model.model as any).types[0];
    expect(orderObj.name).to.equal('order');
    expect(includeMap.has(orderObj)).to.be.true;
    expect(includeMap.get(orderObj)).to.equal(path.resolve(orderFile));

    // Nested include resolved
    const addressObj = orderObj.address;
    expect(addressObj.street).to.equal('Main St');
    expect(includeMap.has(addressObj)).to.be.true;
    expect(includeMap.get(addressObj)).to.equal(path.resolve(addressFile));
  });

  it('still applies mixins after includes', () => {
    const entitiesDir = path.join(tmpDir, 'entities');
    fs.mkdirSync(entitiesDir);

    const orderFile = path.join(entitiesDir, 'order.json');
    fs.writeFileSync(
      orderFile,
      JSON.stringify({
        name: 'order',
        events: [],
        mixin: ['add_event'],
      })
    );

    const modelFile = path.join(tmpDir, 'model.json');
    fs.writeFileSync(
      modelFile,
      JSON.stringify({
        name: 'test',
        generators: ['docs'],
        mixins: [
          {
            type: 'function',
            name: 'add_event',
            function: "(piece) => piece.events.push({name: 'created'})",
          },
        ],
        model: {
          types: [{ include: 'entities/order.json' }],
        },
      })
    );

    const { model, includeMap } = loadWithIncludeMap(modelFile);

    const orderObj = (model.model as any).types[0];
    // Mixin should have been applied
    expect(orderObj.events).to.deep.equal([{ name: 'created' }]);
    // Include map should still track the object
    expect(includeMap.has(orderObj)).to.be.true;
  });
});
