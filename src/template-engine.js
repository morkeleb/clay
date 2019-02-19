var marked = require('marked');
var handlebars = require('handlebars');

var fs = require('fs');
var path_module = require('path');

var groupBy = require('handlebars-group-by');

groupBy.register(handlebars);

function registerPartial(file) {
	var name = path_module.basename(file).split('.')[0];
	handlebars.registerPartial(name, fs.readFileSync(file, 'utf8'));
}

handlebars.load_partials = function (templates, directory) {
	templates.forEach(function (template) {
		var name = path_module.basename(template).split('.')[0];
		handlebars.registerPartial(name, fs.readFileSync(path_module.join(directory, template), 'utf8'));
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
