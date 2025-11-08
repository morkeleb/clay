/**
 * Type definitions for output/file operations
 */

/**
 * Options for writing files
 */
export interface WriteFileOptions {
  touch?: boolean;
  formatter?: (content: string, filePath: string) => string | Promise<string>;
}

/**
 * File change detection result
 */
export interface FileChangeResult {
  changed: boolean;
  oldHash?: string;
  newHash: string;
}

/**
 * Output manager interface
 */
export interface OutputManager {
  writeFile: (
    filePath: string,
    content: string,
    options?: WriteFileOptions
  ) => Promise<void>;
  deleteFile: (filePath: string) => Promise<void>;
  fileExists: (filePath: string) => boolean;
  calculateHash: (content: string) => string;
  hasFileChanged: (
    filePath: string,
    content: string,
    oldHash?: string
  ) => FileChangeResult;
}
