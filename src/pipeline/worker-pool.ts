/**
 * Worker thread pool for parallel batch rendering.
 * Each worker loads models from disk independently — no serialization of model data.
 */
import { Worker } from 'worker_threads';
import path from 'path';
import os from 'os';
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
  error?: SerializedWorkerError;
}

interface PendingWork {
  resolve: (results: RenderResult[]) => void;
  reject: (error: Error) => void;
}

export class RenderWorkerPool {
  private workers: Worker[] = [];
  private pending = new Map<number, PendingWork>();
  private nextId = 0;
  private roundRobin = 0;
  private terminated = false;

  constructor(poolSize: number) {
    const jsPath = path.resolve(__dirname, 'render-worker.js');
    const tsPath = path.resolve(__dirname, 'render-worker.ts');
    const fs = require('fs');
    const workerPath = fs.existsSync(jsPath) ? jsPath : tsPath;
    const execArgv = workerPath.endsWith('.ts') ? ['--require', 'ts-node/register'] : [];

    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerPath, { execArgv });

      worker.on('message', (msg: BatchRenderResponse) => {
        const work = this.pending.get(msg.id);
        if (!work) return;
        this.pending.delete(msg.id);

        if (msg.error) {
          work.reject(deserializeWorkerError(msg.error));
        } else {
          work.resolve(msg.results);
        }
      });

      worker.on('error', (err) => {
        for (const [id, work] of this.pending) {
          work.reject(err);
          this.pending.delete(id);
        }
      });

      this.workers.push(worker);
    }
  }

  /**
   * Render all items for a generate step in a worker thread.
   * The worker loads the model from disk, selects items, and renders.
   * Returns array of {filename, content} for items that were rendered.
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
  ): Promise<RenderResult[]> {
    if (this.terminated) {
      return Promise.reject(new Error('Worker pool terminated'));
    }

    const id = this.nextId++;
    const worker = this.workers[this.roundRobin % this.workers.length];
    this.roundRobin++;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
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

  async terminate(): Promise<void> {
    this.terminated = true;
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
    for (const [, work] of this.pending) {
      work.reject(new Error('Worker pool terminated'));
    }
    this.pending.clear();
  }

  static defaultPoolSize(): number {
    return Math.min(Math.max(Math.floor(os.cpus().length / 2), 2), 8);
  }
}
