
const {Command} = require('commander');
const commander = new Command();
const path = require('path')
const fs = require('fs')

commander
  .version(require('../package.json').version);


function resolve_generator(name, model_path) {
  
  var generator_path = [
    name, name+'.json',
    path.resolve(name), path.resolve(name+'.json'),
    path.resolve(path.join(model_path, name)),
    path.resolve(path.join(model_path, name + '.json'))
  ].filter(fs.existsSync)
  
  
  if(generator_path.length < 1){
    throw 'generator not found for: '+name
  }
  return require('./generator').load(generator_path[0])
}

commander.command('generate <model_path> <output_path>')
.description('runs the generators')
.action((model_path, output_path)=>{
  console.log(model_path, output_path);
  const model = require('./model').load(model_path);
  model.generators.forEach(
    (g)=>resolve_generator(g, path.dirname(model_path)).generate(model, output_path)
  )
})

module.exports = commander;
