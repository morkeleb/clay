/**
 * Generator module for processing templates and executing generation steps
 * Note: Uses `any` types for:
 * - Dynamic model data structures that vary based on user input
 * - Formatter module interfaces that may have varying APIs
 * - Template contexts and error handling for external modules
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import path from 'path';
import handlebars from './template-engine';
import * as ui from './output';
import * as jph from './jsonpath-helper';
import { requireNew } from './require-helper';
import { z } from 'zod';
import jp from 'jsonpath';
import * as output from './output';
import {
  buildGeneratePipeline,
  createFormatterCache,
  createProgress,
} from './pipeline/index';
import { clearTemplateCache, compileTemplate } from './pipeline/template-cache';
import { executeCommand } from './pipeline/stages/command';
import type {
  Generator,
  DecoratedGenerator,
  GeneratorStepCopy,
} from './types/generator';
import type { ClayModelEntry } from './types/clay-file';


const isValidJsonPath = (
  jsonPath: string
): { valid: boolean; error?: string } => {
  try {
    jp.parse(jsonPath);
    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
};

const SelectSchema = z
  .string()
  .optional()
  .superRefine((jsonPath, ctx) => {
    if (jsonPath && !isValidJsonPath(jsonPath).valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid JSONPath in 'select': ${jsonPath}`,
      });
    }
  });

const GeneratorStepSchema = z.union([
  z.object({
    generate: z.string(),
    touch: z.boolean().optional(),
    select: SelectSchema,
    target: z.string().optional(),
  }),
  z.object({
    copy: z.string(),
    select: SelectSchema,
    target: z.string().optional(),
  }),
  z.object({
    runCommand: z.string(),
    select: SelectSchema,
    npxCommand: z.boolean().optional(),
    verbose: z.boolean().optional(),
  }),
]);

const ConventionSchema = z.union([
  z.object({
    name: z.string(),
    description: z.string(),
    function: z.string(),
  }),
  z.object({
    include: z.string(),
  }),
]);

const GeneratorSchema = z.object({
  steps: z.array(GeneratorStepSchema),
  partials: z.array(z.string()).optional(),
  formatters: z
    .array(
      z.union([
        z.string(),
        z.object({
          package: z.string(),
          options: z.record(z.any()).optional(),
        }),
      ])
    )
    .optional(),
  conventions: z.array(ConventionSchema).optional(),
});

function validateGeneratorSchema(generator: any): Generator {
  const result = GeneratorSchema.safeParse(generator);
  if (!result.success) {
    const detailedErrors = result.error.issues.map((issue) => {
      const pathStr = issue.path.join('.');
      const message = `Error in path '${pathStr}': ${issue.message}`;
      output.warn(message);
      return message;
    });

    throw new Error(`Invalid generator schema:\n${detailedErrors.join('\n')}`);
  }
  return result.data as Generator;
}


function remove_file(modelIndex: ClayModelEntry, file: string): void {
  ui.warn('removing ', file);
  if (fs.existsSync(file)) {
    fs.removeSync(file);
  }
  // delFileCheckSum will handle path normalization internally
  modelIndex.delFileCheckSum(file);
}

function remove_generated_files(modelIndex: ClayModelEntry): void {
  const files = Object.keys(modelIndex.generated_files);
  files.forEach((f) => remove_file(modelIndex, f));
}

function addToIndex(modelIndex: ClayModelEntry, file: string): void {
  const relFile = path.relative(process.cwd(), file);
  // Normalize to forward slashes for cross-platform compatibility
  const normalizedPath = relFile.split(path.sep).join('/');
  if (!modelIndex.generated_files[normalizedPath]) {
    modelIndex.generated_files[normalizedPath] = {
      md5: '',
      date: new Date().toISOString(),
    };
  }
}

function cleanEmptyDirectories(directory: string): void {
  if (fs.existsSync(directory) && fs.lstatSync(directory).isDirectory()) {
    const files = fs.readdirSync(directory);
    if (files.length === 0) {
      fs.rmdirSync(directory);
      ui.warn('Removed empty directory', directory);
    }
  }
}

function copy(
  step: GeneratorStepCopy,
  model: any,
  outputDir: string,
  dirname: string,
  modelIndex: ClayModelEntry
): void {
  const output_dir = path.resolve(outputDir);
  const source = path.resolve(path.join(dirname, step.copy));

  if (step.select === undefined) {
    let out: string;
    if (step.target) {
      out = path.join(output_dir, step.target);
    } else {
      out = output_dir;
    }
    if (fs.lstatSync(source).isFile()) {
      out = path.join(out, path.basename(step.copy));
    }
    fs.ensureDirSync(output_dir);
    if (process.env.VERBOSE) ui.copy(source, out);
    fs.copySync(source, out);
    addToIndex(modelIndex, out);
  } else {
    const targetTemplate = step.target
      ? compileTemplate(step.target, `copy-target:${step.target}`)
      : null;
    jph.select(model, step.select).forEach((m) => {
      let out: string;
      if (targetTemplate) {
        // Normalize template result to OS-specific path separators
        out = path.join(output_dir, path.normalize(targetTemplate(m)));
      } else {
        out = output_dir;
      }
      fs.ensureDirSync(output_dir);
      if (process.env.VERBOSE) ui.copy(source, out);
      fs.copySync(source, out);
      addToIndex(modelIndex, out);

      const recursiveHandlebars = (p: string): void => {
        fs.readdirSync(p).forEach((f) => {
          const file = path.join(p, f);
          if (fs.lstatSync(file).isDirectory()) {
            recursiveHandlebars(file);
          } else {
            // Normalize path separators to forward slashes for Handlebars
            const normalizedFile = file.split(path.sep).join('/');
            const template = compileTemplate(normalizedFile, `copy-file:${normalizedFile}`);
            if (process.env.VERBOSE) ui.move(source, out);
            const templateResult = template(m);
            // Normalize back to OS-specific path separators
            const template_path = path.normalize(templateResult);
            if (file !== template_path) {
              fs.moveSync(file, template_path);
              addToIndex(modelIndex, template_path);
            }
          }
        });
      };
      recursiveHandlebars(out);
    });
  }
}

/**
 * Recursively collect all files in a directory, returning their paths
 * relative to the root directory.
 */
function collectFiles(dir: string, rootDir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (fs.lstatSync(fullPath).isDirectory()) {
      results.push(...collectFiles(fullPath, rootDir));
    } else if (fs.lstatSync(fullPath).isFile()) {
      results.push(path.relative(rootDir, fullPath));
    }
  }
  return results;
}

function decorate_generator(
  g: Generator,
  p: string,
  extra_output: string,
  modelIndex: ClayModelEntry
): DecoratedGenerator {
  validateGeneratorSchema(g);

  const decorated = g as DecoratedGenerator;

  decorated.generate = async (model: any, outputDir: string): Promise<void> => {
    // Clear caches at the start of each generation to ensure fresh state
    clearTemplateCache();

    const formatterCache = createFormatterCache();
    const output = path.join(outputDir, extra_output || '');
    const dirname = path.dirname(p);
    handlebars.load_partials(g.partials || [], dirname);

    const generatorName = path.basename(p, '.json');
    const verbose = !!process.env.VERBOSE;
    const progress = createProgress(generatorName, verbose);
    const pipelineRunner = buildGeneratePipeline(g, formatterCache, progress);

    // In compact progress mode, suppress ui.* output to prevent interleaving
    const savedIsCLI = process.isCLI;
    if (!verbose && process.isCLI) {
      process.isCLI = false;
    }

    for (let index = 0; index < g.steps.length; index++) {
      const step = g.steps[index];
      if ('generate' in step) {
        const templatePath = path.join(dirname, step.generate);
        const isDir = fs.lstatSync(templatePath).isDirectory();
        if (isDir) {
          // Recursively collect all files, preserving directory structure
          const files = collectFiles(templatePath, templatePath);
          await Promise.all(
            files.map(f => pipelineRunner(
              model, step.select, templatePath, f, output, modelIndex, step
            ))
          );
        } else {
          await pipelineRunner(
            model,
            step.select,
            path.join(dirname, path.dirname(step.generate)),
            path.basename(step.generate),
            output,
            modelIndex,
            step
          );
        }
      } else if ('runCommand' in step) {
        const output_dir = path.resolve(output);
        const verbose = step.verbose !== undefined ? step.verbose : !!process.env.VERBOSE;
        if (step.select === undefined) {
          await executeCommand(step.runCommand, output_dir, {
            npx: step.npxCommand,
            verbose,
          });
        } else {
          const command = handlebars.compile(step.runCommand);
          const items = jph.select(model, step.select);
          for (const m of items) {
            await executeCommand(command(m), output_dir, {
              npx: step.npxCommand,
              verbose,
            });
          }
        }
      } else if ('copy' in step) {
        copy(step, model, output, dirname, modelIndex);
      }
    }

    // Restore ui output before final summary
    process.isCLI = savedIsCLI;
    progress.done();
  };

  decorated.clean = (_model: any, _outputDir: string): void => {
    remove_generated_files(modelIndex);

    // Remove empty directories
    Object.keys(modelIndex.generated_files).forEach((file) => {
      const dir = path.dirname(file);
      cleanEmptyDirectories(dir);
    });
  };

  return decorated;
}

export function load(
  p: string,
  extra_output: string,
  index: ClayModelEntry
): DecoratedGenerator {
  const generator = requireNew(path.resolve(p)) as Generator;
  return decorate_generator(generator, p, extra_output, index);
}
