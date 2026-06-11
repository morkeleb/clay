/**
 * Type definitions for Clay Generator
 * Core data structures used throughout the application
 */

import type { WrittenItem } from '../pipeline/types';

/**
 * Generator step that generates files from Handlebars templates
 */
export interface GeneratorStepGenerate {
  generate: string;
  select: string;
  target?: string;
  touch?: boolean;
  engine?: 'handlebars' | 'ejs' | 'ts';
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
 * Post-generation hook that runs a TypeScript file
 */
export interface PostGenerateHookStep {
  run: string;
  select?: string;
  onlyNewTouchFiles?: boolean;
}

/**
 * Post-generation hook that runs a shell command
 */
export interface PostGenerateCommandStep {
  runCommand: string;
  select?: string;
  verbose?: boolean;
}

/**
 * Union type for post-generation hook steps
 */
export type PostGenerateStep = PostGenerateHookStep | PostGenerateCommandStep;

/**
 * Pre-generation check that runs a TypeScript file
 */
export interface PreCheckRunStep {
  run: string;
  select?: string;
}

/**
 * Pre-generation check that runs a shell command
 */
export interface PreCheckCommandStep {
  runCommand: string;
  select?: string;
  verbose?: boolean;
}

/**
 * Union type for pre-generation check steps
 */
export type PreCheckStep = PreCheckRunStep | PreCheckCommandStep;

/**
 * Generator configuration
 */
export interface Generator {
  partials: string[];
  formatters: string[];
  steps: GeneratorStep[];
  preChecks?: PreCheckStep[];
  postGenerate?: PostGenerateStep[];
}

/**
 * Decorated generator with execution methods
 */
export interface DecoratedGenerator extends Generator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generate: (model: any, outputDir: string, pipelineRunner?: any) => Promise<WrittenItem[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
