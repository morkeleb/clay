var fs = require('fs');
var path_module = require('path');
var yaml = require('js-yaml');

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
	var defaults = path_module.join(getUserHome(), '.clay-defaults.yaml');
	if(fs.existsSync(defaults)) {
		return read_yaml_file(defaults)
	}
	return {};
}

module.exports = {
	write: write,
	read_yaml_file: read_yaml_file,
	load_default: load_default
}
