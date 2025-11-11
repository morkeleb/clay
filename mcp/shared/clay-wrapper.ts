/**
 * Wrapper for executing Clay CLI commands
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Execute a Clay CLI command in the specified working directory
 */
export function executeClayCommand(
  command: string,
  args: string[],
  workingDirectory: string
): CommandResult {
  try {
    const argString = args.join(' ');
    const fullCommand = `clay ${command} ${argString}`.trim();

    // Use shell execution with output redirection to capture output
    // while still allowing child processes to execute properly
    const output = execSync(`${fullCommand} 2>&1`, {
      cwd: workingDirectory,
      encoding: 'utf8',
      shell: '/bin/bash',
      env: {
        ...process.env,
        VERBOSE: 'true',
      },
    });

    return {
      success: true,
      output: output.toString(),
    };
  } catch (error: unknown) {
    const err = error as {
      stdout?: Buffer;
      stderr?: Buffer;
      message?: string;
      status?: number;
    };
    return {
      success: false,
      output: err.stdout?.toString() || '',
      error: err.stderr?.toString() || err.message || 'Unknown error',
    };
  }
}

/**
 * Check if Clay CLI is available
 */
export function isClayAvailable(): boolean {
  try {
    execSync('clay --version', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Clay CLI version
 */
export function getClayVersion(): string | null {
  try {
    const output = execSync('clay --version', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim();
  } catch {
    return null;
  }
}

/**
 * Parse Clay generate output to extract statistics
 */
export function parseGenerateOutput(output: string): {
  filesGenerated: number;
  filesCopied: number;
  commandsExecuted: number;
} {
  // Clay outputs different colored messages for operations:
  // - "writing: " for generated files (from generate steps)
  // - "copying: " for copied files/directories (from copy steps)
  // - "executing: " for executed commands (from runCommand steps)
  // Note: "moving:" appears during copy operations with templated paths (internal operation)

  const writing = (output.match(/writing:/gi) || []).length;
  const copying = (output.match(/copying:/gi) || []).length;
  const executing = (output.match(/executing:/gi) || []).length;

  return {
    filesGenerated: writing,
    filesCopied: copying,
    commandsExecuted: executing,
  };
}

/**
 * Read and parse .clay file
 */
export function readClayFile(clayFilePath: string): {
  models: Array<{
    path: string;
    output: string;
    generated_files: Record<string, unknown>;
    last_generated?: string;
  }>;
} {
  const content = fs.readFileSync(clayFilePath, 'utf8');
  return JSON.parse(content);
}
