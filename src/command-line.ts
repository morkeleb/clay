import { Command } from 'commander';
import requireNew from './require-helper';
import path from 'path';
import fs from 'fs';
import * as ui from './output';
import _ from 'lodash';
import resolveGlobal from 'resolve-global';
import chokidar from 'chokidar';
import { createClayFile, load as loadClayFile } from './clay_file';
import * as generatorManager from './generator-manager';
import type { ModelIndex } from './types/clay-file';
import type { DecoratedGenerator } from './types/generator';

const commander = new Command();

// Read version from package.json
// In production (compiled), package.json is at ../package.json from dist/src/
// In development (ts-node), package.json is at ../package.json from src/
const packageJsonPath = path.join(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

commander.version(packageJson.version);

commander.option('-v, --verbose', 'ignore test hook');
commander.on('option:verbose', function (this: Command) {
  process.env.VERBOSE = this.opts().verbose ? 'true' : '';
});

// error on unknown commands
commander.on('command:*', function () {
  console.error(
    'Invalid command: %s\nSee --help for a list of available commands.',
    commander.args.join(' ')
  );
  process.exit(1);
});

interface GeneratorReference {
  generator?: string;
  output?: string;
}

function resolve_generator(
  name: string | GeneratorReference,
  model_path: string,
  indexFile: ModelIndex
): DecoratedGenerator {
  const generator_name = typeof name === 'string' ? name : name.generator || '';
  const output = typeof name === 'object' ? name.output : undefined;

  const generator_path = [
    path.dirname(resolveGlobal.silent(generator_name) || '') +
      '/generator.json',
    generator_name + '.json',
    path.resolve(generator_name + '.json'),
    path.resolve(path.join(model_path, generator_name + '.json')),
    path.resolve(path.join(model_path, generator_name, 'generator.json')),
    generator_name,
    path.resolve(generator_name),
    path.resolve(path.join(model_path, generator_name)),
  ].filter(fs.existsSync);

  if (generator_path.length < 1) {
    throw new Error('generator not found for: ' + generator_name);
  }

  ui.log('loading generator: ', generator_path[0]);

  return requireNew('./generator').load(generator_path[0], output, indexFile);
}

const generateModels = async (modelsToExecute: ModelIndex[]): Promise<void> => {
  await Promise.all(
    modelsToExecute.map(async (modelIndex) => {
      const model = modelIndex.load();
      await Promise.all(
        model.generators.map((g: string | GeneratorReference) =>
          resolve_generator(
            g,
            path.dirname(modelIndex.path),
            modelIndex
          ).generate(model, modelIndex.output || '')
        )
      );
    })
  );
};

async function generate(
  model_path?: string,
  output_path?: string
): Promise<void> {
  const clayFilePath = path.resolve('.clay');
  if (!fs.existsSync(clayFilePath)) {
    throw new Error(
      'This folder has not been initiated with clay. Please create a .clay file.'
    );
  }

  const indexFile = loadClayFile('.');

  let modelsToExecute: ModelIndex[];

  if (model_path) {
    modelsToExecute = [indexFile.getModelIndex(model_path, output_path)];
  } else {
    modelsToExecute = indexFile.models.map((m) =>
      indexFile.getModelIndex(m.path, m.output)
    );
  }

  await generateModels(modelsToExecute);
  indexFile.save();
}

const cleanModels = (modelsToExecute: ModelIndex[]): void => {
  modelsToExecute.forEach((modelIndex) => {
    const model = modelIndex.load();
    model.generators.forEach((g: string | GeneratorReference) =>
      resolve_generator(g, path.dirname(modelIndex.path), modelIndex).clean(
        model,
        modelIndex.output || ''
      )
    );
  });
};

function clean(model_path?: string, output_path?: string): void {
  const clayFilePath = path.resolve('.clay');
  if (!fs.existsSync(clayFilePath)) {
    throw new Error(
      'This folder has not been initiated with clay. Please create a .clay file.'
    );
  }

  const indexFile = loadClayFile('.');
  let modelsToExecute: ModelIndex[];

  if (model_path) {
    modelsToExecute = [indexFile.getModelIndex(model_path, output_path)];
  } else {
    modelsToExecute = indexFile.models.map((m) =>
      indexFile.getModelIndex(m.path, m.output)
    );
  }
  cleanModels(modelsToExecute);
  indexFile.save();
}

const test = (model_path: string, json_path: string): void => {
  const clayFilePath = path.resolve('.clay');
  if (!fs.existsSync(clayFilePath)) {
    throw new Error(
      'This folder has not been initiated with clay. Please create a .clay file.'
    );
  }

  const model = requireNew('./model').load(model_path);
  const jph = require('./jsonpath-helper');

  console.log(jph.select(model, json_path));
};

commander
  .command('test-path <model_path> <json_path>')
  .description('test a json-path selector using your model')
  .action(test);

commander
  .command('clean [model_path] [output_path]')
  .description('cleans up the output of the generators')
  .action(clean);

commander
  .command('generate [model_path] [output_path]')
  .description('runs the generators')
  .action(generate);

function init(type?: string, name?: string): void {
  try {
    if (type === 'generator' && name) {
      const generatorPath = path.join('clay', 'generators', name);
      fs.mkdirSync(generatorPath, { recursive: true });
      const generatorFilePath = path.join(generatorPath, 'generator.json');
      const generatorTemplate = {
        partials: [],
        formatters: [],
        steps: [
          {
            generate: 'templates/example-template.txt',
            select: '$.model.example',
            target: './output',
          },
        ],
      };
      fs.writeFileSync(
        generatorFilePath,
        JSON.stringify(generatorTemplate, null, 2)
      );
      ui.log(`Generator initialized at ${generatorFilePath}`);
    } else {
      createClayFile('.');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
  }
}

commander
  .command('init [type] [name]')
  .description('initializes the folder with an empty .clay file or a generator')
  .action(init);

function watch(model_path?: string, output_path?: string): void {
  const indexFile = loadClayFile('.');
  let modelsToExecute: ModelIndex[];

  if (model_path) {
    modelsToExecute = [indexFile.getModelIndex(model_path, output_path)];
  } else {
    modelsToExecute = indexFile.models.map((m) =>
      indexFile.getModelIndex(m.path, m.output)
    );
  }

  const directories_to_watch = _.uniq(
    modelsToExecute.map((modelIndex) =>
      path.dirname(path.resolve(modelIndex.path))
    )
  );
  directories_to_watch.forEach((model_directory) => {
    ui.watch(model_directory);

    chokidar
      .watch(model_directory, { ignored: /(^|[\/\\])\../, ignoreInitial: true })
      .on('all', (_event, _path) => {
        modelsToExecute.forEach((modelIndex) => {
          generate(modelIndex.path, modelIndex.output);

          ui.watch(model_directory);
        });
      });
  });
}

commander
  .command('watch [model_path] [output_path]')
  .description('runs the generators on filechanges in the models directory')
  .action(watch);

// Generator management commands
async function generatorList(): Promise<void> {
  const clayFilePath = path.resolve('.clay');
  if (!fs.existsSync(clayFilePath)) {
    throw new Error(
      'This folder has not been initiated with clay. Please create a .clay file.'
    );
  }

  const clayFile = loadClayFile('.');
  generatorManager.listGenerators(clayFile);
}

async function generatorAdd(generatorRef?: string): Promise<void> {
  if (!generatorRef) {
    ui.warn(
      'Please provide a generator reference (GitHub URL or generator name)'
    );
    return;
  }

  const clayFilePath = path.resolve('.clay');
  if (!fs.existsSync(clayFilePath)) {
    throw new Error(
      'This folder has not been initiated with clay. Please create a .clay file.'
    );
  }

  const clayFile = loadClayFile('.');
  await generatorManager.addGenerator(generatorRef, clayFile);
  clayFile.save();
}

async function generatorDelete(generatorName?: string): Promise<void> {
  const clayFilePath = path.resolve('.clay');
  if (!fs.existsSync(clayFilePath)) {
    throw new Error(
      'This folder has not been initiated with clay. Please create a .clay file.'
    );
  }

  const clayFile = loadClayFile('.');
  await generatorManager.deleteGenerator(generatorName, clayFile);
  clayFile.save();
}

// Add generator commands
const generatorCommand = commander
  .command('generator')
  .description('manage generators');

generatorCommand
  .command('list')
  .description('list all generators installed in models')
  .action(generatorList);

generatorCommand
  .command('list-available')
  .description('list all available generators from the registry')
  .action(async () => await generatorManager.listAvailableGenerators());

generatorCommand
  .command('add <generator_ref>')
  .description('add a generator from GitHub repository or known generator name')
  .action(generatorAdd);

generatorCommand
  .command('delete [generator_name]')
  .description(
    'delete a generator (will prompt for selection if name not provided)'
  )
  .action(generatorDelete);

generatorCommand
  .command('clear-cache')
  .description('clear the local registry cache to force refresh from GitHub')
  .action(() => generatorManager.clearRegistryCache());

export default commander;
