// src/pipeline/concurrent.ts

import type { Stage } from './types';

export interface ConcurrentOptions {
  concurrency: number;
}

/**
 * Wraps a Stage<In, Out> to process up to `concurrency` items in parallel.
 *
 * For concurrency === 1, delegates directly to the inner stage (preserves order).
 * For concurrency > 1, output order is NOT guaranteed — items yield as they complete.
 *
 * Each input item is run through the stage independently via a single-item async
 * iterable, enabling true concurrent execution.
 */
export function concurrent<In, Out>(
  stage: Stage<In, Out>,
  options: ConcurrentOptions
): Stage<In, Out> {
  const { concurrency } = options;

  if (concurrency === 1) {
    return stage;
  }

  return async function* (input: AsyncIterable<In>): AsyncGenerator<Out> {
    // Each slot holds a promise resolving to { outputs: Out[], done: boolean }
    // We maintain a pool of running tasks and yield outputs as they complete.

    type TaskResult = { outputs: Out[] };

    // Collect outputs from one item run through the stage
    async function runItem(item: In): Promise<TaskResult> {
      async function* singleItem(): AsyncGenerator<In> {
        yield item;
      }

      const outputs: Out[] = [];
      for await (const out of stage(singleItem())) {
        outputs.push(out);
      }
      return { outputs };
    }

    const iter = input[Symbol.asyncIterator]();
    let error: unknown = undefined;
    let hasError = false;

    // We use a shared output queue and notify mechanism
    const queue: Out[] = [];
    let waitResolve: (() => void) | null = null;

    function notify() {
      if (waitResolve) {
        const r = waitResolve;
        waitResolve = null;
        r();
      }
    }

    async function waitForSlotOrOutput(): Promise<void> {
      return new Promise<void>((resolve) => {
        waitResolve = resolve;
      });
    }

    let inputDone = false;
    let activeCount = 0;

    async function launchTask(item: In): Promise<void> {
      activeCount++;
      try {
        const result = await runItem(item);
        for (const out of result.outputs) {
          queue.push(out);
        }
      } catch (e) {
        if (!hasError) {
          hasError = true;
          error = e;
        }
      } finally {
        activeCount--;
        notify();
      }
    }

    // Seed initial tasks
    async function fillSlots(): Promise<void> {
      while (activeCount < concurrency && !inputDone && !hasError) {
        const next = await iter.next();
        if (next.done) {
          inputDone = true;
          notify();
          break;
        }
        // Launch without awaiting — fire and forget into the pool
        void launchTask(next.value).then(() => {
          // notification already happens inside launchTask
        });
        // Give the microtask queue a chance to run so activeCount increments
        // before we check the loop condition again
        await Promise.resolve();
      }
    }

    // Main loop: fill slots, yield available outputs, wait when needed
    await fillSlots();

    while (!hasError && (activeCount > 0 || queue.length > 0)) {
      // Drain the queue first
      while (queue.length > 0) {
        yield queue.shift()!;
      }

      if (activeCount === 0) break;

      // Wait for a task to complete or output to appear
      await waitForSlotOrOutput();

      // After a task completed, try to launch more
      if (!inputDone && !hasError) {
        await fillSlots();
      }
    }

    if (hasError) {
      throw error;
    }

    // Drain any remaining queue items
    while (queue.length > 0) {
      yield queue.shift()!;
    }
  };
}
