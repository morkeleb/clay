const fs = require("fs-extra");
const path = require("path");
const inquirer = require("inquirer");
const ui = require("./output");
const { execSync } = require("child_process");
const _ = require("lodash");
const https = require("https");

/**
 * Fetch registry from GitHub
 * @returns {Promise<Object>} The registry data from GitHub
 */
function fetchRegistryFromGitHub() {
  return new Promise((resolve, reject) => {
    const registryUrl = "https://raw.githubusercontent.com/morkeleb/clay/master/generator-registry.json";
    
    https.get(registryUrl, (res) => {
      let data = "";
      
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch registry: HTTP ${res.statusCode}`));
        return;
      }
      
      res.on("data", (chunk) => {
        data += chunk;
      });
      
      res.on("end", () => {
        try {
          const registry = JSON.parse(data);
          resolve(registry);
        } catch (error) {
          reject(new Error(`Failed to parse registry JSON: ${error.message}`));
        }
      });
    }).on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Get the path to the local registry cache
 * @returns {string} Path to the local cache file
 */
function getRegistryCachePath() {
  const homeDir = require("os").homedir();
  const clayDir = path.join(homeDir, ".clay");
  fs.ensureDirSync(clayDir);
  return path.join(clayDir, "registry-cache.json");
}

/**
 * Save registry to local cache
 * @param {Object} registry - The registry data to cache
 */
function saveRegistryCache(registry) {
  try {
    const cachePath = getRegistryCachePath();
    fs.writeFileSync(cachePath, JSON.stringify(registry, null, 2));
  } catch (error) {
    // Silently fail if we can't write cache
    ui.warn(`Could not save registry cache: ${error.message}`);
  }
}

/**
 * Load registry from local cache
 * @returns {Object|null} The cached registry or null if not available
 */
function loadRegistryCache() {
  try {
    const cachePath = getRegistryCachePath();
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, "utf8"));
    }
  } catch (error) {
    // Cache is invalid or corrupted
  }
  return null;
}

/**
 * Load the generator registry from GitHub (with local fallback)
 * @returns {Object} The generator registry data
 */
async function loadGeneratorRegistry() {
  try {
    // Try to fetch from GitHub first
    const registry = await fetchRegistryFromGitHub();
    // Save to cache for offline use
    saveRegistryCache(registry);
    return registry;
  } catch (error) {
    ui.warn(`Could not fetch registry from GitHub: ${error.message}`);
    
    // Try to use cached version
    const cachedRegistry = loadRegistryCache();
    if (cachedRegistry) {
      ui.info("Using cached registry (may be outdated)");
      return cachedRegistry;
    }
    
    // Final fallback: try to load from local file in repo
    try {
      const localRegistryPath = path.join(__dirname, "..", "generator-registry.json");
      if (fs.existsSync(localRegistryPath)) {
        ui.info("Using local registry file");
        return require(localRegistryPath);
      }
    } catch (localError) {
      // Ignore
    }
    
    ui.warn("No registry available. Cannot list or add generators by name.");
    return { generators: {} };
  }
}

/**
 * Find a generator in the registry by name
 * @param {string} generatorName - Name of the generator to find
 * @returns {Promise<Object|null>} Generator info from registry or null if not found
 */
async function findGeneratorInRegistry(generatorName) {
  const registry = await loadGeneratorRegistry();
  return registry.generators[generatorName] || null;
}

/**
 * List available generators from the registry
 * @returns {Promise<void>}
 */
async function listAvailableGenerators() {
  const registry = await loadGeneratorRegistry();
  const generators = Object.entries(registry.generators);
  
  if (generators.length === 0) {
    ui.info("No generators found in registry.");
    return;
  }
  
  ui.info("Available generators from registry:");
  generators.forEach(([key, gen]) => {
    ui.log(`  ${key} - ${gen.name}`);
    ui.log(`    ${gen.description}`);
    ui.log(`    Repository: ${gen.repository}`);
    ui.log(`    Tags: ${gen.tags.join(", ")}`);
    ui.log("");
  });
}

/**
 * Clear the local registry cache
 * @returns {void}
 */
function clearRegistryCache() {
  try {
    const cachePath = getRegistryCachePath();
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
      ui.info("Registry cache cleared successfully.");
    } else {
      ui.info("No cache file to clear.");
    }
  } catch (error) {
    ui.warn(`Failed to clear cache: ${error.message}`);
  }
}

/**
 * Get all generators from all models in the clay file
 * @param {Object} clayFile - The loaded clay file
 * @returns {Array} Array of generator info objects
 */
function getAllGenerators(clayFile) {
  const generators = new Set();
  const generatorInfo = new Map();

  clayFile.models.forEach((model, modelIndex) => {
    try {
      const modelData = require(path.resolve(model.path));
      if (modelData.generators) {
        modelData.generators.forEach((gen) => {
          const genName = typeof gen === "string" ? gen : gen.generator;
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
    } catch (error) {
      ui.warn(`Could not load model at ${model.path}: ${error.message}`);
    }
  });

  return Array.from(generatorInfo.values());
}

/**
 * List all generators installed in models
 * @param {Object} clayFile - The loaded clay file
 */
function listGenerators(clayFile) {
  const generators = getAllGenerators(clayFile);

  if (generators.length === 0) {
    ui.info("No generators found in any models.");
    return;
  }

  ui.info("Installed generators:");
  generators.forEach((gen) => {
    ui.log(`  ${gen.name} - Used in ${gen.usedInModels.length} model(s):`);
    gen.usedInModels.forEach((usage) => {
      ui.log(`    - ${usage.modelPath}`);
    });
  });
}

/**
 * Check if a generator exists locally
 * @param {string} generatorRef - Generator reference (can be path or name)
 * @returns {boolean} True if generator exists locally
 */
function generatorExistsLocally(generatorRef) {
  // Check if it's a direct path to a generator.json file
  if (generatorRef.endsWith('generator.json') && fs.existsSync(generatorRef)) {
    return true;
  }
  
  // Check if it's a path to a directory containing generator.json
  if (fs.existsSync(generatorRef) && fs.existsSync(path.join(generatorRef, "generator.json"))) {
    return true;
  }
  
  // Check in clay/generators/<name>
  const generatorName = path.basename(generatorRef);
  const generatorPath = path.join("clay", "generators", generatorName);
  return (
    fs.existsSync(generatorPath) &&
    fs.existsSync(path.join(generatorPath, "generator.json"))
  );
}

/**
 * Download and install a generator from a GitHub repository
 * @param {string} repoUrl - GitHub repository URL or known generator name
 * @param {string} generatorName - Local name for the generator
 */
async function downloadGenerator(repoUrl, generatorName) {
  const generatorPath = path.join("clay", "generators", generatorName);

  // Ensure the generators directory exists
  fs.ensureDirSync(path.join("clay", "generators"));

  try {
    // Try to clone the repository
    ui.execute(`git clone ${repoUrl} ${generatorPath}`);
    execSync(`git clone ${repoUrl} ${generatorPath}`, { stdio: "inherit" });

    // Check if generator.json exists in the cloned repo
    const generatorJsonPath = path.join(generatorPath, "generator.json");
    if (!fs.existsSync(generatorJsonPath)) {
      throw new Error(
        "Downloaded repository does not contain a generator.json file",
      );
    }

    ui.info(
      `Generator "${generatorName}" downloaded successfully to ${generatorPath}`,
    );
    return true;
  } catch (error) {
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
 * @param {string} generatorRef - Generator reference (GitHub URL, local path, or known name)
 * @param {Object} clayFile - The loaded clay file
 */
async function addGenerator(generatorRef, clayFile) {
  // Determine generator name from reference
  let generatorName;
  let generatorPath = generatorRef;
  let isGitRepo = false;
  let isLocalPath = false;

  if (generatorRef.includes("github.com") || generatorRef.includes("git")) {
    isGitRepo = true;
    // Extract repository name as generator name
    const matches = generatorRef.match(/\/([^\/]+?)(?:\.git)?$/);
    if (matches) {
      generatorName = matches[1];
    } else {
      ui.warn("Could not determine generator name from repository URL");
      const { name } = await inquirer.prompt([
        {
          type: "input",
          name: "name",
          message: "Enter a name for this generator:",
          validate: (input) =>
            input.trim().length > 0 || "Generator name cannot be empty",
        },
      ]);
      generatorName = name.trim();
    }
  } else if (generatorRef.includes("/") || generatorRef.includes("\\")) {
    // Looks like a path
    isLocalPath = true;
    generatorName = path.basename(generatorRef);
    generatorPath = generatorRef;
  } else {
    generatorName = generatorRef;
    generatorPath = generatorRef;
    
    // Check if this is a known generator in the registry
    const registryEntry = await findGeneratorInRegistry(generatorName);
    if (registryEntry) {
      ui.info(`Found "${generatorName}" in registry: ${registryEntry.description}`);
      isGitRepo = true;
      generatorRef = registryEntry.repository;
      ui.info(`Using repository: ${registryEntry.repository}`);
    }
  }

  // Check if generator already exists locally
  if (!generatorExistsLocally(generatorRef)) {
    if (isGitRepo) {
      const success = await downloadGenerator(generatorRef, generatorName);
      if (!success) {
        return;
      }
      generatorPath = `clay/generators/${generatorName}`;
    } else if (!isLocalPath) {
      // Try to find if it's a known generator or installed globally
      ui.warn(
        `Generator "${generatorName}" not found locally and not in registry.`
      );
      ui.info("You can:");
      ui.info("1. Provide a GitHub repository URL");
      ui.info("2. Install it globally with npm/yarn");
      ui.info("3. Use 'clay generator list-available' to see available generators");
      return;
    }
  } else {
    // Generator exists locally, use the provided reference as the path
    if (isLocalPath) {
      generatorPath = generatorRef;
    } else {
      generatorPath = `clay/generators/${generatorName}`;
    }
  }

  // Select which model to add generator to
  if (clayFile.models.length === 0) {
    ui.warn("No models found in .clay file. Please add some models first.");
    return;
  }

  let selectedModel;
  if (clayFile.models.length === 1) {
    selectedModel = clayFile.models[0];
    ui.info(
      `Adding generator to the only available model: ${selectedModel.path}`,
    );
  } else {
    const { modelChoice } = await inquirer.prompt([
      {
        type: "list",
        name: "modelChoice",
        message: "Select a model to add the generator to:",
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

    // Check if generator is already in the model
    const alreadyExists = modelData.generators.some((gen) => {
      const existingName = typeof gen === "string" ? gen : gen.generator;
      return existingName === generatorName || existingName === generatorPath;
    });

    if (alreadyExists) {
      ui.warn(
        `Generator "${generatorName}" is already added to model ${selectedModel.path}`,
      );
      return;
    }

    // Add the generator using the determined path
    modelData.generators.push(generatorPath);

    // Write back to model file
    fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));
    ui.info(
      `Generator "${generatorName}" added to model ${selectedModel.path}`,
    );
  } catch (error) {
    ui.warn(`Failed to update model file: ${error.message}`);
  }
}

/**
 * Delete a generator
 * @param {string} generatorName - Optional generator name
 * @param {Object} clayFile - The loaded clay file
 */
async function deleteGenerator(generatorName, clayFile) {
  const generators = getAllGenerators(clayFile);

  if (generators.length === 0) {
    ui.info("No generators found to delete.");
    return;
  }

  let selectedGenerator;

  if (generatorName) {
    selectedGenerator = generators.find((gen) => 
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
        type: "list",
        name: "generatorChoice",
        message: "Select a generator to delete:",
        choices: generators.map((gen) => ({
          name: `${gen.name} (used in ${gen.usedInModels.length} model(s))`,
          value: gen.name,
        })),
      },
    ]);
    selectedGenerator = generators.find((gen) => gen.name === generatorChoice);
  }

  // If generator is used in multiple models, let user select which ones to remove from
  let modelsToRemoveFrom = selectedGenerator.usedInModels;

  if (selectedGenerator.usedInModels.length > 1) {
    const { modelChoices } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "modelChoices",
        message: `Generator "${selectedGenerator.name}" is used in multiple models. Select which models to remove it from:`,
        choices: selectedGenerator.usedInModels.map((usage, index) => ({
          name: usage.modelPath,
          value: index,
          checked: true,
        })),
      },
    ]);

    if (modelChoices.length === 0) {
      ui.info("No models selected. Generator deletion cancelled.");
      return;
    }

    modelsToRemoveFrom = modelChoices.map(
      (index) => selectedGenerator.usedInModels[index],
    );
  }

  // Remove generator from selected models
  for (const usage of modelsToRemoveFrom) {
    try {
      const modelPath = path.resolve(usage.modelPath);
      const modelData = require(modelPath);

      if (modelData.generators) {
        modelData.generators = modelData.generators.filter((gen) => {
          const genName = typeof gen === "string" ? gen : gen.generator;
          return (
            genName !== selectedGenerator.name &&
            !genName.endsWith(`/${selectedGenerator.name}`)
          );
        });

        fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));
        ui.info(
          `Removed generator "${selectedGenerator.name}" from model ${usage.modelPath}`,
        );
      }
    } catch (error) {
      ui.warn(
        `Failed to update model file ${usage.modelPath}: ${error.message}`,
      );
    }
  }

  // Check if generator is still used in any model
  const updatedGenerators = getAllGenerators(clayFile);
  const stillInUse = updatedGenerators.find(
    (gen) => gen.name === selectedGenerator.name,
  );

  // If not used anywhere and exists locally, ask if user wants to delete the folder
  if (!stillInUse && generatorExistsLocally(selectedGenerator.name)) {
    const { deleteFolder } = await inquirer.prompt([
      {
        type: "confirm",
        name: "deleteFolder",
        message: `Generator "${selectedGenerator.name}" is no longer used in any model. Delete the generator folder?`,
        default: true,
      },
    ]);

    if (deleteFolder) {
      const generatorPath = path.join(
        "clay",
        "generators",
        selectedGenerator.name,
      );
      fs.removeSync(generatorPath);
      ui.info(`Deleted generator folder: ${generatorPath}`);
    }
  }
}

module.exports = {
  listGenerators,
  addGenerator,
  deleteGenerator,
  getAllGenerators,
  generatorExistsLocally,
  listAvailableGenerators,
  findGeneratorInRegistry,
  loadGeneratorRegistry,
  clearRegistryCache,
};
