var fs = require('fs');
var path_module = require('path');
var yaml = require('js-yaml');

var models_path = '';
var generators_path = 'generators';
var views_path = '';

function ensure_directory(path) {
	var parts = path.split(path_module.sep);
	if(parts.length !== 1) {
		parts.pop();
		ensure_directory(parts.join(path_module.sep));
	}
	if (!fs.existsSync(path)){
    fs.mkdirSync(path);
	}
}

function write(file, data) {
	var dir = path_module.dirname(file);
	ensure_directory(dir);
	console.log('writing: '+file);
	fs.writeFileSync(file, data, 'utf8');
}

function read_yaml_file(file) {
	try {
		var doc = yaml.safeLoad(fs.readFileSync(file, 'utf8'));
		//console.log(util.inspect(doc, {depth:null}));
		return doc;
	} catch(e){
		throw 'failed to load yaml from '+file+', are there tabs in the file?'
	}
}
function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function load_default() {
	if(fs.existsSync('.clay-defaults.yaml')){
		return read_yaml_file('.clay-defaults.yaml');
	}
	var defaults = path_module.join(getUserHome(), '.clay-defaults.yaml');
	if(fs.existsSync(defaults)) {
		return read_yaml_file(defaults)
	}
	return {};
}


var defaults = load_default();

if(defaults.models_path) {
	models_path = defaults.models_path;
}
if(defaults.generators_path) {
	generators_path = defaults.generators_path;
}
if(defaults.views_path) {
	views_path = defaults.views_path;
}

module.exports = {
	write: write,
	read_yaml_file: read_yaml_file,
	set models_path(path) {
		console.log('models set:'+path);
		models_path = path;
	},
	set views_path(path){
		console.log('views set:'+path);
		views_path = path;
	},
	set generators_path(path){
		console.log('generators set:'+path);
		generators_path = path;
	},
	get models_path(){
		return models_path;
	},
	get generators_path() {
		return generators_path;
	},
	get views_path(){
		return views_path;
	}
}
