var marked = require('marked');
var handlebars = require('handlebars');

var fs = require('fs');
var path_module = require('path');

function registerPartial(file) {
	var name = path_module.basename(file).split('.')[0];
	handlebars.registerPartial(name, fs.readFileSync(file, 'utf8'));
}

//TODO: Fix the generator paths here
//TODO: Fix view partials
if(fs.existsSync('generators')){
	var templates = fs.readdirSync('generators');
	templates.forEach(function (template) {
		var partials = 'generators/'+template+'/partials';
		if(fs.existsSync(partials)){
			fs.readdirSync(partials)
			.map(function (f) {
				return partials+'/'+f;
			})
			.forEach(registerPartial);
		}
	});
}

handlebars.registerHelper('toLowerCase', function(value) {
    if(value) {
        return new handlebars.SafeString(value.toLowerCase());
    } else {
        return '';
    }
});

handlebars.registerHelper('markdown', function(value) {
		if(value) {
				return new handlebars.SafeString(marked(value));
		} else {
				return '';
		}
});

module.exports = handlebars;
