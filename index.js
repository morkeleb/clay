#! /usr/bin/env node

var util = require('util');
var commander = require('commander');
var generator = require('./src/generator')
var files = require('./src/file-system');

//TODO: views and commands should be handled the same. ie, dirs in the templates dir
//      just like the way views is handled. Generation should be done with subdir and optional type

commander
  .version('0.0.1')
  .option('-m, --models_path [path]', 'the path to the model yaml file', function (path) {
    files.models_path = path;
  })
  .option('-v, --views_path [path]', 'the path to the views yaml file', function (path) {
    files.views_path = path;
  } )
  .option('-g, --generators_path [path]', 'the path to the generators folder', function (path) {
    files.generators_path = path;
  })
  .option('-r, --revert', 'revert writing operation', function () {
    generator.revert = true;
  })
  .command('*')
  .action(generator.generate_template).description('Generates the specifed generator');

commander
.command('list').description('Lists all available generators')
.action(function () {
		console.log('available generators');
		files = generator.list_templates();
		files.forEach(function (file) {
			console.log(file);
		});
}
)

commander
.command('all').description('Generates all available generators and views')
.action(function () {
		files = generator.list_templates();
		files.filter(function (file) {
		  return file != 'views';
		}).forEach(function (file) {
			generator.generate_template(file);
		});
    generator.generate_views();
}
)

commander.command('views').description('Generates the views based on the model')
.action(function () {
  generator.generate_views();
})


commander.parse(process.argv);


if (!process.argv.slice(2).length) {
   commander.outputHelp();
 }
