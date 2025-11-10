"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const require_helper_1 = __importDefault(require("./require-helper"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ui = __importStar(require("./output"));
const lodash_1 = __importDefault(require("lodash"));
const resolve_global_1 = __importDefault(require("resolve-global"));
const chokidar_1 = __importDefault(require("chokidar"));
const clay_file_1 = require("./clay_file");
const generatorManager = __importStar(require("./generator-manager"));
const commander = new commander_1.Command();
function findPackageJson() {
    let currentDir = __dirname;
    while (currentDir !== path_1.default.parse(currentDir).root) {
        const packagePath = path_1.default.join(currentDir, 'package.json');
        if (fs_1.default.existsSync(packagePath)) {
            return JSON.parse(fs_1.default.readFileSync(packagePath, 'utf8'));
        }
        currentDir = path_1.default.dirname(currentDir);
    }
    throw new Error('Could not find package.json');
}
const packageJson = findPackageJson();
commander.version(packageJson.version);
commander.option('-v, --verbose', 'ignore test hook');
commander.on('option:verbose', function () {
    process.env.VERBOSE = this.opts().verbose ? 'true' : '';
});
commander.on('command:*', function () {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', commander.args.join(' '));
    process.exit(1);
});
function resolve_generator(name, model_path, indexFile) {
    const generator_name = typeof name === 'string' ? name : name.generator || '';
    const output = typeof name === 'object' ? name.output : undefined;
    const generator_path = [
        path_1.default.dirname(resolve_global_1.default.silent(generator_name) || '') +
            '/generator.json',
        generator_name + '.json',
        path_1.default.resolve(generator_name + '.json'),
        path_1.default.resolve(path_1.default.join(model_path, generator_name + '.json')),
        path_1.default.resolve(path_1.default.join(model_path, generator_name, 'generator.json')),
        generator_name,
        path_1.default.resolve(generator_name),
        path_1.default.resolve(path_1.default.join(model_path, generator_name)),
    ].filter(fs_1.default.existsSync);
    if (generator_path.length < 1) {
        throw new Error('generator not found for: ' + generator_name);
    }
    ui.log('loading generator: ', generator_path[0]);
    return (0, require_helper_1.default)('./generator').load(generator_path[0], output, indexFile);
}
const generateModels = async (modelsToExecute) => {
    await Promise.all(modelsToExecute.map(async (modelIndex) => {
        const model = modelIndex.load();
        await Promise.all(model.generators.map((g) => resolve_generator(g, path_1.default.dirname(modelIndex.path), modelIndex).generate(model, modelIndex.output || '')));
    }));
};
async function generate(model_path, output_path) {
    const clayFilePath = path_1.default.resolve('.clay');
    if (!fs_1.default.existsSync(clayFilePath)) {
        throw new Error('This folder has not been initiated with clay. Please create a .clay file.');
    }
    const indexFile = (0, clay_file_1.load)('.');
    let modelsToExecute;
    if (model_path) {
        modelsToExecute = [indexFile.getModelIndex(model_path, output_path)];
    }
    else {
        modelsToExecute = indexFile.models.map((m) => indexFile.getModelIndex(m.path, m.output));
    }
    await generateModels(modelsToExecute);
    indexFile.save();
}
const cleanModels = (modelsToExecute) => {
    modelsToExecute.forEach((modelIndex) => {
        const model = modelIndex.load();
        model.generators.forEach((g) => resolve_generator(g, path_1.default.dirname(modelIndex.path), modelIndex).clean(model, modelIndex.output || ''));
    });
};
function clean(model_path, output_path) {
    const clayFilePath = path_1.default.resolve('.clay');
    if (!fs_1.default.existsSync(clayFilePath)) {
        throw new Error('This folder has not been initiated with clay. Please create a .clay file.');
    }
    const indexFile = (0, clay_file_1.load)('.');
    let modelsToExecute;
    if (model_path) {
        modelsToExecute = [indexFile.getModelIndex(model_path, output_path)];
    }
    else {
        modelsToExecute = indexFile.models.map((m) => indexFile.getModelIndex(m.path, m.output));
    }
    cleanModels(modelsToExecute);
    indexFile.save();
}
const test = (model_path, json_path) => {
    const clayFilePath = path_1.default.resolve('.clay');
    if (!fs_1.default.existsSync(clayFilePath)) {
        throw new Error('This folder has not been initiated with clay. Please create a .clay file.');
    }
    const model = (0, require_helper_1.default)('./model').load(model_path);
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
function init(type, name) {
    try {
        if (type === 'generator' && name) {
            const generatorPath = path_1.default.join('clay', 'generators', name);
            fs_1.default.mkdirSync(generatorPath, { recursive: true });
            const generatorFilePath = path_1.default.join(generatorPath, 'generator.json');
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
            fs_1.default.writeFileSync(generatorFilePath, JSON.stringify(generatorTemplate, null, 2));
            ui.log(`Generator initialized at ${generatorFilePath}`);
        }
        else {
            (0, clay_file_1.createClayFile)('.');
        }
    }
    catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
        }
        else {
            console.error(String(error));
        }
        process.exit(1);
    }
}
commander
    .command('init [type] [name]')
    .description('initializes the folder with an empty .clay file or a generator')
    .action(init);
function watch(model_path, output_path) {
    const indexFile = (0, clay_file_1.load)('.');
    let modelsToExecute;
    if (model_path) {
        modelsToExecute = [indexFile.getModelIndex(model_path, output_path)];
    }
    else {
        modelsToExecute = indexFile.models.map((m) => indexFile.getModelIndex(m.path, m.output));
    }
    const directories_to_watch = lodash_1.default.uniq(modelsToExecute.map((modelIndex) => path_1.default.dirname(path_1.default.resolve(modelIndex.path))));
    directories_to_watch.forEach((model_directory) => {
        ui.watch(model_directory);
        chokidar_1.default
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
async function generatorList() {
    const clayFilePath = path_1.default.resolve('.clay');
    if (!fs_1.default.existsSync(clayFilePath)) {
        throw new Error('This folder has not been initiated with clay. Please create a .clay file.');
    }
    const clayFile = (0, clay_file_1.load)('.');
    generatorManager.listGenerators(clayFile);
}
async function generatorAdd(generatorRef) {
    if (!generatorRef) {
        ui.warn('Please provide a generator reference (GitHub URL or generator name)');
        return;
    }
    const clayFilePath = path_1.default.resolve('.clay');
    if (!fs_1.default.existsSync(clayFilePath)) {
        throw new Error('This folder has not been initiated with clay. Please create a .clay file.');
    }
    const clayFile = (0, clay_file_1.load)('.');
    await generatorManager.addGenerator(generatorRef, clayFile);
    clayFile.save();
}
async function generatorDelete(generatorName) {
    const clayFilePath = path_1.default.resolve('.clay');
    if (!fs_1.default.existsSync(clayFilePath)) {
        throw new Error('This folder has not been initiated with clay. Please create a .clay file.');
    }
    const clayFile = (0, clay_file_1.load)('.');
    await generatorManager.deleteGenerator(generatorName, clayFile);
    clayFile.save();
}
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
    .description('delete a generator (will prompt for selection if name not provided)')
    .action(generatorDelete);
generatorCommand
    .command('clear-cache')
    .description('clear the local registry cache to force refresh from GitHub')
    .action(() => generatorManager.clearRegistryCache());
exports.default = commander;
//# sourceMappingURL=command-line.js.map