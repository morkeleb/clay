var fs = require('fs');
var path = require('path');
var handlebars = require('./template-engine');
var jp = require('jsonpath');
const { execSync } = require('child_process');


var revert = false;

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
			if(revert){
				files.del(file);
			} else {
				files.write(file, template(data));
			}
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
			if(revert){
				files.del(file);
			} else {
				files.write(file, template(view));
			}
		});

	});

}

function ensure_directory(p) {
	var parts = p.split(path.sep);
	if(parts.length !== 1) {
		parts.pop();
		ensure_directory(parts.join(path.sep));
	}
	if (!fs.existsSync(p) && p !== ''){
    	fs.mkdirSync(p);
	}
}

function write(file, data) {
	var dir = path.dirname(file);
	ensure_directory(dir);
	console.log('writing: '+file);
	fs.writeFileSync(file, data, 'utf8');
}

function select(model, jsonpath) {
	return jp.query(model, jsonpath);
}

function generate_directory(model_partial, directory, output) {
	const templates = fs.readdirSync(directory);

	templates.forEach(file => {
		var template = handlebars.compile(fs.readFileSync(path.join(directory,file), 'utf8'));
		var file_name = handlebars.compile(file)	
		model_partial.forEach((m)=>{
			write(path.join(output, file_name(m)), template(m));
		})

	});
}

function decorate_generator(g, p) {
	g.generate = (model, output) => {
		const dirname = path.dirname(p);
		handlebars.load_partials(g.partials, dirname);
		for (let index = 0; index < g.steps.length; index++) {
			const element = g.steps[index];
			if(element.generate !== undefined){
				generate_directory(select(model, element.select), path.join(dirname, element.generate), output)
			}
			else if (element.runCommand !== undefined){
				//todo: run command
				const output_dir = path.resolve(output)
				ensure_directory(output_dir)
				if(element.select == undefined) {
					execSync(element.runCommand, {cwd: output_dir})	
				} else {
					var command = handlebars.compile(element.runCommand)
					select(model, element.select).forEach((m)=>{
						execSync(command(m), {cwd: output_dir})
					})
				}
				
			}
		}

	}
	return g;
}

module.exports = {
	list_templates: list_templates,
	generate_template: generate_type,
	generate_views: generate_views,
	set revert(bool) {
		revert = bool;
		if(revert){
			console.log("reverting all write operations");
		}
	},
	load: (path)=>{
		var generator = JSON.parse(fs.readFileSync(path, 'utf8'));
		
		return decorate_generator(generator, path);
	}
}
