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
 * Search up the directory tree for a .clay file starting from the given directory.
 * Returns the directory containing the .clay file, or null if not found.
 */
export function findClayFileUp(startDir: string): string | null {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (true) {
    if (fs.existsSync(path.join(current, '.clay'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current || parent === root) {
      // Check root as well
      if (fs.existsSync(path.join(root, '.clay'))) {
        return root;
      }
      return null;
    }
    current = parent;
  }
}

/**
 * Validate that a .clay file exists in the working directory.
 * If not found, searches up the directory tree and suggests where it was found.
 */
export function requireClayFile(workingDir?: string): WorkspaceContext {
  const context = getWorkspaceContext(workingDir);

  if (!context.hasClayFile) {
    const foundDir = findClayFileUp(context.workingDirectory);

    if (foundDir) {
      const relPath = path.relative(context.workingDirectory, foundDir) || '.';
      throw new Error(
        `.clay file not found in ${context.workingDirectory}, ` +
          `but found one in ${foundDir}. ` +
          `Either set working_directory to "${relPath}" or run the command from the project root.`
      );
    }

    throw new Error(
      `.clay file not found in ${context.workingDirectory} or any parent directory. ` +
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
