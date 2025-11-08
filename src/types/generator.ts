/**
 * Type definitions for Clay Generator
 * Core data structures used throughout the application
 */

/**
 * Generator step that generates files from Handlebars templates
 */
export interface GeneratorStepGenerate {
  generate: string;
  select: string;
  target?: string;
  touch?: boolean;
}

/**
 * Generator step that copies files or directories
 */
export interface GeneratorStepCopy {
  copy: string;
  select?: string;
  target?: string;
}

/**
 * Generator step that runs a shell command
 */
export interface GeneratorStepCommand {
  runCommand: string;
  select?: string;
  npxCommand?: boolean;
  verbose?: boolean;
}

/**
 * Union type for all generator step types
 */
export type GeneratorStep =
  | GeneratorStepGenerate
  | GeneratorStepCopy
  | GeneratorStepCommand;

/**
 * Generator configuration
 */
export interface Generator {
  partials: string[];
  formatters: string[];
  steps: GeneratorStep[];
}

/**
 * Decorated generator with execution methods
 */
export interface DecoratedGenerator extends Generator {
  generate: (model: any, outputDir: string) => Promise<void>;
  clean: (model: any, outputDir: string) => void;
}

/**
 * Type guards for generator steps
 */
export function isGenerateStep(
  step: GeneratorStep
): step is GeneratorStepGenerate {
  return 'generate' in step;
}

export function isCopyStep(step: GeneratorStep): step is GeneratorStepCopy {
  return 'copy' in step;
}

export function isCommandStep(
  step: GeneratorStep
): step is GeneratorStepCommand {
  return 'runCommand' in step;
}
