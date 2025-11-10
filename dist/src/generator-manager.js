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
exports.loadGeneratorRegistry = loadGeneratorRegistry;
exports.findGeneratorInRegistry = findGeneratorInRegistry;
exports.listAvailableGenerators = listAvailableGenerators;
exports.clearRegistryCache = clearRegistryCache;
exports.getAllGenerators = getAllGenerators;
exports.listGenerators = listGenerators;
exports.generatorExistsLocally = generatorExistsLocally;
exports.addGenerator = addGenerator;
exports.deleteGenerator = deleteGenerator;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const inquirer_1 = __importDefault(require("inquirer"));
const ui = __importStar(require("./output"));
const child_process_1 = require("child_process");
const https_1 = __importDefault(require("https"));
const os_1 = __importDefault(require("os"));
function fetchRegistryFromGitHub() {
    return new Promise((resolve, reject) => {
        const registryUrl = 'https://raw.githubusercontent.com/morkeleb/clay/master/generator-registry.json';
        https_1.default
            .get(registryUrl, (res) => {
            let data = '';
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch registry: HTTP ${res.statusCode}`));
                return;
            }
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const registry = JSON.parse(data);
                    resolve(registry);
                }
                catch (error) {
                    reject(new Error(`Failed to parse registry JSON: ${error.message}`));
                }
            });
        })
            .on('error', (error) => {
            reject(error);
        });
    });
}
function getRegistryCachePath() {
    const homeDir = os_1.default.homedir();
    const clayDir = path_1.default.join(homeDir, '.clay');
    fs_extra_1.default.ensureDirSync(clayDir);
    return path_1.default.join(clayDir, 'registry-cache.json');
}
function saveRegistryCache(registry) {
    try {
        const cachePath = getRegistryCachePath();
        fs_extra_1.default.writeFileSync(cachePath, JSON.stringify(registry, null, 2));
    }
    catch (error) {
        ui.warn(`Could not save registry cache: ${error.message}`);
    }
}
function loadRegistryCache() {
    try {
        const cachePath = getRegistryCachePath();
        if (fs_extra_1.default.existsSync(cachePath)) {
            return JSON.parse(fs_extra_1.default.readFileSync(cachePath, 'utf8'));
        }
    }
    catch {
    }
    return null;
}
async function loadGeneratorRegistry() {
    try {
        const registry = await fetchRegistryFromGitHub();
        saveRegistryCache(registry);
        return registry;
    }
    catch (error) {
        ui.warn(`Could not fetch registry from GitHub: ${error.message}`);
        const cachedRegistry = loadRegistryCache();
        if (cachedRegistry) {
            ui.info('Using cached registry (may be outdated)');
            return cachedRegistry;
        }
        try {
            const localRegistryPath = path_1.default.join(__dirname, '..', 'generator-registry.json');
            if (fs_extra_1.default.existsSync(localRegistryPath)) {
                ui.info('Using local registry file');
                return require(localRegistryPath);
            }
        }
        catch {
        }
        ui.warn('No registry available. Cannot list or add generators by name.');
        return { generators: {} };
    }
}
async function findGeneratorInRegistry(generatorName) {
    const registry = await loadGeneratorRegistry();
    return registry.generators[generatorName] || null;
}
async function listAvailableGenerators() {
    const registry = await loadGeneratorRegistry();
    const generators = Object.entries(registry.generators);
    if (generators.length === 0) {
        ui.info('No generators found in registry.');
        return;
    }
    ui.info('Available generators from registry:');
    generators.forEach(([key, gen]) => {
        ui.log(`  ${key} - ${gen.name}`);
        ui.log(`    ${gen.description}`);
        ui.log(`    Repository: ${gen.repository}`);
        ui.log(`    Tags: ${gen.tags.join(', ')}`);
        ui.log('');
    });
}
function clearRegistryCache() {
    try {
        const cachePath = getRegistryCachePath();
        if (fs_extra_1.default.existsSync(cachePath)) {
            fs_extra_1.default.unlinkSync(cachePath);
            ui.info('Registry cache cleared successfully.');
        }
        else {
            ui.info('No cache file to clear.');
        }
    }
    catch (error) {
        ui.warn(`Failed to clear cache: ${error.message}`);
    }
}
function getAllGenerators(clayFile) {
    const generators = new Set();
    const generatorInfo = new Map();
    clayFile.models.forEach((model, modelIndex) => {
        try {
            const modelData = require(path_1.default.resolve(model.path));
            if (modelData.generators) {
                modelData.generators.forEach((gen) => {
                    const genName = typeof gen === 'string' ? gen : gen.generator;
                    generators.add(genName);
                    if (!generatorInfo.has(genName)) {
                        generatorInfo.set(genName, {
                            name: genName,
                            usedInModels: [],
                        });
                    }
                    generatorInfo.get(genName).usedInModels.push({
                        modelIndex,
                        modelPath: model.path,
                        generator: gen,
                    });
                });
            }
        }
        catch (error) {
            ui.warn(`Could not load model at ${model.path}: ${error.message}`);
        }
    });
    return Array.from(generatorInfo.values());
}
function listGenerators(clayFile) {
    const generators = getAllGenerators(clayFile);
    if (generators.length === 0) {
        ui.info('No generators found in any models.');
        return;
    }
    ui.info('Installed generators:');
    generators.forEach((gen) => {
        ui.log(`  ${gen.name} - Used in ${gen.usedInModels.length} model(s):`);
        gen.usedInModels.forEach((usage) => {
            ui.log(`    - ${usage.modelPath}`);
        });
    });
}
function generatorExistsLocally(generatorRef) {
    if (generatorRef.endsWith('generator.json') && fs_extra_1.default.existsSync(generatorRef)) {
        return true;
    }
    if (fs_extra_1.default.existsSync(generatorRef) &&
        fs_extra_1.default.existsSync(path_1.default.join(generatorRef, 'generator.json'))) {
        return true;
    }
    const generatorName = path_1.default.basename(generatorRef);
    const generatorPath = path_1.default.join('clay', 'generators', generatorName);
    return (fs_extra_1.default.existsSync(generatorPath) &&
        fs_extra_1.default.existsSync(path_1.default.join(generatorPath, 'generator.json')));
}
async function downloadGenerator(repoUrl, generatorName) {
    const generatorPath = path_1.default.join('clay', 'generators', generatorName);
    fs_extra_1.default.ensureDirSync(path_1.default.join('clay', 'generators'));
    try {
        ui.execute(`git clone ${repoUrl} ${generatorPath}`);
        (0, child_process_1.execSync)(`git clone ${repoUrl} ${generatorPath}`, { stdio: 'inherit' });
        const generatorJsonPath = path_1.default.join(generatorPath, 'generator.json');
        if (!fs_extra_1.default.existsSync(generatorJsonPath)) {
            throw new Error('Downloaded repository does not contain a generator.json file');
        }
        ui.info(`Generator "${generatorName}" downloaded successfully to ${generatorPath}`);
        return true;
    }
    catch (error) {
        if (fs_extra_1.default.existsSync(generatorPath)) {
            fs_extra_1.default.removeSync(generatorPath);
        }
        ui.warn(`Failed to download generator: ${error.message}`);
        return false;
    }
}
async function addGenerator(generatorRef, clayFile) {
    let generatorName;
    let generatorPath = generatorRef;
    let isGitRepo = false;
    let isLocalPath = false;
    if (generatorRef.includes('github.com') || generatorRef.includes('git')) {
        isGitRepo = true;
        const matches = generatorRef.match(/\/([^\/]+?)(?:\.git)?$/);
        if (matches) {
            generatorName = matches[1];
        }
        else {
            ui.warn('Could not determine generator name from repository URL');
            const { name } = await inquirer_1.default.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'Enter a name for this generator:',
                    validate: (input) => input.trim().length > 0 || 'Generator name cannot be empty',
                },
            ]);
            generatorName = name.trim();
        }
    }
    else if (generatorRef.includes('/') || generatorRef.includes('\\')) {
        isLocalPath = true;
        generatorName = path_1.default.basename(generatorRef);
        generatorPath = generatorRef;
    }
    else {
        generatorName = generatorRef;
        generatorPath = generatorRef;
        const registryEntry = await findGeneratorInRegistry(generatorName);
        if (registryEntry) {
            ui.info(`Found "${generatorName}" in registry: ${registryEntry.description}`);
            isGitRepo = true;
            generatorRef = registryEntry.repository;
            ui.info(`Using repository: ${registryEntry.repository}`);
        }
    }
    if (!generatorExistsLocally(generatorRef)) {
        if (isGitRepo) {
            const success = await downloadGenerator(generatorRef, generatorName);
            if (!success) {
                return;
            }
            generatorPath = `clay/generators/${generatorName}`;
        }
        else if (!isLocalPath) {
            ui.warn(`Generator "${generatorName}" not found locally and not in registry.`);
            ui.info('You can:');
            ui.info('1. Provide a GitHub repository URL');
            ui.info('2. Install it globally with npm/yarn');
            ui.info("3. Use 'clay generator list-available' to see available generators");
            return;
        }
    }
    else {
        if (isLocalPath) {
            generatorPath = generatorRef;
        }
        else {
            generatorPath = `clay/generators/${generatorName}`;
        }
    }
    if (clayFile.models.length === 0) {
        ui.warn('No models found in .clay file. Please add some models first.');
        return;
    }
    let selectedModel;
    if (clayFile.models.length === 1) {
        selectedModel = clayFile.models[0];
        ui.info(`Adding generator to the only available model: ${selectedModel.path}`);
    }
    else {
        const { modelChoice } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'modelChoice',
                message: 'Select a model to add the generator to:',
                choices: clayFile.models.map((model, index) => ({
                    name: `${model.path} (output: ${model.output})`,
                    value: index,
                })),
            },
        ]);
        selectedModel = clayFile.models[modelChoice];
    }
    try {
        const modelPath = path_1.default.resolve(selectedModel.path);
        const modelData = require(modelPath);
        if (!modelData.generators) {
            modelData.generators = [];
        }
        const alreadyExists = modelData.generators.some((gen) => {
            const existingName = typeof gen === 'string' ? gen : gen.generator;
            return existingName === generatorName || existingName === generatorPath;
        });
        if (alreadyExists) {
            ui.warn(`Generator "${generatorName}" is already added to model ${selectedModel.path}`);
            return;
        }
        modelData.generators.push(generatorPath);
        fs_extra_1.default.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));
        ui.info(`Generator "${generatorName}" added to model ${selectedModel.path}`);
    }
    catch (error) {
        ui.warn(`Failed to update model file: ${error.message}`);
    }
}
async function deleteGenerator(generatorName, clayFile) {
    const generators = getAllGenerators(clayFile);
    if (generators.length === 0) {
        ui.info('No generators found to delete.');
        return;
    }
    let selectedGenerator;
    if (generatorName) {
        selectedGenerator = generators.find((gen) => gen.name === generatorName ||
            gen.name === `clay/generators/${generatorName}` ||
            path_1.default.basename(gen.name) === generatorName);
        if (!selectedGenerator) {
            ui.warn(`Generator "${generatorName}" not found in any models.`);
            return;
        }
    }
    else {
        const { generatorChoice } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'generatorChoice',
                message: 'Select a generator to delete:',
                choices: generators.map((gen) => ({
                    name: `${gen.name} (used in ${gen.usedInModels.length} model(s))`,
                    value: gen.name,
                })),
            },
        ]);
        selectedGenerator = generators.find((gen) => gen.name === generatorChoice);
    }
    if (!selectedGenerator)
        return;
    let modelsToRemoveFrom = selectedGenerator.usedInModels;
    if (selectedGenerator.usedInModels.length > 1) {
        const { modelChoices } = await inquirer_1.default.prompt([
            {
                type: 'checkbox',
                name: 'modelChoices',
                message: `Generator "${selectedGenerator.name}" is used in multiple models. Select which models to remove it from:`,
                choices: selectedGenerator.usedInModels.map((usage, index) => ({
                    name: usage.modelPath,
                    value: index,
                    checked: true,
                })),
            },
        ]);
        if (modelChoices.length === 0) {
            ui.info('No models selected. Generator deletion cancelled.');
            return;
        }
        modelsToRemoveFrom = modelChoices.map((index) => selectedGenerator.usedInModels[index]);
    }
    for (const usage of modelsToRemoveFrom) {
        try {
            const modelPath = path_1.default.resolve(usage.modelPath);
            const modelData = require(modelPath);
            if (modelData.generators) {
                modelData.generators = modelData.generators.filter((gen) => {
                    const genName = typeof gen === 'string' ? gen : gen.generator;
                    return (genName !== selectedGenerator.name &&
                        !genName.endsWith(`/${selectedGenerator.name}`));
                });
                fs_extra_1.default.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));
                ui.info(`Removed generator "${selectedGenerator.name}" from model ${usage.modelPath}`);
            }
        }
        catch (error) {
            ui.warn(`Failed to update model file ${usage.modelPath}: ${error.message}`);
        }
    }
    const updatedGenerators = getAllGenerators(clayFile);
    const stillInUse = updatedGenerators.find((gen) => gen.name === selectedGenerator.name);
    if (!stillInUse && generatorExistsLocally(selectedGenerator.name)) {
        const { deleteFolder } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'deleteFolder',
                message: `Generator "${selectedGenerator.name}" is no longer used in any model. Delete the generator folder?`,
                default: true,
            },
        ]);
        if (deleteFolder) {
            const generatorPath = path_1.default.join('clay', 'generators', selectedGenerator.name);
            fs_extra_1.default.removeSync(generatorPath);
            ui.info(`Deleted generator folder: ${generatorPath}`);
        }
    }
}
//# sourceMappingURL=generator-manager.js.map