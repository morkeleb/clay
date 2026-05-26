// src/pipeline/progress.ts
import chalk from 'chalk';

export interface PipelineProgress {
  onSelect(filename: string): void;
  onRender(filename: string): void;
  onSkip(filename: string): void;
  onFormat(filename: string): void;
  onWrite(filename: string): void;
  done(): void;
}

interface StageCounter {
  label: string;
  count: number;
  color: (s: string) => string;
}

/**
 * Creates a progress tracker for the pipeline.
 * In compact mode (TTY + non-verbose), updates the terminal in-place.
 * In verbose mode (or non-TTY), falls back to line-by-line output.
 */
export function createProgress(
  generatorName: string,
  verbose: boolean
): PipelineProgress {
  if (verbose || !process.isCLI || !process.stderr.isTTY) {
    return createVerboseProgress();
  }
  return createCompactProgress(generatorName);
}

function createVerboseProgress(): PipelineProgress {
  return {
    onSelect(_filename: string) {},
    onRender(filename: string) {
      if (process.isCLI) console.log(chalk.blue('render: '), filename);
    },
    onSkip(filename: string) {
      if (process.isCLI) console.log(chalk.gray('skip: '), filename);
    },
    onFormat(filename: string) {
      if (process.isCLI) console.log(chalk.yellow('format: '), filename);
    },
    onWrite(filename: string) {
      if (process.isCLI) console.log(chalk.green('writing: '), filename);
    },
    done() {},
  };
}

function createCompactProgress(generatorName: string): PipelineProgress {
  const stages: Record<string, StageCounter> = {
    select: { label: 'select', count: 0, color: chalk.cyan },
    render: { label: 'render', count: 0, color: chalk.blue },
    skip: { label: 'skip', count: 0, color: chalk.gray },
    format: { label: 'format', count: 0, color: chalk.yellow },
    write: { label: 'write', count: 0, color: chalk.green },
  };

  let total = 0;
  let lastLineLength = 0;

  function render() {
    const parts: string[] = [];
    for (const stage of Object.values(stages)) {
      if (stage.count > 0) {
        parts.push(stage.color(`${stage.label} ${stage.count}`));
      }
    }

    const written = stages.write.count;
    const skipped = stages.skip.count;
    const processed = written + skipped;
    const bar = total > 0 ? progressBar(processed, total, 15) : '';

    const line = `  ${chalk.dim(generatorName)} ${bar} ${parts.join('  ')}`;

    // Clear previous line and write new one
    if (lastLineLength > 0) {
      process.stderr.write('\r' + ' '.repeat(lastLineLength) + '\r');
    }
    process.stderr.write(line);
    lastLineLength = stripAnsi(line).length;
  }

  function increment(stage: string) {
    stages[stage].count++;
    render();
  }

  return {
    onSelect(_filename: string) {
      total++;
      increment('select');
    },
    onRender(_filename: string) {
      increment('render');
    },
    onSkip(_filename: string) {
      increment('skip');
    },
    onFormat(_filename: string) {
      increment('format');
    },
    onWrite(_filename: string) {
      increment('write');
    },
    done() {
      // Clear the progress line and print final summary
      if (lastLineLength > 0) {
        process.stderr.write('\r' + ' '.repeat(lastLineLength) + '\r');
      }
      const written = stages.write.count;
      const skipped = stages.skip.count;
      if (written > 0 || skipped > 0) {
        const parts = [];
        if (written > 0) parts.push(chalk.green(`${written} written`));
        if (skipped > 0) parts.push(chalk.gray(`${skipped} unchanged`));
        console.log(`  ${chalk.dim(generatorName)} ${parts.join(', ')}`);
      }
    },
  };
}

function progressBar(current: number, total: number, width: number): string {
  if (total === 0) return '';
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  return chalk.green('\u2588'.repeat(filled)) + chalk.dim('\u2591'.repeat(empty));
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
