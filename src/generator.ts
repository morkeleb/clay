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
import _ from 'lodash';
import { execSync } from 'child_process';
import * as jph from './jsonpath-helper';
import { requireNew } from './require-helper';
import minimatch from 'minimatch';
import crypto from 'crypto';
import { z } from 'zod';
import jp from 'jsonpath';
import * as output from './output';
import type {
  Generator,
  DecoratedGenerator,
  GeneratorStep,
  GeneratorStepGenerate,
  GeneratorStepCopy,
  GeneratorStepCommand,
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

function getMd5ForContent(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

interface FormatterSpec {
  pkg: string;
  options: Record<string, any>;
  new: boolean;
}

interface FormatterModule {
  extensions?: string[];
  apply: (
    fileName: string,
    content: string,
    options?: Record<string, any>,
    step?: any
  ) => string | Promise<string>;
}

async function applyFormatters(
  generator: Generator,
  file_name: string,
  data: string,
  step: GeneratorStep
): Promise<string> {
  const resolveGlobal = require('resolve-global');
  const formatters = generator.formatters || [];
  let result = data;

  // Normalize each entry to { pkg, options }
  const formatterSpecs: FormatterSpec[] = formatters.map(
    (fmt): FormatterSpec => {
      if (typeof fmt === 'string') {
        // legacy: just the package name
        return { pkg: fmt, options: {}, new: false };
      }
      // new: { package: "...", options: { ... } }
      return {
        pkg: (fmt as any).package,
        options: (fmt as any).options || {},
        new: true,
      };
    }
  );

  // Load all formatter modules
  const loadedFormatters: FormatterModule[] = formatterSpecs.map(({ pkg }) =>
    require(resolveGlobal(pkg))
  );

  // Apply sequentially
  for (let i = 0; i < loadedFormatters.length; i++) {
    const formatter = loadedFormatters[i];
    const { options } = formatterSpecs[i];
    const { new: isNewFormatter } = formatterSpecs[i];

    // check extension match
    const applyFormatter = Array.isArray(formatter.extensions)
      ? formatter.extensions.some((ext) => minimatch(file_name, ext))
      : true;

    if (!applyFormatter) continue;

    try {
      // Pass options into apply if supported
      if (isNewFormatter) {
        // new signature: apply(file, content, options, step)
        result = await formatter.apply(file_name, result, options, step);
      } else {
        // old signature: apply(file, content)
        result = await formatter.apply(file_name, result);
      }
    } catch (e) {
      ui.critical(
        'Failed to apply formatter for:',
        file_name,
        'This is probably not due to Clay but the formatter itself',
        e
      );
      throw e;
    }
  }

  return result;
}

function write(file: string, data: string): void {
  const dir = path.dirname(file);
  fs.ensureDirSync(dir);
  ui.write(file);
  fs.writeFileSync(file, data, 'utf8');
}

async function generate_file(
  generator: Generator,
  model_partial: any[],
  directory: string,
  outputDir: string,
  file: string,
  modelIndex: ClayModelEntry,
  step: GeneratorStepGenerate
): Promise<void> {
  const template = handlebars.compile(
    fs.readFileSync(path.join(directory, file), 'utf8')
  );
  const file_name = handlebars.compile(path.join(outputDir, file));

  await Promise.all(
    model_partial.map(async (m) => {
      const filename = file_name(m);
      if (step.touch && fs.existsSync(filename)) {
        ui.info('skipping touch file:', filename);
        return;
      }
      try {
        const preFormattedOutput = template(m);

        const md5 = getMd5ForContent(preFormattedOutput);
        if (modelIndex.getFileCheckSum(filename) !== md5) {
          const content = await applyFormatters(
            generator,
            filename,
            preFormattedOutput,
            step
          );

          write(filename, content);
          if (!step.touch) {
            modelIndex.setFileCheckSum(filename, md5);
          }
        }
      } catch (e) {
        ui.critical(
          'Failed to generate content for: ',
          filename,
          ' This probably not due to clay but the template itself',
          e
        );
        throw e;
      }
    })
  );
}

function remove_file(modelIndex: ClayModelEntry, file: string): void {
  ui.warn('removing ', file);
  if (fs.existsSync(file)) {
    fs.removeSync(file);
  }
  modelIndex.delFileCheckSum(file);
}

async function generate_directory(
  generator: Generator,
  model_partial: any[],
  directory: string,
  outputDir: string,
  modelIndex: ClayModelEntry,
  step: GeneratorStepGenerate
): Promise<void> {
  const templates = fs.readdirSync(directory);

  await Promise.all(
    templates
      .filter((file) => fs.lstatSync(path.join(directory, file)).isDirectory())
      .map((file) =>
        generate_directory(
          generator,
          model_partial,
          path.join(directory, file),
          path.join(outputDir, file),
          modelIndex,
          step
        )
      )
  );

  await Promise.all(
    templates
      .filter((file) => fs.lstatSync(path.join(directory, file)).isFile())
      .map((file) =>
        generate_file(
          generator,
          model_partial,
          directory,
          outputDir,
          file,
          modelIndex,
          step
        )
      )
  );
}

function execute(
  commandline: string,
  output_dir: string,
  npxCommand?: boolean,
  verbose?: boolean
): void {
  let cmd = commandline;
  if (npxCommand) {
    cmd = `npx ${commandline}`;
  }
  ui.execute(cmd);
  try {
    execSync(cmd, {
      cwd: output_dir,
      stdio: verbose ? 'inherit' : 'pipe',
    });
  } catch (e: any) {
    ui.warn('error while executing', commandline);
    if (e.stdout) {
      ui.warn(e.stdout.toString());
    }
  }
}

function generate_template(
  generator: Generator,
  step: GeneratorStepGenerate,
  model: any,
  outputDir: string,
  dirname: string,
  modelIndex: ClayModelEntry
): Promise<void> {
  if (fs.lstatSync(path.join(dirname, step.generate)).isFile()) {
    return generate_file(
      generator,
      jph.select(model, step.select),
      path.join(dirname, path.dirname(step.generate)),
      path.join(outputDir, step.target || ''),
      path.basename(step.generate),
      modelIndex,
      step
    );
  } else {
    return generate_directory(
      generator,
      jph.select(model, step.select),
      path.join(dirname, step.generate),
      path.join(outputDir, step.target || ''),
      modelIndex,
      step
    );
  }
}

function remove_generated_files(modelIndex: ClayModelEntry): void {
  const files = Object.keys(modelIndex.generated_files);
  files.forEach((f) => remove_file(modelIndex, f));
}

function run_command(
  step: GeneratorStepCommand,
  model: any,
  outputDir: string,
  _dirname: string
): void {
  const output_dir = path.resolve(outputDir);
  fs.ensureDirSync(output_dir);
  const verbose =
    step.verbose !== undefined ? step.verbose : !!process.env.VERBOSE;

  if (step.select === undefined) {
    execute(step.runCommand, output_dir, step.npxCommand, verbose);
  } else {
    const command = handlebars.compile(step.runCommand);
    jph.select(model, step.select).forEach((m) => {
      execute(command(m), output_dir, step.npxCommand, verbose);
    });
  }
}

function addToIndex(modelIndex: ClayModelEntry, file: string): void {
  if (!modelIndex.generated_files[file]) {
    modelIndex.generated_files[file] = {
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
    ui.copy(source, out);
    fs.copySync(source, out);
    addToIndex(modelIndex, out);
  } else {
    jph.select(model, step.select).forEach((m) => {
      let out: string;
      if (step.target) {
        const target = handlebars.compile(step.target);
        out = path.join(output_dir, target(m));
      } else {
        out = output_dir;
      }
      fs.ensureDirSync(output_dir);
      ui.copy(source, out);
      fs.copySync(source, out);
      addToIndex(modelIndex, out);

      const recursiveHandlebars = (p: string): void => {
        fs.readdirSync(p).forEach((f) => {
          const file = path.join(p, f);
          if (fs.lstatSync(file).isDirectory()) {
            recursiveHandlebars(file);
          } else {
            const template = handlebars.compile(file);
            ui.move(source, out);
            const template_path = template(m);
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

function decorate_generator(
  g: Generator,
  p: string,
  extra_output: string,
  modelIndex: ClayModelEntry
): DecoratedGenerator {
  validateGeneratorSchema(g);

  const decorated = g as DecoratedGenerator;

  decorated.generate = async (model: any, outputDir: string): Promise<void> => {
    const output = path.join(outputDir, extra_output || '');
    const dirname = path.dirname(p);
    handlebars.load_partials(g.partials || [], dirname);

    for (let index = 0; index < g.steps.length; index++) {
      const step = g.steps[index];
      if ('generate' in step) {
        await generate_template(
          g,
          step,
          _.cloneDeep(model),
          output,
          dirname,
          modelIndex
        );
      } else if ('runCommand' in step) {
        run_command(step, _.cloneDeep(model), output, dirname);
      } else if ('copy' in step) {
        copy(step, _.cloneDeep(model), output, dirname, modelIndex);
      }
    }
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
