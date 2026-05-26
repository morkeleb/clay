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

const SPINNER = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];

/**
 * Compact progress: one in-place line with a spinner and live counters.
 *
 * A streaming pipeline has no known total upfront, so a progress bar would
 * be misleading. Instead we show activity via a spinner and stage counters:
 *
 *   generate ⠋ select 1746  render 1180  skip 1170  write 10
 */
function createCompactProgress(generatorName: string): PipelineProgress {
  let selected = 0;
  let rendered = 0;
  let skipped = 0;
  let formatted = 0;
  let written = 0;
  let lastLineLength = 0;
  let tick = 0;

  function render() {
    tick++;
    const spinner = SPINNER[tick % SPINNER.length];

    const parts: string[] = [];
    if (selected > 0) parts.push(chalk.cyan(`select ${selected}`));
    if (rendered > 0) parts.push(chalk.blue(`render ${rendered}`));
    if (skipped > 0) parts.push(chalk.gray(`skip ${skipped}`));
    if (formatted > 0) parts.push(chalk.yellow(`format ${formatted}`));
    if (written > 0) parts.push(chalk.green(`write ${written}`));

    const line = `  ${chalk.dim(generatorName)} ${spinner} ${parts.join('  ')}`;

    // Clear previous line and write new one
    if (lastLineLength > 0) {
      process.stderr.write('\r' + ' '.repeat(lastLineLength) + '\r');
    }
    process.stderr.write(line);
    lastLineLength = stripAnsi(line).length;
  }

  return {
    onSelect(_filename: string) {
      selected++;
      if (selected % 50 === 0 || selected <= 5) render();
    },
    onRender(_filename: string) {
      rendered++;
      if (rendered % 20 === 0) render();
    },
    onSkip(_filename: string) {
      skipped++;
      if (skipped % 20 === 0) render();
    },
    onFormat(_filename: string) {
      formatted++;
      render();
    },
    onWrite(_filename: string) {
      written++;
      render();
    },
    done() {
      // Clear the spinner line and print final summary
      if (lastLineLength > 0) {
        process.stderr.write('\r' + ' '.repeat(lastLineLength) + '\r');
      }
      if (written > 0 || skipped > 0) {
        const parts = [];
        if (written > 0) parts.push(chalk.green(`${written} written`));
        if (skipped > 0) parts.push(chalk.gray(`${skipped} unchanged`));
        console.log(`  ${chalk.dim(generatorName)} ${parts.join(', ')}`);
      }
    },
  };
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
