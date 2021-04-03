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

function getMd5ForContent(content) {
  return crypto.createHash("md5").update(content).digest("hex");
}

async function applyFormatters(generator, file_name, data) {
  const resolveGlobal = require("resolve-global");
  const formatters = generator.formatters || [];
  const loaded_formatters = formatters.map((name) =>
    require(resolveGlobal(name))
  );
  let result = data;

  for (let i = 0; i < loaded_formatters.length; i++) {
    const formatter = loaded_formatters[i];
    const applyFormatter = _.get(formatter, "extensions", []).some((ext) =>
      minimatch(file_name, ext)
    );

    if (applyFormatter) {
      result = await formatter.apply(file_name, result);
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
  modelIndex
) {
  var template = handlebars.compile(
    fs.readFileSync(path.join(directory, file), "utf8")
  );
  var file_name = handlebars.compile(path.join(output, file));
  await Promise.all(
    model_partial.map(async (m) => {
      const filename = file_name(m);
      const preFormattedOutput = template(m);
      const md5 = getMd5ForContent(preFormattedOutput);
      if (modelIndex.getFileCheckSum(filename) !== md5) {
        const content = await applyFormatters(
          generator,
          filename,
          preFormattedOutput
        );

        write(filename, content);
        modelIndex.setFileCheckSum(filename, md5);
      }
    })
  );
}

function remove_file(model_partial, output, file) {
  var file_name = handlebars.compile(path.join(output, file));
  model_partial.forEach((m) => {
    ui.warn("removing ", file_name(m));
    fs.removeSync(file_name(m));
  });
}

async function generate_directory(
  generator,
  model_partial,
  directory,
  output,
  modelIndex
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
          modelIndex
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
          modelIndex
        )
      )
  );
}
function remove_directory(model_partial, directory, output) {
  const templates = fs.readdirSync(directory);

  templates
    .filter((file) => fs.lstatSync(path.join(directory, file)).isDirectory())
    .forEach((file) => {
      remove_directory(
        model_partial,
        path.join(directory, file),
        path.join(output, file)
      );
    });

  templates
    .filter((file) => fs.lstatSync(path.join(directory, file)).isFile())
    .forEach((file) => {
      remove_file(model_partial, output, file);
    });
}

function execute(commandline, output_dir) {
  ui.execute(commandline);
  try {
    execSync(commandline, {
      cwd: output_dir,
      stdio: process.env.VERBOSE ? "inherit" : "pipe",
    });
  } catch (e) {
    ui.critical("error while excuting", commandline, e);
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
      modelIndex
    );
  } else {
    return generate_directory(
      generator,
      jph.select(model, step.select),
      path.join(dirname, step.generate),
      path.join(output, step.target || ""),
      modelIndex
    );
  }
}

function clean_template(step, model, output, dirname) {
  if (fs.lstatSync(path.join(dirname, step.generate)).isFile()) {
    remove_file(
      jph.select(model, step.select),
      path.join(output, step.target || ""),
      path.basename(step.generate)
    );
  } else {
    remove_directory(
      jph.select(model, step.select),
      path.join(dirname, step.generate),
      path.join(output, step.target || "")
    );
  }
}

function run_command(step, model, output, dirname) {
  const output_dir = path.resolve(output);
  fs.ensureDirSync(output_dir);
  if (step.select == undefined) {
    execute(step.runCommand, output_dir);
  } else {
    var command = handlebars.compile(step.runCommand);
    jph.select(model, step.select).forEach((m) => {
      execute(command(m), output_dir);
    });
  }
}

function copy(step, model, output, dirname) {
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
            }
          }
        });
      };
      recusiveHandlebars(out);
    });
  }
}

function clean_copy(step, model, output, dirname) {
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
    ui.warn("Removing ", out);
    fs.removeSync(out);
  } else {
    jph.select(model, step.select).forEach((m) => {
      let out = null;
      if (step.target) {
        let target = handlebars.compile(step.target);
        out = path.join(output_dir, target(m));
      } else {
        out = output_dir;
      }
      ui.warn("Removing ", out);
      fs.removeSync(out);
    });
  }
}

function decorate_generator(g, p, extra_output, modelIndex) {
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
        copy(step, _.cloneDeep(model), output, dirname);
      }
    }
  };
  g.clean = (model, output) => {
    output = path.join(output, extra_output || "");
    const dirname = path.dirname(p);
    handlebars.load_partials(g.partials, dirname);
    for (let index = 0; index < g.steps.length; index++) {
      const step = g.steps[index];
      if (step.generate !== undefined) {
        clean_template(step, _.cloneDeep(model), output, dirname);
      } else if (step.copy !== undefined) {
        clean_copy(step, _.cloneDeep(model), output, dirname);
      }
    }
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
