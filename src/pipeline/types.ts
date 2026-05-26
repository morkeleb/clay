// src/pipeline/types.ts

import type { GeneratorStepGenerate } from '../types/generator';
import type { ClayModelEntry } from '../types/clay-file';

// --- Formatter spec carried through the pipeline ---

export interface FormatterSpec {
  readonly pkg: string;
  readonly options: Record<string, unknown>;
  readonly isNew: boolean;
}

// --- Work item types that flow through the pipeline ---

/** Entry point: a model item selected via JSONPath, paired with its template and formatter config */
export interface SelectItem {
  readonly modelData: unknown;
  readonly templatePath: string;
  readonly fileNamePattern: string;
  readonly outputDir: string;
  readonly step: GeneratorStepGenerate;
  readonly modelIndex: ClayModelEntry;
  readonly formatters: readonly FormatterSpec[];
}

/** After rendering: has content but not yet hashed */
export interface RenderedItem {
  readonly filename: string;
  readonly content: string;
  readonly step: GeneratorStepGenerate;
  readonly modelIndex: ClayModelEntry;
  readonly formatters: readonly FormatterSpec[];
}

/** After hashing + diffing: only items that changed pass through */
export interface ChangedItem {
  readonly filename: string;
  readonly content: string;
  readonly md5: string;
  readonly step: GeneratorStepGenerate;
  readonly modelIndex: ClayModelEntry;
  readonly formatters: readonly FormatterSpec[];
}

/** After formatting: ready to write (formatters consumed — no longer carried) */
export interface FormattedItem {
  readonly filename: string;
  readonly content: string;
  readonly md5: string;
  readonly step: GeneratorStepGenerate;
  readonly modelIndex: ClayModelEntry;
}

/** After writing: confirms what was written */
export interface WrittenItem {
  readonly filename: string;
  readonly md5: string;
  readonly step: GeneratorStepGenerate;
  readonly modelIndex: ClayModelEntry;
}

// --- Stage type: the core abstraction ---

/**
 * A pipeline stage transforms an async iterable of In into an async generator of Out.
 * TypeScript enforces that Stage<A, B> can only connect to Stage<B, C>.
 */
export type Stage<In, Out> = (input: AsyncIterable<In>) => AsyncGenerator<Out>;

// --- Pipeline composer ---

/**
 * Compose two stages into one. TypeScript enforces the Mid type matches.
 */
export function compose<A, B, C>(
  first: Stage<A, B>,
  second: Stage<B, C>
): Stage<A, C> {
  return (input: AsyncIterable<A>) => second(first(input));
}

/**
 * Build a pipeline by chaining stages left-to-right.
 * Each call to .pipe() extends the chain and TypeScript verifies types match.
 */
export class PipelineBuilder<TIn, TCurrent> {
  constructor(private readonly stage: Stage<TIn, TCurrent>) {}

  pipe<TNext>(next: Stage<TCurrent, TNext>): PipelineBuilder<TIn, TNext> {
    return new PipelineBuilder(compose(this.stage, next));
  }

  build(): Stage<TIn, TCurrent> {
    return this.stage;
  }
}

export function pipeline<TIn, TOut>(
  stage: Stage<TIn, TOut>
): PipelineBuilder<TIn, TOut> {
  return new PipelineBuilder(stage);
}
