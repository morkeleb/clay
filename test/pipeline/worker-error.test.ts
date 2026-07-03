// test/pipeline/worker-error.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import {
  serializeWorkerError,
  deserializeWorkerError,
  type SerializedWorkerError,
} from '../../src/pipeline/worker-error';

describe('worker error serialization', () => {
  it('round-trips an Error with message, multi-line stack, and custom name', () => {
    const original = new Error('template blew up');
    original.name = 'RenderTimeError';
    original.stack =
      'RenderTimeError: template blew up\n    at foo (a.ts:1:1)\n    at bar (b.ts:2:2)';

    const payload = serializeWorkerError(original);
    const restored = deserializeWorkerError(payload);

    expect(restored).to.be.instanceOf(Error);
    expect(restored.message).to.include('template blew up');
    expect(restored.name).to.equal('RenderTimeError');
    expect(restored.stack).to.be.a('string');
    // worker-side stack frames must survive to the main thread
    expect(restored.stack).to.include('foo (a.ts:1:1)');
    expect(restored.stack).to.include('bar (b.ts:2:2)');
  });

  it('handles a non-Error thrown string gracefully', () => {
    const payload = serializeWorkerError('boom, just a string');
    const restored = deserializeWorkerError(payload);
    expect(restored).to.be.instanceOf(Error);
    expect(restored.message).to.include('boom, just a string');
  });

  it('handles a non-Error thrown object gracefully', () => {
    const payload = serializeWorkerError({ some: 'object', code: 42 });
    const restored = deserializeWorkerError(payload);
    expect(restored).to.be.instanceOf(Error);
    expect(restored.message).to.be.a('string');
    expect(restored.message.length).to.be.greaterThan(0);
  });

  it('embeds render context (template/model/engine) into the reconstructed message', () => {
    const original = new Error('undefined is not a function');
    const payload = serializeWorkerError(original, {
      modelPath: 'models/user.clay.json',
      templatePath: 'clay/generators/api/routes.ts.hbs',
      engine: 'ts',
    });
    const restored = deserializeWorkerError(payload);

    expect(restored.message).to.include('undefined is not a function');
    expect(restored.message).to.include('models/user.clay.json');
    expect(restored.message).to.include('clay/generators/api/routes.ts.hbs');
    expect(restored.message).to.include('ts');
  });

  it('preserves the original stack even when render context is added', () => {
    const original = new Error('kaboom');
    original.stack = 'Error: kaboom\n    at deep (x.ts:9:9)';
    const payload = serializeWorkerError(original, {
      templatePath: 'templates/foo.hbs',
    });
    const restored = deserializeWorkerError(payload);
    expect(restored.stack).to.include('deep (x.ts:9:9)');
  });

  it('serialized payload is a plain, structured-clone-safe object', () => {
    const payload: SerializedWorkerError = serializeWorkerError(
      new Error('x')
    );
    // Must survive a structured-clone round-trip (worker postMessage semantics)
    const cloned = JSON.parse(JSON.stringify(payload));
    const restored = deserializeWorkerError(cloned);
    expect(restored.message).to.include('x');
  });
});
