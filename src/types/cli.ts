/**
 * Type definitions for command-line interface
 */

/**
 * Command-line options for generate command
 */
export interface GenerateOptions {
  modelPath?: string;
  outputPath?: string;
  verbose?: boolean;
}

/**
 * Command-line options for clean command
 */
export interface CleanOptions {
  modelPath?: string;
  outputPath?: string;
  verbose?: boolean;
}

/**
 * Command-line options for watch command
 */
export interface WatchOptions {
  modelPath?: string;
  outputPath?: string;
  verbose?: boolean;
}

/**
 * Command-line options for test-path command
 */
export interface TestPathOptions {
  modelPath: string;
  jsonPath: string;
  verbose?: boolean;
}

/**
 * Command-line options for init command
 */
export interface InitOptions {
  type?: 'generator' | 'model';
  name?: string;
  verbose?: boolean;
}

/**
 * Global CLI options
 */
export interface GlobalOptions {
  verbose?: boolean;
}
