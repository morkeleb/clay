// src/pipeline/stages/command.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import * as ui from '../../output';

const execAsync = promisify(exec);

/**
 * Execute a shell command asynchronously.
 * Replaces the old execSync pattern — does not block the event loop.
 * Errors are logged but do not throw (matching original behavior).
 */
export async function executeCommand(
  command: string,
  cwd: string,
  options?: { npx?: boolean; verbose?: boolean }
): Promise<void> {
  let cmd = command;
  if (options?.npx) {
    cmd = `npx ${command}`;
  }

  await fs.ensureDir(cwd);
  if (options?.verbose) ui.execute(cmd);

  const execOptions: { cwd: string; maxBuffer: number } = {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  };

  try {
    const { stdout, stderr } = await execAsync(cmd, execOptions);

    if (options?.verbose) {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    ui.warn('error while executing', cmd, message);
  }
}
