/**
 * Worker thread pool for parallel rendering.
 * Manages N workers, dispatches render requests, collects results.
 */
import { Worker } from 'worker_threads';
import path from 'path';
import os from 'os';

interface RenderRequest {
  id: number;
  templatePath: string;
  fileNamePattern: string;
  modelData: unknown;
  partials?: string[];
  partialsDir?: string;
}

interface RenderResponse {
  id: number;
  filename: string;
  content: string;
  error?: string;
}

interface PendingWork {
  resolve: (result: { filename: string; content: string }) => void;
  reject: (error: Error) => void;
}

export class RenderWorkerPool {
  private workers: Worker[] = [];
  private pending = new Map<number, PendingWork>();
  private nextId = 0;
  private roundRobin = 0;
  private terminated = false;

  constructor(
    poolSize: number,
    partials: string[],
    partialsDir: string
  ) {
    // Resolve worker path: prefer compiled .js, fall back to .ts via ts-node
    const jsPath = path.resolve(__dirname, 'render-worker.js');
    const tsPath = path.resolve(__dirname, 'render-worker.ts');
    const workerPath = require('fs').existsSync(jsPath) ? jsPath : tsPath;
    const execArgv = workerPath.endsWith('.ts') ? ['--require', 'ts-node/register'] : [];

    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerPath, {
        workerData: { partials, partialsDir },
        execArgv,
      });

      worker.on('message', (msg: RenderResponse) => {
        const work = this.pending.get(msg.id);
        if (!work) return;
        this.pending.delete(msg.id);

        if (msg.error) {
          work.reject(new Error(msg.error));
        } else {
          work.resolve({ filename: msg.filename, content: msg.content });
        }
      });

      worker.on('error', (err) => {
        // Reject all pending work on this worker
        for (const [id, work] of this.pending) {
          work.reject(err);
          this.pending.delete(id);
        }
      });

      this.workers.push(worker);
    }
  }

  render(
    templatePath: string,
    fileNamePattern: string,
    modelData: unknown,
    partials?: string[],
    partialsDir?: string
  ): Promise<{ filename: string; content: string }> {
    if (this.terminated) {
      return Promise.reject(new Error('Worker pool terminated'));
    }

    const id = this.nextId++;
    const worker = this.workers[this.roundRobin % this.workers.length];
    this.roundRobin++;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const request: RenderRequest = {
        id,
        templatePath,
        fileNamePattern,
        modelData,
        partials,
        partialsDir,
      };
      worker.postMessage(request);
    });
  }

  async terminate(): Promise<void> {
    this.terminated = true;
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
    // Reject any remaining pending work
    for (const [, work] of this.pending) {
      work.reject(new Error('Worker pool terminated'));
    }
    this.pending.clear();
  }

  static defaultPoolSize(): number {
    // Use half the CPU cores, minimum 2, max 8
    return Math.min(Math.max(Math.floor(os.cpus().length / 2), 2), 8);
  }
}
