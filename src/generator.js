const fs = require('fs-extra');
const path = require('path');
const handlebars = require('./template-engine');
const jp = require('jsonpath');
const { execSync } = require('child_process');

function write(file, data) {
  const dir = path.dirname(file);
  fs.ensureDirSync(dir);
  console.log('writing: '+file);
  fs.writeFileSync(file, data, 'utf8');
}

function select(model, jsonpath) {
  var result =  jp.query(model, jsonpath);
  if(result.length == 0){
    console.warn('Warning! No entires found for jsonpath ', jsonpath)
  }
  return result;
}

function generate_directory(model_partial, directory, output) {
  const templates = fs.readdirSync(directory);

  templates.filter((file)=>fs.lstatSync(path.join(directory,file)).isDirectory())
  .forEach((file)=>{
    generate_directory(model_partial, path.join(directory, file), path.join(output, file))
  })
  
  templates.filter((file)=>fs.lstatSync(path.join(directory,file)).isFile()).forEach(file => {
    var template = handlebars.compile(fs.readFileSync(path.join(directory,file), 'utf8'));
    var file_name = handlebars.compile(path.join(output,file))	
    model_partial.forEach((m)=>{
      write( file_name(m), template(m));
    })
  });
}

function execute(commandline, output_dir){

  console.log('executing: ', commandline);
  execSync(commandline, {cwd: output_dir, stdio: process.env.VERBOSE ? 'inherit' : 'pipe'})	
}

function decorate_generator(g, p) {
  g.generate = (model, output) => {
    const dirname = path.dirname(p);
    handlebars.load_partials(g.partials, dirname);
    for (let index = 0; index < g.steps.length; index++) {
      const step = g.steps[index];
      if(step.generate !== undefined){
        generate_directory(select(model, step.select), path.join(dirname, step.generate), path.join(output, step.target || ''))
      }
      else if (step.runCommand !== undefined){
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
      } else if (step.copy !== undefined){
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
          console.log('copying: ', source, '->', out);
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
            console.log('copying: ', source, '->', out);
            fs.copySync(source, out)
            const recusiveHandlebars = (p)=>{
              fs.readdirSync(p).forEach((f)=>{
                let file = path.join(p, f)
                if(fs.lstatSync(file).isDirectory()){
                  recusiveHandlebars(file)
                } else {
                  const template = handlebars.compile(file)
                  console.log('moving: ', file, '->', template(m));
                  fs.moveSync(file, template(m))
                }
                
              })
            }
            recusiveHandlebars(out);
          })
        }
      }
    }
    
  }
  return g;
}

module.exports = {
  load: (path)=>{
    var generator = JSON.parse(fs.readFileSync(path, 'utf8'));
    
    return decorate_generator(generator, path);
  }
}
