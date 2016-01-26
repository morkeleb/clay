var fs = require('fs');
var util = require('util');
var files = require('./file-system');
var path = require('path');
var handlebars = require('./template-engine');



function loadTypeData() {

		return files.read_yaml_file(path.join(files.models_path, 'models.yaml'), 'utf8');
		//console.log(util.inspect(doc, {depth:null}));
}

function loadViews() {
		var views = files.read_yaml_file(path.join(files.views_path,'views.yaml'), 'utf8');
		//console.log(util.inspect(views, {depth:null}));
		return views;
}

function template(generator_data, type) {
	var template = handlebars.compile(fs.readFileSync(path.join(files.generators_path, type+'/'+generator_data.template), 'utf8'));
	var file_loc = handlebars.compile(generator_data.file);

	return {
		write: function (data) {
			var file = file_loc(data);
			files.write(file, template(data));
		}
	}
}

function load_index(type) {
	var index = files.read_yaml_file(path.join(files.generators_path, type+'/index.yaml'));
	var doc = loadTypeData();
	handlebars.load_partials();
	index.execute = function () {
		if(index.AllTypes && index.AllTypes.length > 0){
			index.AllTypes.forEach(function (generator_data) {
				var t = template(generator_data, type);
				doc.Types.forEach(function (type) {
					t.write(type);
				});
			});
		}

		if(index.AllCommands && index.AllCommands.length > 0){
			index.AllCommands.forEach(function (generator_data) {
				var t = template(generator_data, type);
				doc.Types.forEach(function (type) {
					type.Commands.forEach(function (command) {
						command.type = type;
						t.write(command);
					});
				});
			});
		}

		if(index.WithTypes && index.WithTypes.length > 0){
			index.WithTypes.forEach(function (generator_data) {
				var t = template(generator_data, type);
				t.write(doc);
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
	if(!fs.existsSync(files.generators_path)){
		console.log('Cannot find generators folder: ' + files.generators_path);
		process.exit();
	}
	var list = fs.readdirSync(files.generators_path);
	return list;
}


function generate_views() {
	var types = loadTypeData();
	var views = loadViews();
	handlebars.load_partials();
	console.log('Generating views');

	views.views.forEach(function (view) {
		var index = files.read_yaml_file(path.join(files.generators_path, 'views', view.layout+'/index.yaml'));

		view.type = types.Types.filter(function (type) {
			return type.name == view.type;
		})[0];

		index.views.forEach(function (view_template) {
			var template = handlebars.compile(fs.readFileSync(path.join(files.generators_path, 'views',view.layout+'/'+view_template.template), 'utf8'));
			var file_loc = handlebars.compile(view_template.file);
			var file = file_loc(view);
			files.write(file, template(view));
		});

	});

}


module.exports = {
	list_templates: list_templates,
	generate_template: generate_type,
	generate_views: generate_views
}
