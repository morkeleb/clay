/**
 * Type definitions for Clay file (.clay) management
 */

/**
 * File entry in the .clay index
 */
export interface ClayFileEntry {
  md5: string;
  date: string;
}

/**
 * Model entry in the .clay index
 */
export interface ClayModelEntry {
  path: string;
  output?: string;
  generated_files: {
    [filePath: string]: ClayFileEntry;
  };
  last_generated?: string;

  // Methods for managing file checksums
  setFileCheckSum: (filePath: string, md5: string) => void;
  getFileCheckSum: (filePath: string) => string | null;
  delFileCheckSum: (filePath: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  load: () => any;
}

/**
 * Root .clay file structure
 */
export interface ClayFile {
  models: ClayModelEntry[];
}

/**
 * Model index returned by getModelIndex
 * Extends ClayModelEntry with all its properties and methods
 */
export type ModelIndex = ClayModelEntry;

/**
 * Clay file management interface
 */
export interface ClayFileManager {
  models: ClayModelEntry[];
  getModelIndex: (modelPath: string, output?: string) => ModelIndex;
  save: () => void;
}
