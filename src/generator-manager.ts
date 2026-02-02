/**
 * Generator manager module for installing and managing clay generators
 * 
 * All generators are stored and used locally from the clay/generators/ directory.
 * This module supports:
 * - Creating new generators: clay init generator <name>
 * - Cloning generators from GitHub repositories to local storage
 * - Looking up generator repositories from the registry for discovery
 * - Managing generators in models
 * 
 * The registry helps users discover useful generators they can clone.
 * After cloning, all generators are local and can be customized per-project.
 * 
 * Note: Uses `any` types for:
 * - HTTP response data parsing (JSON from GitHub)
 * - Dynamic package.json and registry file structures
 * - Inquirer prompt responses which can vary
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import * as ui from './output';
import { execSync } from 'child_process';
import _ from 'lodash';
import https from 'https';
import os from 'os';
import type { ClayFileManager } from './types/clay-file';

interface GeneratorRegistry {
  generators: {
    [key: string]: {
      name: string;
      description: string;
      repository: string;
      tags: string[];
    };
  };
}

interface GeneratorUsage {
  modelIndex: number;
  modelPath: string;
  generator: string | object;
}

interface GeneratorInfo {
  name: string;
  usedInModels: GeneratorUsage[];
}

/**
 * Fetch registry from GitHub
 * @returns The registry data from GitHub
 */
function fetchRegistryFromGitHub(): Promise<GeneratorRegistry> {
  return new Promise((resolve, reject) => {
    const registryUrl =
      'https://raw.githubusercontent.com/morkeleb/clay/master/generator-registry.json';

    https
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
          } catch (error: any) {
            reject(
              new Error(`Failed to parse registry JSON: ${error.message}`)
            );
          }
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Get the path to the local registry cache
 * @returns Path to the local cache file
 */
function getRegistryCachePath(): string {
  const homeDir = os.homedir();
  const clayDir = path.join(homeDir, '.clay');
  fs.ensureDirSync(clayDir);
  return path.join(clayDir, 'registry-cache.json');
}

/**
 * Save registry to local cache
 * @param registry - The registry data to cache
 */
function saveRegistryCache(registry: GeneratorRegistry): void {
  try {
    const cachePath = getRegistryCachePath();
    fs.writeFileSync(cachePath, JSON.stringify(registry, null, 2));
  } catch (error: any) {
    // Silently fail if we can't write cache
    ui.warn(`Could not save registry cache: ${error.message}`);
  }
}

/**
 * Load registry from local cache
 * @returns The cached registry or null if not available
 */
function loadRegistryCache(): GeneratorRegistry | null {
  try {
    const cachePath = getRegistryCachePath();
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }
  } catch {
    // Cache is invalid or corrupted
  }
  return null;
}

/**
 * Load the generator registry from GitHub (with local fallback)
 * @returns The generator registry data
 */
export async function loadGeneratorRegistry(): Promise<GeneratorRegistry> {
  try {
    // Try to fetch from GitHub first
    const registry = await fetchRegistryFromGitHub();
    // Save to cache for offline use
    saveRegistryCache(registry);
    return registry;
  } catch (error: any) {
    ui.warn(`Could not fetch registry from GitHub: ${error.message}`);

    // Try to use cached version
    const cachedRegistry = loadRegistryCache();
    if (cachedRegistry) {
      ui.info('Using cached registry (may be outdated)');
      return cachedRegistry;
    }

    // Final fallback: try to load from local file in repo
    try {
      const localRegistryPath = path.join(
        __dirname,
        '..',
        'generator-registry.json'
      );
      if (fs.existsSync(localRegistryPath)) {
        ui.info('Using local registry file');
        return require(localRegistryPath);
      }
    } catch {
      // Ignore
    }

    ui.warn('No registry available. Cannot list or add generators by name.');
    return { generators: {} };
  }
}

/**
 * Find a generator in the registry by name
 * @param generatorName - Name of the generator to find
 * @returns Generator info from registry or null if not found
 */
export async function findGeneratorInRegistry(
  generatorName: string
): Promise<GeneratorRegistry['generators'][string] | null> {
  const registry = await loadGeneratorRegistry();
  return registry.generators[generatorName] || null;
}

/**
 * List available generators from the registry
 * Shows generators that can be cloned to your local clay/generators/ directory
 */
export async function listAvailableGenerators(): Promise<void> {
  const registry = await loadGeneratorRegistry();
  const generators = Object.entries(registry.generators);

  if (generators.length === 0) {
    ui.info('No generators found in registry.');
    return;
  }

  ui.info('Available generators (will be copied to clay/generators/):');
  generators.forEach(([key, gen]) => {
    ui.log(`  ${key} - ${gen.name}`);
    ui.log(`    ${gen.description}`);
    ui.log(`    Repository: ${gen.repository}`);
    ui.log(`    Tags: ${gen.tags.join(', ')}`);
    ui.log('');
  });
}

/**
 * Clear the local registry cache
 */
export function clearRegistryCache(): void {
  try {
    const cachePath = getRegistryCachePath();
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
      ui.info('Registry cache cleared successfully.');
    } else {
      ui.info('No cache file to clear.');
    }
  } catch (error: any) {
    ui.warn(`Failed to clear cache: ${error.message}`);
  }
}

/**
 * Get all generators from all models in the clay file
 * @param clayFile - The loaded clay file
 * @returns Array of generator info objects
 */
export function getAllGenerators(clayFile: ClayFileManager): GeneratorInfo[] {
  const generators = new Set<string>();
  const generatorInfo = new Map<string, GeneratorInfo>();

  clayFile.models.forEach((model, modelIndex) => {
    try {
      const modelData = require(path.resolve(model.path));
      if (modelData.generators) {
        modelData.generators.forEach((gen: string | { generator: string }) => {
          const genName = typeof gen === 'string' ? gen : gen.generator;
          generators.add(genName);

          if (!generatorInfo.has(genName)) {
            generatorInfo.set(genName, {
              name: genName,
              usedInModels: [],
            });
          }

          generatorInfo.get(genName)!.usedInModels.push({
            modelIndex,
            modelPath: model.path,
            generator: gen,
          });
        });
      }
    } catch (error: any) {
      ui.warn(`Could not load model at ${model.path}: ${error.message}`);
    }
  });

  return Array.from(generatorInfo.values());
}

/**
 * List all generators installed in models
 * @param clayFile - The loaded clay file
 */
export function listGenerators(clayFile: ClayFileManager): void {
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

/**
 * Check if a generator exists locally
 * @param generatorRef - Generator reference (can be path or name)
 * @returns True if generator exists locally
 */
export function generatorExistsLocally(generatorRef: string): boolean {
  // Check if it's a direct path to a generator.json file
  if (generatorRef.endsWith('generator.json') && fs.existsSync(generatorRef)) {
    return true;
  }

  // Check if it's a path to a directory containing generator.json
  if (
    fs.existsSync(generatorRef) &&
    fs.existsSync(path.join(generatorRef, 'generator.json'))
  ) {
    return true;
  }

  // Check in clay/generators/<name>
  const generatorName = path.basename(generatorRef);
  const generatorPath = path.join('clay', 'generators', generatorName);
  return (
    fs.existsSync(generatorPath) &&
    fs.existsSync(path.join(generatorPath, 'generator.json'))
  );
}

/**
 * Remove .git directory from a path to prevent git submodule issues
 * 
 * @param generatorPath - Path to the generator directory
 */
function removeGitDirectory(generatorPath: string): void {
  const gitPath = path.join(generatorPath, '.git');
  if (fs.existsSync(gitPath)) {
    fs.removeSync(gitPath);
  }
}

/**
 * Copy a generator directory and remove .git to prevent submodule issues
 * 
 * @param sourcePath - Source path to copy from
 * @param targetPath - Target path to copy to
 */
function copyGeneratorAndCleanGit(sourcePath: string, targetPath: string): void {
  fs.copySync(sourcePath, targetPath);
  removeGitDirectory(targetPath);
}

/**
 * Download and install a generator from a GitHub repository
 * This clones the repository and copies it to clay/generators/<name>
 * After installation, the generator is used locally.
 * 
 * @param repoUrl - GitHub repository URL
 * @param generatorName - Local name for the generator
 */
async function downloadGenerator(
  repoUrl: string,
  generatorName: string
): Promise<boolean> {
  const generatorPath = path.join('clay', 'generators', generatorName);

  // Ensure the generators directory exists
  fs.ensureDirSync(path.join('clay', 'generators'));

  try {
    // Try to clone the repository
    ui.execute(`git clone ${repoUrl} ${generatorPath}`);
    execSync(`git clone ${repoUrl} ${generatorPath}`, { stdio: 'inherit' });

    // Check if generator.json exists in the cloned repo
    const generatorJsonPath = path.join(generatorPath, 'generator.json');
    if (!fs.existsSync(generatorJsonPath)) {
      throw new Error(
        'Downloaded repository does not contain a generator.json file'
      );
    }

    // Remove .git directory to prevent git from treating it as a submodule
    removeGitDirectory(generatorPath);

    ui.info(
      `Generator "${generatorName}" downloaded successfully to ${generatorPath}`
    );
    return true;
  } catch (error: any) {
    // Clean up on failure
    if (fs.existsSync(generatorPath)) {
      fs.removeSync(generatorPath);
    }
    ui.warn(`Failed to download generator: ${error.message}`);
    return false;
  }
}

/**
 * Add a generator to a model
 * 
 * Generators are always used locally from clay/generators/. This function:
 * 1. For GitHub URLs: Clones the repo to clay/generators/<name>
 * 2. For local paths: Uses the existing local generator
 * 3. For registry names: Looks up the repo in the registry and clones it
 * 4. For non-existent names: Suggests creating with 'clay init generator'
 * 
 * @param generatorRef - Generator reference (GitHub URL, local path, or registry name)
 * @param clayFile - The loaded clay file
 */
export async function addGenerator(
  generatorRef: string,
  clayFile: ClayFileManager
): Promise<void> {
  // Determine generator name from reference
  let generatorName: string;
  let isGitRepo = false;
  let isLocalPath = false;

  if (generatorRef.includes('github.com') || generatorRef.includes('git')) {
    isGitRepo = true;
    // Extract repository name as generator name
    const matches = generatorRef.match(/\/([^\/]+?)(?:\.git)?$/);
    if (matches) {
      generatorName = matches[1];
    } else {
      ui.warn('Could not determine generator name from repository URL');
      const { name } = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Enter a name for this generator:',
          validate: (input: string) =>
            input.trim().length > 0 || 'Generator name cannot be empty',
        },
      ]);
      generatorName = name.trim();
    }
  } else if (generatorRef.includes('/') || generatorRef.includes('\\')) {
    // Looks like a path
    isLocalPath = true;
    generatorName = path.basename(generatorRef);
  } else {
    generatorName = generatorRef;

    // Check if this is a known generator in the registry
    const registryEntry = await findGeneratorInRegistry(generatorName);
    if (registryEntry) {
      ui.info(
        `Found "${generatorName}" in registry: ${registryEntry.description}`
      );
      isGitRepo = true;
      generatorRef = registryEntry.repository;
      ui.info(`Cloning to: clay/generators/${generatorName}`);
    }
  }

  // Check if generator already exists locally
  if (!generatorExistsLocally(generatorRef)) {
    if (isGitRepo) {
      const success = await downloadGenerator(generatorRef, generatorName);
      if (!success) {
        return;
      }
    } else if (isLocalPath) {
      // Copy generator from local path to clay/generators
      const targetPath = path.join('clay', 'generators', generatorName);
      
      try {
        // Check if source path exists and has generator.json
        const sourcePath = path.resolve(generatorRef);
        const sourceGeneratorJson = path.join(sourcePath, 'generator.json');
        
        if (!fs.existsSync(sourceGeneratorJson)) {
          ui.warn(`No generator.json found at ${sourcePath}`);
          return;
        }
        
        // Ensure target directory exists
        fs.ensureDirSync(path.dirname(targetPath));
        
        // Copy the generator directory
        ui.info(`Copying generator from ${sourcePath} to ${targetPath}`);
        copyGeneratorAndCleanGit(sourcePath, targetPath);
        
        ui.info(`Generator "${generatorName}" copied successfully to ${targetPath}`);
      } catch (error: any) {
        ui.warn(`Failed to copy generator: ${error.message}`);
        return;
      }
    } else {
      // Generator not found locally
      ui.warn(
        `Generator "${generatorName}" not found locally.`
      );
      ui.info('');
      ui.info('Options:');
      ui.info(`1. Create a new generator: clay init generator ${generatorName}`);
      ui.info('2. Provide a GitHub URL to clone: clay generator add <github-url>');
      ui.info('3. Browse available generators: clay generator list-available');
      ui.info('4. Provide a path to an existing generator directory');
      ui.info('');
      return;
    }
  } else {
    // Generator exists locally in clay/generators
    if (isLocalPath) {
      // If it's a local path pointing to an external location, ask if they want to copy it
      const targetPath = path.join('clay', 'generators', generatorName);
      const sourcePath = path.resolve(generatorRef);
      
      if (fs.existsSync(targetPath)) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: `Generator "${generatorName}" already exists in clay/generators/. Overwrite?`,
            default: false,
          },
        ]);
        
        if (overwrite) {
          ui.info(`Copying generator from ${sourcePath} to ${targetPath}`);
          fs.removeSync(targetPath);
          copyGeneratorAndCleanGit(sourcePath, targetPath);
          
          ui.info(`Generator "${generatorName}" updated successfully`);
        }
      } else {
        // Target doesn't exist yet, but generatorExistsLocally returned true
        // This means the source path exists and has generator.json
        ui.info(`Copying generator from ${sourcePath} to ${targetPath}`);
        copyGeneratorAndCleanGit(sourcePath, targetPath);
        
        ui.info(`Generator "${generatorName}" copied successfully to ${targetPath}`);
      }
    }
  }

  // Select which model to add generator to
  if (clayFile.models.length === 0) {
    ui.warn('No models found in .clay file. Please add some models first.');
    return;
  }

  let selectedModel;
  if (clayFile.models.length === 1) {
    selectedModel = clayFile.models[0];
    ui.info(
      `Adding generator to the only available model: ${selectedModel.path}`
    );
  } else {
    const { modelChoice } = await inquirer.prompt([
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

  // Load and update the model file
  try {
    const modelPath = path.resolve(selectedModel.path);
    const modelData = require(modelPath);

    // Ensure generators array exists
    if (!modelData.generators) {
      modelData.generators = [];
    }

    // Add the generator with the path pattern that matches existing generators
    // Use "generators/<name>/generator.json" format for consistency
    const generatorReference = `generators/${generatorName}/generator.json`;

    // Check if generator is already in the model
    const alreadyExists = modelData.generators.some(
      (gen: string | { generator: string }) => {
        const existingName = typeof gen === 'string' ? gen : gen.generator;
        // Check if it matches the full reference or contains the generator name
        return existingName === generatorReference || 
               existingName.includes(`/${generatorName}/`) ||
               existingName.endsWith(`/${generatorName}`) ||
               existingName === generatorName;
      }
    );

    if (alreadyExists) {
      ui.warn(
        `Generator "${generatorName}" is already added to model ${selectedModel.path}`
      );
      return;
    }

    modelData.generators.push(generatorReference);

    // Write back to model file
    fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));
    ui.info(
      `Generator "${generatorName}" added to model ${selectedModel.path}`
    );
  } catch (error: any) {
    ui.warn(`Failed to update model file: ${error.message}`);
  }
}

/**
 * Delete a generator
 * @param generatorName - Optional generator name
 * @param clayFile - The loaded clay file
 */
export async function deleteGenerator(
  generatorName: string | undefined,
  clayFile: ClayFileManager
): Promise<void> {
  const generators = getAllGenerators(clayFile);

  if (generators.length === 0) {
    ui.info('No generators found to delete.');
    return;
  }

  let selectedGenerator: GeneratorInfo | undefined;

  if (generatorName) {
    selectedGenerator = generators.find(
      (gen) =>
        gen.name === generatorName ||
        gen.name === `clay/generators/${generatorName}` ||
        path.basename(gen.name) === generatorName
    );
    if (!selectedGenerator) {
      ui.warn(`Generator "${generatorName}" not found in any models.`);
      return;
    }
  } else {
    // Let user select which generator to delete
    const { generatorChoice } = await inquirer.prompt([
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

  if (!selectedGenerator) return;

  // If generator is used in multiple models, let user select which ones to remove from
  let modelsToRemoveFrom = selectedGenerator.usedInModels;

  if (selectedGenerator.usedInModels.length > 1) {
    const { modelChoices } = await inquirer.prompt([
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

    modelsToRemoveFrom = modelChoices.map(
      (index: number) => selectedGenerator!.usedInModels[index]
    );
  }

  // Remove generator from selected models
  for (const usage of modelsToRemoveFrom) {
    try {
      const modelPath = path.resolve(usage.modelPath);
      const modelData = require(modelPath);

      if (modelData.generators) {
        modelData.generators = modelData.generators.filter(
          (gen: string | { generator: string }) => {
            const genName = typeof gen === 'string' ? gen : gen.generator;
            return (
              genName !== selectedGenerator!.name &&
              !genName.endsWith(`/${selectedGenerator!.name}`)
            );
          }
        );

        fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));
        ui.info(
          `Removed generator "${selectedGenerator.name}" from model ${usage.modelPath}`
        );
      }
    } catch (error: any) {
      ui.warn(
        `Failed to update model file ${usage.modelPath}: ${error.message}`
      );
    }
  }

  // Check if generator is still used in any model
  const updatedGenerators = getAllGenerators(clayFile);
  const stillInUse = updatedGenerators.find(
    (gen) => gen.name === selectedGenerator!.name
  );

  // If not used anywhere and exists locally, ask if user wants to delete the folder
  if (!stillInUse && generatorExistsLocally(selectedGenerator.name)) {
    const { deleteFolder } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'deleteFolder',
        message: `Generator "${selectedGenerator.name}" is no longer used in any model. Delete the generator folder?`,
        default: true,
      },
    ]);

    if (deleteFolder) {
      const generatorPath = path.join(
        'clay',
        'generators',
        selectedGenerator.name
      );
      fs.removeSync(generatorPath);
      ui.info(`Deleted generator folder: ${generatorPath}`);
    }
  }
}
