const { Command } = require("commander");
const requireNew = require("./require-helper");
const commander = new Command();
const path = require("path");
const fs = require("fs");
const ui = require("./output");
const _ = require("lodash");
const resolveGlobal = require("resolve-global");
const chokidar = require("chokidar");
const { createClayFile } = require("./clay_file");
const generatorManager = require("./generator-manager");

commander.version(require("../package.json").version);

commander.option("-v, --verbose", "ignore test hook");
commander.on("option:verbose", function () {
  process.env.VERBOSE = this.verbose;
});

// error on unknown commands
commander.on("command:*", function () {
  console.error(
    "Invalid command: %s\nSee --help for a list of available commands.",
    commander.args.join(" "),
  );
  process.exit(1);
});

function resolve_generator(name, model_path, indexFile) {
  const { generator, output } = name;
  const generator_name = generator || name;
  var generator_path = [
    path.dirname(resolveGlobal.silent(generator_name) || "") +
      "/generator.json",
    generator_name + ".json",
    path.resolve(generator_name + ".json"),
    path.resolve(path.join(model_path, generator_name + ".json")),
    path.resolve(path.join(model_path, generator_name, "generator.json")),
    generator_name,
    path.resolve(generator_name),
    path.resolve(path.join(model_path, generator_name)),
  ].filter(fs.existsSync);

  if (generator_path.length < 1) {
    throw "generator not found for: " + generator_name;
  }

  ui.log("loading generator: ", generator_path[0]);

  return requireNew("./generator").load(generator_path[0], output, indexFile);
}

const generateModels = async (modelsToExecute) =>
  Promise.all(
    modelsToExecute.map(async (modelIndex) => {
      const model = modelIndex.load();
      await Promise.all(
        model.generators.map((g) =>
          resolve_generator(
            g,
            path.dirname(modelIndex.path),
            modelIndex,
          ).generate(model, modelIndex.output),
        ),
      );
    }),
  );

async function generate(model_path, output_path) {
  const clayFilePath = path.resolve(".clay");
  if (!fs.existsSync(clayFilePath)) {
    throw new Error(
      "This folder has not been initiated with clay. Please create a .clay file.",
    );
  }

  const indexFile = require("./clay_file").load(".");

  let modelsToExecute = null;

  if (model_path)
    modelsToExecute = [indexFile.getModelIndex(model_path, output_path)];
  else {
    modelsToExecute = indexFile.models.map((m) =>
      indexFile.getModelIndex(m.path, m.output),
    );
  }

  await generateModels(modelsToExecute);
  indexFile.save();
}

const cleanModels = (modelsToExecute) => {
  modelsToExecute.map(async (modelIndex) => {
    const model = modelIndex.load();
    model.generators.forEach((g) =>
      resolve_generator(g, path.dirname(modelIndex.path), modelIndex).clean(
        model,
        modelIndex.output,
      ),
    );
  });
};

function clean(model_path, output_path) {
  const clayFilePath = path.resolve(".clay");
  if (!fs.existsSync(clayFilePath)) {
    throw new Error(
      "This folder has not been initiated with clay. Please create a .clay file.",
    );
  }

  const indexFile = require("./clay_file").load(".");
  let modelsToExecute = null;

  if (model_path)
    modelsToExecute = [indexFile.getModelIndex(model_path, output_path)];
  else {
    modelsToExecute = indexFile.models.map((m) =>
      indexFile.getModelIndex(m.path, m.output),
    );
  }
  cleanModels(modelsToExecute);
  indexFile.save();
}

const test = (model_path, json_path) => {
  const clayFilePath = path.resolve(".clay");
  if (!fs.existsSync(clayFilePath)) {
    throw new Error(
      "This folder has not been initiated with clay. Please create a .clay file.",
    );
  }

  const model = requireNew("./model").load(model_path);
  const jph = require("./jsonpath-helper");

  console.log(jph.select(model, json_path));
};

commander
  .command("test-path <model_path> <json_path>")
  .description("test a json-path selector using your model")
  .action(test);

commander
  .command("clean [model_path] [output_path]")
  .description("cleans up the output of the generators")
  .action(clean);

commander
  .command("generate [model_path] [output_path]")
  .description("runs the generators")
  .action(generate);

function init(type, name) {
  try {
    if (type === "generator" && name) {
      const generatorPath = path.join("clay", "generators", name);
      fs.mkdirSync(generatorPath, { recursive: true });
      const generatorFilePath = path.join(generatorPath, "generator.json");
      const generatorTemplate = {
        partials: [],
        formatters: [],
        steps: [
          {
            generate: "templates/example-template.txt",
            select: "$.model.example",
            target: "./output",
          },
        ],
      };
      fs.writeFileSync(
        generatorFilePath,
        JSON.stringify(generatorTemplate, null, 2),
      );
      ui.log(`Generator initialized at ${generatorFilePath}`);
    } else {
      createClayFile(".");
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

commander
  .command("init [type] [name]")
  .description("initializes the folder with an empty .clay file or a generator")
  .action(init);

function watch(model_path, output_path) {
  const indexFile = require("./clay_file").load(".");
  let modelsToExecute = null;

  if (model_path)
    modelsToExecute = [indexFile.getModelIndex(model_path, output_path)];
  else {
    modelsToExecute = indexFile.models.map((m) =>
      indexFile.getModelIndex(m.path, m.output),
    );
  }

  const directories_to_watch = _.uniq(
    modelsToExecute.map((modelIndex) =>
      path.dirname(path.resolve(modelIndex.path)),
    ),
  );
  directories_to_watch.forEach((model_directory) => {
    ui.watch(model_directory);

    chokidar
      .watch(model_directory, { ignored: /(^|[\/\\])\../, ignoreInitial: true })
      .on("all", (event, path) => {
        modelsToExecute.forEach((modelIndex) => {
          generate(modelIndex.path, modelIndex.output);

          ui.watch(model_directory);
        });
      });
  });
}

commander
  .command("watch [model_path] [output_path]")
  .description("runs the generators on filechanges in the models directory")
  .action(watch);

// Generator management commands
async function generatorList() {
  const clayFilePath = path.resolve(".clay");
  if (!fs.existsSync(clayFilePath)) {
    throw new Error(
      "This folder has not been initiated with clay. Please create a .clay file.",
    );
  }

  const clayFile = require("./clay_file").load(".");
  generatorManager.listGenerators(clayFile);
}

async function generatorAdd(generatorRef) {
  if (!generatorRef) {
    ui.warn(
      "Please provide a generator reference (GitHub URL or generator name)",
    );
    return;
  }

  const clayFilePath = path.resolve(".clay");
  if (!fs.existsSync(clayFilePath)) {
    throw new Error(
      "This folder has not been initiated with clay. Please create a .clay file.",
    );
  }

  const clayFile = require("./clay_file").load(".");
  await generatorManager.addGenerator(generatorRef, clayFile);
  clayFile.save();
}

async function generatorDelete(generatorName) {
  const clayFilePath = path.resolve(".clay");
  if (!fs.existsSync(clayFilePath)) {
    throw new Error(
      "This folder has not been initiated with clay. Please create a .clay file.",
    );
  }

  const clayFile = require("./clay_file").load(".");
  await generatorManager.deleteGenerator(generatorName, clayFile);
  clayFile.save();
}

// Add generator commands
const generatorCommand = commander
  .command("generator")
  .description("manage generators");

generatorCommand
  .command("list")
  .description("list all generators installed in models")
  .action(generatorList);

generatorCommand
  .command("list-available")
  .description("list all available generators from the registry")
  .action(async () => await generatorManager.listAvailableGenerators());

generatorCommand
  .command("add <generator_ref>")
  .description("add a generator from GitHub repository or known generator name")
  .action(generatorAdd);

generatorCommand
  .command("delete [generator_name]")
  .description(
    "delete a generator (will prompt for selection if name not provided)",
  )
  .action(generatorDelete);

generatorCommand
  .command("clear-cache")
  .description("clear the local registry cache to force refresh from GitHub")
  .action(() => generatorManager.clearRegistryCache());

module.exports = commander;
