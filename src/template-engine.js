var marked = require('marked');
var handlebars = require('handlebars');

var fs = require('fs');
var path_module = require('path');

var groupBy = require('handlebars-group-by');
const lobars = require('lobars');
const lodash = require('lodash');

handlebars.registerHelper(lobars)

groupBy.register(handlebars);

handlebars.load_partials = function (templates, directory) {
  templates.forEach(function (template) {
    var name = path_module.basename(template).split('.')[0];
    handlebars.registerPartial(name, fs.readFileSync(path_module.join(directory, template), 'utf8'));
  });
}

handlebars.registerHelper('markdown', function(value) {
  if(value) {
    return new handlebars.SafeString(marked(value));
  } else {
    return '';
  }
});

handlebars.registerHelper('pascalCase', function(value) {
  if(value) {
    return lodash.chain(value).camelCase().startCase().replace(/\s/g, '');
  } else {
    return '';
  }
});

handlebars.registerHelper("inc", function(value, options)
{
    return parseInt(value) + 1;
});

handlebars.__switch_stack__ = [];

handlebars.registerHelper( "switch", function( value, options ) {
    handlebars.__switch_stack__.push({
        switch_match : false,
        switch_value : value
    });
    var html = options.fn( this );
    handlebars.__switch_stack__.pop();
    return html;
} );
handlebars.registerHelper( "case", function( value, options ) {
    var args = Array.from( arguments );
    var options = args.pop();
    var caseValues = args;
    var stack = handlebars.__switch_stack__[handlebars.__switch_stack__.length - 1];
    
    if ( stack.switch_match || caseValues.indexOf( stack.switch_value ) === -1 ) {
        return '';
    } else {
        stack.switch_match = true;
        return options.fn( this );
    }
} );
handlebars.registerHelper( "default", function( options ) {
    var stack = handlebars.__switch_stack__[handlebars.__switch_stack__.length - 1];
    if ( !stack.switch_match ) {
        return options.fn( this );
    }
} );

handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {

  switch (operator) {
      case '==':
          return (v1 == v2) ? options.fn(this) : options.inverse(this);
      case '===':
          return (v1 === v2) ? options.fn(this) : options.inverse(this);
      case '!=':
          return (v1 != v2) ? options.fn(this) : options.inverse(this);
      case '!==':
          return (v1 !== v2) ? options.fn(this) : options.inverse(this);
      case '<':
          return (v1 < v2) ? options.fn(this) : options.inverse(this);
      case '<=':
          return (v1 <= v2) ? options.fn(this) : options.inverse(this);
      case '>':
          return (v1 > v2) ? options.fn(this) : options.inverse(this);
      case '>=':
          return (v1 >= v2) ? options.fn(this) : options.inverse(this);
      case '&&':
          return (v1 && v2) ? options.fn(this) : options.inverse(this);
      case '||':
          return (v1 || v2) ? options.fn(this) : options.inverse(this);
      default:
          return options.inverse(this);
  }
});

module.exports = handlebars;
