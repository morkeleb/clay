/**
 * Output and logging utilities for Clay
 * Note: Uses `any` types for console.log parameters which accept any values
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import chalk from 'chalk';

// Extend the global Process interface to include isCLI
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      isCLI?: boolean;
    }
  }
}

export function watch(target: string): void {
  if (!process.isCLI) return;
  console.log(chalk.cyan('watching: '), target);
}

export function move(target: string, dest: string): void {
  if (!process.isCLI) return;
  console.log(chalk.green('moving: '), target, chalk.green(' -> '), dest);
}

export function copy(target: string, dest: string): void {
  if (!process.isCLI) return;
  console.log(chalk.magenta('copying: '), target, chalk.magenta(' -> '), dest);
}

export function log(...text: any[]): void {
  if (!process.isCLI) return;
  if (text[0]) text[0] = chalk.yellow(text[0]);
  console.log.apply(console, text);
}

export function execute(...text: any[]): void {
  if (!process.isCLI) return;
  text.unshift(chalk.blue('executing: '));
  console.log.apply(console, text);
}

export function info(...text: any[]): void {
  if (!process.isCLI) return;
  text.unshift(chalk.blue('info: '));
  console.log.apply(console, text);
}

export function write(...filename: any[]): void {
  if (!process.isCLI) return;
  filename.unshift(chalk.green('writing: '));
  console.log.apply(console, filename);
}

export function warn(...text: any[]): void {
  if (!process.isCLI) return;
  text.unshift(chalk.red('Warning! '));
  console.warn.apply(console, text);
}

export function critical(...text: any[]): void {
  if (!process.isCLI) return;
  text.unshift(chalk.red('CRITICAL! '));
  console.warn.apply(console, text);
  process.exit(1);
}
