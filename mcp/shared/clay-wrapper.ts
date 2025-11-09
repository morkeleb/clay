/**
 * Wrapper for executing Clay CLI commands
 */
import { execSync } from 'child_process';
import path from 'path';

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
    
    const output = execSync(fullCommand, {
      cwd: workingDirectory,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      success: true,
      output: output.toString(),
    };
  } catch (error: unknown) {
    const err = error as { stdout?: Buffer; stderr?: Buffer; message?: string };
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
  filesUpdated: number;
  filesUnchanged: number;
} {
  // Clay outputs file operation results
  // This is a simplified parser - adjust based on actual Clay output format
  const generated = (output.match(/generated/gi) || []).length;
  const updated = (output.match(/updated/gi) || []).length;
  const unchanged = (output.match(/unchanged/gi) || []).length;

  return {
    filesGenerated: generated,
    filesUpdated: updated,
    filesUnchanged: unchanged,
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
  const fs = require('fs');
  const content = fs.readFileSync(clayFilePath, 'utf8');
  return JSON.parse(content);
}
