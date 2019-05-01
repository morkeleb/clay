const fs = require('fs-extra');
const path = require('path');
const handlebars = require('./template-engine');
const ui = require('./output');
const jp = require('jsonpath');
const _ = require('lodash');
const { execSync } = require('child_process');

function write(file, data) {
  const dir = path.dirname(file);
  fs.ensureDirSync(dir);
  ui.write(file)
  fs.writeFileSync(file, data, 'utf8');
}

function recursive_parents(model, jsonpath, element){
  if(!element) return;
  var parent_path, parent, have_result;
  do {
    jsonpath.pop()
    parent_path = jp.stringify(jsonpath)
    parent = jp.nodes(model, parent_path);
    have_result = parent.length != 0 && !Array.isArray(parent[0].value) && parent[0].value
  } while(!have_result)
  if(parent[0]) {
    if(jsonpath.length != 1)
    recursive_parents(model, parent[0].path, parent[0])
    have_result.json_path = parent_path;
    element.value.clay_parent = have_result;
  }
}

function select(model, jsonpath) {
  try {
  var result =  jp.nodes(model, jsonpath);
  result.forEach(r=>recursive_parents(model, r.path, r))

  } catch(e){
    ui.critical('Jsonpath not parseable ', jsonpath)

    return []
  }
  if(result.length == 0){
    ui.warn('No entires found for jsonpath ', jsonpath)
  }
  return result.map(f=>f.value);
}

function generate_file(model_partial, directory, output, file) {
  var template = handlebars.compile(fs.readFileSync(path.join(directory, file), 'utf8'));
  var file_name = handlebars.compile(path.join(output,file))	
  model_partial.forEach((m)=>{
    write( file_name(m), template(m));
  })
}

function remove_file(model_partial, output, file) {
  var file_name = handlebars.compile(path.join(output,file))	
  model_partial.forEach((m)=>{
    ui.warn('removing ', file_name(m))
    fs.removeSync(file_name(m));
  })
}

function generate_directory(model_partial, directory, output) {
  const templates = fs.readdirSync(directory);

  templates.filter((file)=>fs.lstatSync(path.join(directory,file)).isDirectory())
  .forEach((file)=>{
    generate_directory(model_partial, path.join(directory, file), path.join(output, file))
  })
  
  templates.filter((file)=>fs.lstatSync(path.join(directory,file)).isFile()).forEach(file => {
    generate_file(model_partial, directory, output, file)
  });
}
function remove_directory(model_partial, directory, output) {
  const templates = fs.readdirSync(directory);

  templates.filter((file)=>fs.lstatSync(path.join(directory,file)).isDirectory())
  .forEach((file)=>{
    remove_directory(model_partial, path.join(directory, file), path.join(output, file))
  })
  
  templates.filter((file)=>fs.lstatSync(path.join(directory,file)).isFile()).forEach(file => {
    remove_file(model_partial, output, file)
  });
}

function execute(commandline, output_dir){
  ui.execute(commandline);
  execSync(commandline, {cwd: output_dir, stdio: process.env.VERBOSE ? 'inherit' : 'pipe'})	
}

function generate_template(step, model, output, dirname) {
  if(fs.lstatSync(path.join(dirname, step.generate)).isFile()) {
    generate_file(select(model, step.select),path.join(dirname, path.dirname(step.generate)), path.join(output, step.target || ''), path.basename(step.generate))
  } else {
    generate_directory(select(model, step.select), path.join(dirname, step.generate), path.join(output, step.target || ''))
  }
}

function clean_template(step, model, output, dirname) {
  if(fs.lstatSync(path.join(dirname, step.generate)).isFile()) {
    remove_file(select(model, step.select), path.join(output, step.target || ''), path.basename(step.generate))
  } else {
    remove_directory(select(model, step.select), path.join(dirname, step.generate), path.join(output, step.target || ''))
  }
}

function run_command(step, model, output, dirname) {
  const output_dir = path.resolve(output)
  fs.ensureDirSync(output_dir)
  if(step.select == undefined) {
    execute(step.runCommand, output_dir)
  } else {
    var command = handlebars.compile(step.runCommand)
    select(model, step.select).forEach((m)=>{
      execute(command(m), output_dir)
    })
  }
}

function copy(step, model, output, dirname){
  const output_dir = path.resolve(output)
  let source = path.resolve(path.join(dirname, step.copy))
  if(step.select == undefined) {
    let out = null;
    if(step.target) {
      out = path.join(output_dir, step.target)
    } else {
      out = output_dir
    }
    if(fs.lstatSync(source).isFile()){
      out = path.join(out, path.basename(step.copy))
    }
    fs.ensureDirSync(output_dir)
    ui.copy(source, out)
    fs.copySync(source, out)
  } else {
    select(model, step.select).forEach((m)=>{
      let out = null;
      if(step.target) {
        let target = handlebars.compile(step.target)
        out = path.join(output_dir, target(m))
      } else {
        out = output_dir
      }
      fs.ensureDirSync(output_dir)
      ui.copy(source, out)
      fs.copySync(source, out)
      const recusiveHandlebars = (p)=>{
        fs.readdirSync(p).forEach((f)=>{
          let file = path.join(p, f)
          if(fs.lstatSync(file).isDirectory()){
            recusiveHandlebars(file)
          } else {
            const template = handlebars.compile(file)
            ui.move(source, out)
            fs.moveSync(file, template(m))
          }
          
        })
      }
      recusiveHandlebars(out);
    })
  }
}

function clean_copy(step, model, output, dirname){
  const output_dir = path.resolve(output)
  let source = path.resolve(path.join(dirname, step.copy))
  if(step.select == undefined) {
    let out = null;
    if(step.target) {
      out = path.join(output_dir, step.target)
    } else {
      out = output_dir
    }
    if(fs.lstatSync(source).isFile()){
      out = path.join(out, path.basename(step.copy))
    }
    ui.warn('Removing ', out)
    fs.removeSync(out)
  } else {
    select(model, step.select).forEach((m)=>{
      let out = null;
      if(step.target) {
        let target = handlebars.compile(step.target)
        out = path.join(output_dir, target(m))
      } else {
        out = output_dir
      }
      ui.warn('Removing ', out)
      fs.removeSync(out)
    })
  }
}

function decorate_generator(g, p, extra_output) {
  g.generate = (model, output) => {
    output = path.join(output, extra_output || '')
    const dirname = path.dirname(p);
    handlebars.load_partials(g.partials, dirname);
    for (let index = 0; index < g.steps.length; index++) {
      const step = g.steps[index];
      if(step.generate !== undefined){
        generate_template(step, _.cloneDeep(model), output, dirname)
      }
      else if (step.runCommand !== undefined){
        run_command(step, _.cloneDeep(model), output, dirname)
      } else if (step.copy !== undefined){
        copy(step, _.cloneDeep(model), output, dirname)
      }
    }
  }
  g.clean = (model, output)=>{
    output = path.join(output, extra_output || '')
    const dirname = path.dirname(p);
    handlebars.load_partials(g.partials, dirname);
    for (let index = 0; index < g.steps.length; index++) {
      const step = g.steps[index];
      if(step.generate !== undefined){
        clean_template(step, _.cloneDeep(model), output, dirname)
      } else if (step.copy !== undefined){
        clean_copy(step, _.cloneDeep(model), output, dirname)
      }
    }
  }
  return g;
}

module.exports = {
  load: (path, extra_output)=>{
    var generator = JSON.parse(fs.readFileSync(path, 'utf8'));
    
    return decorate_generator(generator, path, extra_output);
  }
}
