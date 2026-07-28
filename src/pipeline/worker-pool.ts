/**
 * Worker thread pool for parallel batch rendering.
 * Each worker loads models from disk independently — no serialization of model data.
 */
import { Worker } from 'worker_threads';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { deserializeWorkerError, type SerializedWorkerError } from './worker-error';

interface BatchRenderRequest {
  id: number;
  modelPath: string;
  jsonPath: string;
  templatePath: string;
  fileNamePattern: string;
  partials: string[];
  partialsDir: string;
  touch: boolean;
  engine?: 'handlebars' | 'ejs' | 'ts';
}

interface RenderResult {
  filename: string;
  content: string;
}

interface BatchRenderResponse {
  id: number;
  results: RenderResult[];
  skippedTouch?: string[];
  error?: SerializedWorkerError;
}

export interface RenderBatchResult {
  results: RenderResult[];
  skippedTouch: string[];
}

interface PendingWork {
  resolve: (results: RenderBatchResult) => void;
  reject: (error: Error) => void;
}

function resolveWorkerScript(): string {
  const candidates = [
    path.resolve(__dirname, 'render-worker.js'),
    path.resolve(__dirname, '..', '..', 'dist', 'src', 'pipeline', 'render-worker.js'),
    path.resolve(__dirname, 'render-worker.ts'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    'Worker file not found. Run `npm run build` to compile render-worker.js, ' +
      'or ensure render-worker.ts exists next to worker-pool.'
  );
}

export class RenderWorkerPool {
  private workers: Worker[] = [];
  private pending = new Map<number, PendingWork>();
  private workerPending = new Map<Worker, Set<number>>();
  private deadWorkers = new Set<Worker>();
  private nextId = 0;
  private roundRobin = 0;
  private terminated = false;
  private restarting = false;
  private readonly workerPath: string;
  private readonly execArgv: string[];
  private readonly poolSize: number;

  constructor(poolSize: number, private verbose = false) {
    this.poolSize = poolSize;
    this.workerPath = resolveWorkerScript();
    this.execArgv = this.workerPath.endsWith('.ts')
      ? ['--require', 'ts-node/register']
      : [];
    if (this.verbose) {
      console.error(`[worker-pool] Loading worker from: ${this.workerPath}`);
    }
    this.spawnWorkers(poolSize);
  }

  private spawnWorkers(count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnOne();
    }
  }

  private spawnOne(): Worker {
    const worker = new Worker(this.workerPath, { execArgv: this.execArgv });
    this.workerPending.set(worker, new Set());

    worker.on('message', (msg: BatchRenderResponse) => {
      const work = this.pending.get(msg.id);
      if (!work) return;
      this.pending.delete(msg.id);
      this.workerPending.get(worker)?.delete(msg.id);

      if (msg.error) {
        work.reject(deserializeWorkerError(msg.error));
      } else {
        work.resolve({
          results: msg.results,
          skippedTouch: msg.skippedTouch || [],
        });
      }
    });

    worker.on('error', (err) => {
      console.error(`[worker-pool] Worker error (id=${worker.threadId}):`, err.message);
      this.rejectForWorker(worker, err);
    });

    worker.on('exit', (code) => {
      if (this.terminated || this.restarting) {
        if (this.verbose) {
          console.error(`[worker-pool] Worker exited (id=${worker.threadId}, code=${code})`);
        }
        return;
      }
      console.error(
        `[worker-pool] Worker exited unexpectedly (id=${worker.threadId}, code=${code}). ` +
          'If the worker printed a stack trace above, that is the root cause.'
      );
      this.rejectForWorker(worker, new Error(`Worker exited unexpectedly with code ${code}`));
      if (!this.terminated && !this.restarting) {
        this.replaceWorker(worker);
      }
    });

    this.workers.push(worker);
    return worker;
  }

  private replaceWorker(dead: Worker): void {
    const idx = this.workers.indexOf(dead);
    if (idx === -1) return;
    this.deadWorkers.delete(dead);
    this.workerPending.delete(dead);
    this.workers.splice(idx, 1);
    try {
      this.spawnOne();
    } catch (e) {
      console.error(
        '[worker-pool] Failed to replace dead worker:',
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  private rejectForWorker(worker: Worker, err: Error): void {
    const ids = this.workerPending.get(worker);
    if (!ids) return;
    this.deadWorkers.add(worker);
    for (const id of ids) {
      const work = this.pending.get(id);
      if (work) {
        work.reject(err);
        this.pending.delete(id);
      }
    }
    ids.clear();
  }

  private pickWorker(): Worker {
    const live = this.workers.filter((w) => !this.deadWorkers.has(w));
    if (live.length === 0) {
      throw new Error(
        'No live workers in the pool. Run with CLAY_WORKERS=0 to disable workers, ' +
          'or check worker logs for the underlying crash.'
      );
    }
    const worker = live[this.roundRobin % live.length];
    this.roundRobin++;
    return worker;
  }

  /**
   * Render all items for a generate step in a worker thread.
   * The worker loads the model from disk, selects items, and renders.
   */
  renderBatch(
    modelPath: string,
    jsonPath: string,
    templatePath: string,
    fileNamePattern: string,
    partials: string[],
    partialsDir: string,
    touch: boolean,
    engine?: 'handlebars' | 'ejs' | 'ts'
  ): Promise<RenderBatchResult> {
    if (this.terminated) {
      return Promise.reject(new Error('Worker pool terminated'));
    }

    const id = this.nextId++;
    let worker: Worker;
    try {
      worker = this.pickWorker();
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.workerPending.get(worker)!.add(id);
      const request: BatchRenderRequest = {
        id,
        modelPath,
        jsonPath,
        templatePath,
        fileNamePattern,
        partials,
        partialsDir,
        touch,
        engine,
      };
      worker.postMessage(request);
    });
  }

  /**
   * Tear down and recreate all workers so module/jiti caches are cold
   * (used before orphan-refresh second passes).
   */
  async restart(): Promise<void> {
    if (this.terminated) {
      throw new Error('Worker pool terminated');
    }
    if (this.verbose) {
      console.error('[worker-pool] Restarting pool to clear worker caches');
    }
    this.restarting = true;
    const oldWorkers = this.workers.slice();
    for (const [, work] of this.pending) {
      work.reject(new Error('Worker pool restarted'));
    }
    this.pending.clear();
    this.workerPending.clear();
    this.deadWorkers.clear();
    this.workers = [];
    this.roundRobin = 0;

    await Promise.all(oldWorkers.map((w) => w.terminate()));
    this.restarting = false;
    this.spawnWorkers(this.poolSize);
  }

  async terminate(): Promise<void> {
    if (this.terminated) {
      return;
    }
    this.terminated = true;
    if (this.verbose) {
      console.error('[worker-pool] Terminating pool');
    }
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
    for (const [, work] of this.pending) {
      work.reject(new Error('Worker pool terminated'));
    }
    this.pending.clear();
    this.workerPending.clear();
    this.deadWorkers.clear();
  }

  static defaultPoolSize(): number {
    return Math.min(Math.max(Math.floor(os.cpus().length / 2), 2), 8);
  }
}
