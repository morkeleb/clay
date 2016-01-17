var fs = require('fs');
var util = require('util');
var files = require('./file-system');
var path = require('path');
var handlebars = require('./template-engine');


var models_path = '';
var generators_path = 'generators';
var views_path = '';

var defaults = files.load_default();

if(defaults.models_path) {
	models_path = defaults.models_path;
}
if(defaults.generators_path) {
generators_path = defaults.generators_path;
}
if(defaults.views_path) {
	views_path = defaults.views_path;
}


function loadTypeData() {

		return files.read_yaml_file(path.join(models_path, 'models.yaml'), 'utf8');
		//console.log(util.inspect(doc, {depth:null}));
}

function loadViews() {
		var views = files.read_yaml_file(path.join(views_path,'views.yaml'), 'utf8');
		//console.log(util.inspect(views, {depth:null}));
		return views;
}

function load_index(type) {
	var index = files.read_yaml_file(path.join(generators_path, type+'/index.yaml'));
	var doc = loadTypeData();
	index.execute = function () {
		if(index.AllTypes && index.AllTypes.length > 0){
			index.AllTypes.forEach(function (generator_data) {
				var template = handlebars.compile(fs.readFileSync(path.join(generators_path, type+'/'+generator_data.template), 'utf8'));
				var file_loc = handlebars.compile(generator_data.file);
				doc.Types.forEach(function (type) {
					var file = file_loc(type);
					files.write(file, template(type));
				});
			});
		}

		if(index.AllCommands && index.AllCommands.length > 0){
			index.AllCommands.forEach(function (generator_data) {
				var template = handlebars.compile(fs.readFileSync(path.join(generators_path, type+'/'+generator_data.template), 'utf8'));
				var file_loc = handlebars.compile(generator_data.file);
				doc.Types.forEach(function (type) {
					type.Commands.forEach(function (command) {
						command.type = type;
						var file = file_loc(command);
						files.write(file, template(command));
					});
				});
			});
		}

		if(index.WithTypes && index.WithTypes.length > 0){
			index.WithTypes.forEach(function (generator_data) {
				var template = handlebars.compile(fs.readFileSync(path.join(generators_path, type+'/'+generator_data.template), 'utf8'));
				var file_loc = handlebars.compile(generator_data.file);
				var file = file_loc(doc);
				files.write(file, template(doc));
			});
		}

	}
	return index;
}


function generate_type(type) {
	console.log('Generating %s', type);
	var index = load_index(type);
	index.execute();
}

function list_templates() {
	if(!fs.existsSync(generators_path)){
		console.log('Cannot find generators folder: ' + generators_path);
		process.exit();
	}
	var files = fs.readdirSync(generators_path);
	return files;
}


function generate_views() {
	var types = loadTypeData();
	var views = loadViews();
	console.log('Generating views');

	views.views.forEach(function (view) {
		var index = files.read_yaml_file(path.join(generators_path, 'views', view.layout+'/index.yaml'));

		view.type = types.Types.filter(function (type) {
			return type.name == view.type;
		})[0];

		index.views.forEach(function (view_template) {
			var template = handlebars.compile(fs.readFileSync(path.join(generators_path, 'views',view.layout+'/'+view_template.template), 'utf8'));
			var file_loc = handlebars.compile(view_template.file);
			var file = file_loc(view);
			files.write(file, template(view));
		});

	});

}

function set_models_path(path) {
	console.log('models set:'+path);
	models_path = path;
}

function set_views_path(path) {
	console.log('views set:'+path);
	views_path = path;
}

function set_generators_path(path) {
	console.log('templates set:'+path);
	generators_path = path;
}

module.exports = {
	list_templates: list_templates,
	generate_template: generate_type,
	generate_views: generate_views,
	set_models_path: set_models_path,
	set_views_path: set_views_path,
	set_generators_path: set_generators_path
}
