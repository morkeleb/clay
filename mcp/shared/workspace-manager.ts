/**
 * Workspace manager - handles working directory context for Clay operations
 */
import fs from 'fs';
import path from 'path';

export interface WorkspaceContext {
  workingDirectory: string;
  hasClayFile: boolean;
  clayFilePath: string;
}

/**
 * Get the workspace context for a given directory
 */
export function getWorkspaceContext(workingDir?: string): WorkspaceContext {
  const workingDirectory = workingDir
    ? path.resolve(workingDir)
    : process.cwd();
  const clayFilePath = path.join(workingDirectory, '.clay');
  const hasClayFile = fs.existsSync(clayFilePath);

  return {
    workingDirectory,
    hasClayFile,
    clayFilePath,
  };
}

/**
 * Validate that a .clay file exists in the working directory
 */
export function requireClayFile(workingDir?: string): WorkspaceContext {
  const context = getWorkspaceContext(workingDir);

  if (!context.hasClayFile) {
    throw new Error(
      `.clay file not found in ${context.workingDirectory}. ` +
        'Run clay_init to create one.'
    );
  }

  return context;
}

/**
 * Resolve a path relative to the working directory
 */
export function resolvePath(workingDir: string, relativePath: string): string {
  return path.resolve(workingDir, relativePath);
}

/**
 * Validate that a path exists
 */
export function validatePathExists(
  filePath: string,
  description: string
): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} not found: ${filePath}`);
  }
}

/**
 * Ensure a directory exists
 */
export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
