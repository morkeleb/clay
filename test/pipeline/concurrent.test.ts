// test/pipeline/concurrent.test.ts
import { expect } from 'chai';
import { concurrent } from '../../src/pipeline/concurrent';
import type { Stage } from '../../src/pipeline/types';

async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of gen) result.push(item);
  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('concurrent', () => {
  it('processes items with specified concurrency', async () => {
    let maxConcurrent = 0;
    let running = 0;

    const slow: Stage<number, number> = async function* (input) {
      for await (const n of input) {
        running++;
        if (running > maxConcurrent) maxConcurrent = running;
        await delay(20);
        running--;
        yield n * 2;
      }
    };

    const parallelSlow = concurrent(slow, { concurrency: 3 });
    const result = await collect(parallelSlow(fromArray([1, 2, 3, 4, 5, 6])));

    // All items processed
    expect(result.sort((a, b) => a - b)).to.deep.equal([2, 4, 6, 8, 10, 12]);
    // Concurrency was actually used (at least 2 ran at once)
    expect(maxConcurrent).to.be.greaterThan(1);
    // Did not exceed limit
    expect(maxConcurrent).to.be.at.most(3);
  });

  it('with concurrency 1 behaves like sequential', async () => {
    const order: number[] = [];
    const track: Stage<number, number> = async function* (input) {
      for await (const n of input) {
        order.push(n);
        yield n;
      }
    };

    const seq = concurrent(track, { concurrency: 1 });
    await collect(seq(fromArray([1, 2, 3])));
    expect(order).to.deep.equal([1, 2, 3]);
  });

  it('propagates errors from the inner stage', async () => {
    const failing: Stage<number, number> = async function* (input) {
      for await (const n of input) {
        if (n === 3) throw new Error('boom');
        yield n;
      }
    };

    const parallel = concurrent(failing, { concurrency: 2 });

    try {
      await collect(parallel(fromArray([1, 2, 3, 4])));
      expect.fail('should have thrown');
    } catch (e: any) {
      expect(e.message).to.equal('boom');
    }
  });

  it('handles empty input', async () => {
    const identity: Stage<number, number> = async function* (input) {
      for await (const n of input) yield n;
    };

    const parallel = concurrent(identity, { concurrency: 5 });
    const result = await collect(parallel(fromArray([])));
    expect(result).to.deep.equal([]);
  });
});
