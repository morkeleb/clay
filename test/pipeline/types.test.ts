// test/pipeline/types.test.ts
import { expect } from 'chai';
import {
  pipeline,
  compose,
  type Stage,
  type SelectItem,
  type RenderedItem,
  type ChangedItem,
  type FormattedItem,
  type WrittenItem,
} from '../../src/pipeline/types';

describe('pipeline types', () => {
  // Helper: a trivial stage that passes through
  function identity<T>(): Stage<T, T> {
    return async function* (input) {
      for await (const item of input) {
        yield item;
      }
    };
  }

  // Helper: convert an array to an async iterable
  async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
    for (const item of items) {
      yield item;
    }
  }

  // Helper: collect async iterable into array
  async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
    const result: T[] = [];
    for await (const item of gen) {
      result.push(item);
    }
    return result;
  }

  it('compose connects two stages', async () => {
    const double: Stage<number, number> = async function* (input) {
      for await (const n of input) yield n * 2;
    };
    const toString: Stage<number, string> = async function* (input) {
      for await (const n of input) yield String(n);
    };

    const composed = compose(double, toString);
    const result = await collect(composed(fromArray([1, 2, 3])));
    expect(result).to.deep.equal(['2', '4', '6']);
  });

  it('PipelineBuilder chains stages with type safety', async () => {
    const double: Stage<number, number> = async function* (input) {
      for await (const n of input) yield n * 2;
    };
    const toString: Stage<number, string> = async function* (input) {
      for await (const n of input) yield String(n);
    };
    const addBang: Stage<string, string> = async function* (input) {
      for await (const s of input) yield s + '!';
    };

    const built = pipeline(double).pipe(toString).pipe(addBang).build();
    const result = await collect(built(fromArray([5, 10])));
    expect(result).to.deep.equal(['10!', '20!']);
  });

  it('identity stage passes items through unchanged', async () => {
    const items = [1, 2, 3];
    const result = await collect(identity<number>()(fromArray(items)));
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it('empty input produces empty output', async () => {
    const double: Stage<number, number> = async function* (input) {
      for await (const n of input) yield n * 2;
    };
    const result = await collect(double(fromArray([])));
    expect(result).to.deep.equal([]);
  });

  it('stages can filter by not yielding', async () => {
    const evensOnly: Stage<number, number> = async function* (input) {
      for await (const n of input) {
        if (n % 2 === 0) yield n;
      }
    };
    const result = await collect(evensOnly(fromArray([1, 2, 3, 4, 5])));
    expect(result).to.deep.equal([2, 4]);
  });

  it('stages can expand (1 input → N outputs)', async () => {
    const duplicate: Stage<number, number> = async function* (input) {
      for await (const n of input) {
        yield n;
        yield n;
      }
    };
    const result = await collect(duplicate(fromArray([1, 2])));
    expect(result).to.deep.equal([1, 1, 2, 2]);
  });

  it('pipeline item types are structurally compatible through the pipeline', () => {
    // Verify the item interfaces are structurally sound by checking stage compatibility
    // SelectItem -> RenderedItem -> ChangedItem -> FormattedItem -> WrittenItem
    const _selectStage: Stage<SelectItem, RenderedItem> = async function* (
      _input
    ) {
      // no-op — compile-time check only
    };
    const _renderStage: Stage<RenderedItem, ChangedItem> = async function* (
      _input
    ) {
      // no-op — compile-time check only
    };
    const _changeStage: Stage<ChangedItem, FormattedItem> = async function* (
      _input
    ) {
      // no-op — compile-time check only
    };
    const _formatStage: Stage<FormattedItem, WrittenItem> = async function* (
      _input
    ) {
      // no-op — compile-time check only
    };

    // Build a full pipeline — TypeScript enforces the type chain compiles
    const fullPipeline = pipeline(_selectStage)
      .pipe(_renderStage)
      .pipe(_changeStage)
      .pipe(_formatStage)
      .build();

    expect(fullPipeline).to.be.a('function');
  });
});
