
const {Command} = require('commander');
const commander = new Command();
const path = require('path')
const fs = require('fs')
const ui = require('./output')
const resolveGlobal = require('resolve-global')

commander
  .version(require('../package.json').version);

commander.option('-v, --verbose', 'ignore test hook');
commander.on('option:verbose', function () {
  process.env.VERBOSE = this.verbose;
});

// error on unknown commands
commander.on('command:*', function () {
  console.error('Invalid command: %s\nSee --help for a list of available commands.', commander.args.join(' '));
  process.exit(1);
});

function resolve_generator(name, model_path) {
  const { generator, output} = name;
  const generator_name = generator || name;
  var generator_path = [
    (path.dirname(resolveGlobal.silent(generator_name)||''))+'/generator.json',
    generator_name, generator_name+'.json',
    path.resolve(generator_name), path.resolve(generator_name+'.json'),
    path.resolve(path.join(model_path, generator_name)),
    path.resolve(path.join(model_path, generator_name + '.json'))
  ].filter(fs.existsSync)
  
  
  if(generator_path.length < 1){
    throw 'generator not found for: '+generator_name
  }

  ui.log('loading generator: ', generator_path[0]);
  
  return require('./generator').load(generator_path[0], output)
}

commander.command('generate <model_path> <output_path>')
.description('runs the generators')
.action((model_path, output_path)=>{
  const model = require('./model').load(model_path);
  model.generators.forEach(
    g=>resolve_generator(g, path.dirname(model_path)).generate(model, output_path)
  )
})

module.exports = commander;
