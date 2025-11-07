const fs = require("fs-extra");
const path = require("path");
const handlebars = require("./template-engine");
const ui = require("./output");
const _ = require("lodash");
const { execSync } = require("child_process");
const jph = require("./jsonpath-helper");
const requireNew = require("./require-helper");
const minimatch = require("minimatch");
const crypto = require("crypto");
const { z } = require("zod");
const jp = require("jsonpath");
const output = require("./output");

const isValidJsonPath = (path) => {
  try {
    jp.parse(path);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

const SelectSchema = z
  .string()
  .optional()
  .superRefine((path, ctx) => {
    if (path && !isValidJsonPath(path).valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid JSONPath in 'select': ${path}`,
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

function validateGeneratorSchema(generator) {
  const result = GeneratorSchema.safeParse(generator);
  if (!result.success) {
    const detailedErrors = result.error.issues.map((issue) => {
      const path = issue.path.join(".");
      const message = `Error in path '${path}': ${issue.message}`;
      output.warn(message); // Use output.js for pretty-printed warnings
      return message;
    });

    throw new Error(`Invalid generator schema:\n${detailedErrors.join("\n")}`);
  }
  return result.data;
}

function getMd5ForContent(content) {
  return crypto.createHash("md5").update(content).digest("hex");
}

async function applyFormatters(generator, file_name, data, step) {
  const resolveGlobal = require("resolve-global");
  const formatters = generator.formatters || [];
  let result = data;

  // Normalize each entry to { pkg, options }
  const formatterSpecs = formatters.map((fmt) => {
    if (typeof fmt === "string") {
      // legacy: just the package name
      return { pkg: fmt, options: {}, new: false };
    } else if (typeof fmt === "object" && fmt.package) {
      // new: { package: "...", options: { ... } }
      return { pkg: fmt.package, options: fmt.options || {}, new: true };
    } else {
      throw new Error(
        `Invalid formatter spec: ${JSON.stringify(fmt)}. ` +
          `Expected string or { package, options }.`
      );
    }
  });
  console.log("formatters", formatterSpecs);

  // Load all formatter modules
  const loadedFormatters = formatterSpecs.map(({ pkg }) =>
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
        console.log("applying formatter new", formatter.apply);
        // new signature: apply(file, content, options)
        result = await formatter.apply(file_name, result, options, step);
      } else {
        console.log("applying formatter old", formatter.apply);
        // old signature: apply(file, content)
        result = await formatter.apply(file_name, result);
      }
    } catch (e) {
      ui.critical(
        "Failed to apply formatter for:",
        file_name,
        "This is probably not due to Clay but the formatter itself",
        e
      );
      throw e;
    }
  }

  return result;
}

function write(file, data) {
  const dir = path.dirname(file);
  fs.ensureDirSync(dir);
  ui.write(file);
  fs.writeFileSync(file, data, "utf8");
}

async function generate_file(
  generator,
  model_partial,
  directory,
  output,
  file,
  modelIndex,
  step
) {
  var template = handlebars.compile(
    fs.readFileSync(path.join(directory, file), "utf8")
  );
  var file_name = handlebars.compile(path.join(output, file));
  await Promise.all(
    model_partial.map(async (m) => {
      const filename = file_name(m);
      if (step.touch && fs.existsSync(filename)) {
        ui.info("skipping touch file:", filename);
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
          "Failed to generate content for: ",
          filename,
          " This probably not due to clay but the template itself",
          e
        );
        throw e;
      }
    })
  );
}

function remove_file(modelIndex, file) {
  ui.warn("removing ", file);
  if (fs.existsSync(file)) {
    fs.removeSync(file);
  }
  modelIndex.delFileCheckSum(file);
}

async function generate_directory(
  generator,
  model_partial,
  directory,
  output,
  modelIndex,
  step
) {
  const templates = fs.readdirSync(directory);

  await Promise.all(
    templates
      .filter((file) => fs.lstatSync(path.join(directory, file)).isDirectory())
      .map((file) =>
        generate_directory(
          generator,
          model_partial,
          path.join(directory, file),
          path.join(output, file),
          modelIndex,
          step
        )
      )
  );

  return Promise.all(
    templates
      .filter((file) => fs.lstatSync(path.join(directory, file)).isFile())
      .map((file) =>
        generate_file(
          generator,
          model_partial,
          directory,
          output,
          file,
          modelIndex,
          step
        )
      )
  );
}

function execute(commandline, output_dir, npxCommand, verbose) {
  let cmd = commandline;
  if (npxCommand) {
    // prepend generators dir to commandline to execute it in the current directory

    cmd = `npx ${commandline}`;
  }
  ui.execute(cmd);
  try {
    execSync(cmd, {
      cwd: output_dir,
      stdio: verbose ? "inherit" : "pipe",
    });
  } catch (e) {
    ui.warn("error while executing", commandline);
    ui.warn(e.stdout.toString());
  }
}

function generate_template(
  generator,
  step,
  model,
  output,
  dirname,
  modelIndex
) {
  if (fs.lstatSync(path.join(dirname, step.generate)).isFile()) {
    return generate_file(
      generator,
      jph.select(model, step.select),
      path.join(dirname, path.dirname(step.generate)),
      path.join(output, step.target || ""),
      path.basename(step.generate),
      modelIndex,
      step
    );
  } else {
    return generate_directory(
      generator,
      jph.select(model, step.select),
      path.join(dirname, step.generate),
      path.join(output, step.target || ""),
      modelIndex,
      step
    );
  }
}

function remove_generated_files(modelIndex) {
  const files = Object.keys(modelIndex.generated_files);
  files.forEach((f) => remove_file(modelIndex, f));
}

function run_command(step, model, output, dirname) {
  const output_dir = path.resolve(output);
  fs.ensureDirSync(output_dir);
  const verbose =
    step.verbose !== undefined ? step.verbose : !!process.env.VERBOSE;

  if (step.select == undefined) {
    execute(step.runCommand, output_dir, step.npxCommand, verbose);
  } else {
    var command = handlebars.compile(step.runCommand);
    jph.select(model, step.select).forEach((m) => {
      execute(command(m), output_dir, step.npxCommand, verbose);
    });
  }
}

function addToIndex(modelIndex, file) {
  if (!modelIndex.generated_files[file]) {
    modelIndex.generated_files[file] = true;
  }
}

function cleanEmptyDirectories(directory) {
  if (fs.existsSync(directory) && fs.lstatSync(directory).isDirectory()) {
    const files = fs.readdirSync(directory);
    if (files.length === 0) {
      fs.rmdirSync(directory);
      ui.warn("Removed empty directory", directory);
    }
  }
}

function copy(step, model, output, dirname, modelIndex) {
  const output_dir = path.resolve(output);
  let source = path.resolve(path.join(dirname, step.copy));
  if (step.select == undefined) {
    let out = null;
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
      let out = null;
      if (step.target) {
        let target = handlebars.compile(step.target);
        out = path.join(output_dir, target(m));
      } else {
        out = output_dir;
      }
      fs.ensureDirSync(output_dir);
      ui.copy(source, out);
      fs.copySync(source, out);
      addToIndex(modelIndex, out);
      const recusiveHandlebars = (p) => {
        fs.readdirSync(p).forEach((f) => {
          let file = path.join(p, f);
          if (fs.lstatSync(file).isDirectory()) {
            recusiveHandlebars(file);
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
      recusiveHandlebars(out);
    });
  }
}

function decorate_generator(g, p, extra_output, modelIndex) {
  validateGeneratorSchema(g);
  g.generate = async (model, output) => {
    output = path.join(output, extra_output || "");
    const dirname = path.dirname(p);
    handlebars.load_partials(g.partials, dirname);
    for (let index = 0; index < g.steps.length; index++) {
      const step = g.steps[index];
      if (step.generate !== undefined) {
        await generate_template(
          g,
          step,
          _.cloneDeep(model),
          output,
          dirname,
          modelIndex
        );
      } else if (step.runCommand !== undefined) {
        run_command(step, _.cloneDeep(model), output, dirname);
      } else if (step.copy !== undefined) {
        copy(step, _.cloneDeep(model), output, dirname, modelIndex);
      }
    }
  };
  g.clean = (model, output) => {
    output = path.join(output, extra_output || "");
    const dirname = path.dirname(p);
    remove_generated_files(modelIndex);

    // Remove empty directories
    Object.keys(modelIndex.generated_files).forEach((file) => {
      const dir = path.dirname(file);
      cleanEmptyDirectories(dir);
    });
  };
  return g;
}

module.exports = {
  load: (p, extra_output, index) => {
    // todo replace with decache?
    var generator = requireNew(path.resolve(p));
    return decorate_generator(generator, p, extra_output, index);
  },
};
