/**
 * Pre-generation check execution.
 * Prechecks validate the fully resolved model (after includes and mixins)
 * BEFORE any step runs. Unlike steps and postGenerate hooks — which warn
 * and continue on command failure — precheck failures abort the generation
 * with a PreCheckFailedError. All checks run even if an early one fails,
 * so the error carries every violation.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import handlebars from '../template-engine';
import * as jph from '../jsonpath-helper';
import * as ui from '../output';
import { getHelpers } from '../helpers';
import type {
  PreCheckStep,
  PreCheckRunStep,
  PreCheckCommandStep,
} from '../types/generator';
import type { PreCheckContext } from '../code-generator';

const execAsync = promisify(exec);

// Lazy-loaded jiti instance
let jitiInstance: any = null;

function getJiti(): any {
  if (!jitiInstance) {
    const { createJiti } = require('jiti');
    jitiInstance = createJiti(__filename, { interopDefault: true });
  }
  return jitiInstance;
}

/**
 * Thrown when one or more prechecks report violations.
 * Carries every violation so callers (CLI, MCP server) can present
 * the complete picture in one run.
 */
export class PreCheckFailedError extends Error {
  violations: string[];

  constructor(violations: string[]) {
    super(`Pre-check violations found:\n${violations.join('\n')}`);
    this.name = 'PreCheckFailedError';
    this.violations = violations;
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Execute all prechecks sequentially against the resolved model.
 * Throws PreCheckFailedError with every violation if any check fails.
 */
export async function executePreChecks(
  preChecks: PreCheckStep[],
  model: any,
  generatorDir: string,
  modelPath: string
): Promise<void> {
  const violations: string[] = [];
  const absoluteModelPath = path.resolve(modelPath);

  for (const check of preChecks) {
    if ('run' in check) {
      await executeTsCheck(check, model, generatorDir, violations);
    } else if ('runCommand' in check) {
      await executeCommandCheck(
        check,
        model,
        generatorDir,
        absoluteModelPath,
        violations
      );
    }
  }

  if (violations.length > 0) {
    throw new PreCheckFailedError(violations);
  }
}

/**
 * Execute a TypeScript PreCheck — a default-exported class with a
 * check(context) method, loaded via jiti (symmetric with postGenerate hooks).
 */
async function executeTsCheck(
  check: PreCheckRunStep,
  model: any,
  generatorDir: string,
  violations: string[]
): Promise<void> {
  let instance: any;
  try {
    const checkPath = path.resolve(path.join(generatorDir, check.run));
    const mod = await getJiti().import(checkPath);
    const CheckClass = (mod as any).default ?? mod;

    if (typeof CheckClass !== 'function') {
      throw new Error(
        `Pre-check ${check.run} must export a default class extending PreCheck`
      );
    }

    instance = new CheckClass();

    if (typeof instance.check !== 'function') {
      throw new Error(
        `Pre-check ${check.run} must export a class with a check(context: PreCheckContext) method`
      );
    }
  } catch (e) {
    violations.push(`[${check.run}] ${errorMessage(e)}`);
    return;
  }

  const helpers = getHelpers();
  const items = check.select ? jph.select(model, check.select) : [model];

  for (const item of items) {
    const context: PreCheckContext = {
      data: item,
      helpers,
      model: item?.clay_model ?? model,
      parent: item?.clay_parent,
    };

    try {
      const result = await instance.check(context);
      if (Array.isArray(result) && result.length > 0) {
        violations.push(...result.map((v) => `[${check.run}] ${v}`));
      }
    } catch (e) {
      violations.push(`[${check.run}] ${errorMessage(e)}`);
    }
  }
}

/**
 * Execute a shell command check. The command receives the model path as
 * its last argument and fails the precheck on non-zero exit, surfacing
 * stderr so the check's own error message reaches the user.
 */
async function executeCommandCheck(
  check: PreCheckCommandStep,
  model: any,
  generatorDir: string,
  absoluteModelPath: string,
  violations: string[]
): Promise<void> {
  const verbose = check.verbose ?? !!process.env.VERBOSE;

  const commands: string[] = [];
  if (check.select) {
    const template = handlebars.compile(check.runCommand);
    for (const item of jph.select(model, check.select)) {
      commands.push(template(item));
    }
  } else {
    commands.push(check.runCommand);
  }

  for (const cmd of commands) {
    const fullCommand = `${cmd} "${absoluteModelPath}"`;
    if (verbose) ui.execute(fullCommand);
    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: generatorDir,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (verbose) {
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
      }
    } catch (e: any) {
      const stderr = typeof e?.stderr === 'string' ? e.stderr.trim() : '';
      violations.push(`[${check.runCommand}] ${stderr || errorMessage(e)}`);
    }
  }
}
