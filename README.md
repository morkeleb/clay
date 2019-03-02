

> The original Greek word "model" means "misshapen ball of clay", and I try to think about that every time I go in front of the camera. - Derek Zoolander


# Domain model

Clay takes a structured specification of a domain model and generates code based on the domain model and a given set of generators.

Clay tries to stay clear of exactly how the domain model i structured, but in order to successfully generate from the model there needs to be some structure.

The model can have includes to split it up into several files.

There is also something called mixins that allow you to make modifications to models
using simple js functions. These are usefull for convention based model properties.

The model holds a list of generators to be run for this specific model.

# Generators

Generators holds a list of steps to run.
Steps can do one of the following:
1. Generate a set of files using a handlebar template and the model
2. Run commands using the model and handlebar to modify executed commands
3. Copy existing files

the order of execution is defined in the generator

# Files


## Models

Clays models are described in a file called models.json.

The structure for describing a model in clay is as follows:

* A model contains:

* a list of generators.
* a name
* a list of mixins
* the model as a json structure

`mixin` and `include` are reserved properties on a clay model.
`mixin` is a list of functions to execute on a part of the model
`include` will replace the current part of the model with the content if a
specified file.

Example of a models.json file:
```
{
  name: 'mymodel'
  generators: [
    'documentation',
    'backend.json'
  ]
  mixins: [
    'has_created.js',
    'has_error.js'
  ]
  model: {
    events: [
      {include: 'standardevents.json'}
    ],
    types:[
      {
        name: 'order',
        mixin: [has_created, has_errors],
        commands: [
          {
            name: 'finish_order',
            raise: 'order_finished',
            parameters: [
              {
                name: 'finished'
              }
            ]
          }
        ],
        fields: [
          {
            name: 'test'
          }
        ]

      }
    ]
  }
}

```

## Generators

Generators describe a sequence of steps that will be taken with the model
as input.

a generator contains:
* a list of steps
* a list of partials

The partials are handlebar partials that can be used in the templates within
the generator. These are usefull for header and footer like operations.

The steps describe what the generator does and in which order.
Steps can be one of:
* Copy
* generate handlebar template
* run a command

They all use jsonpath to filter out what part of the model that is interesting
for a particular step.

Example:
```
{
  "partials":[],
  "steps":[
    {
      "runCommand": "yo newservice"
    },
    {
      "generate": "templates/html",
      "select": "jsonpath statement"
    },
    {
      "runCommand": "yo servicepart {{service.name}}",
      "select": "jsonpath statement"
    },
    {
      "copy": "foundation",
      "select": "jsonpath statement",
      "target": "{{microservice}}"
    }
  ]
}
```

### Templates

Clay uses the handlebars template engine to generate a files.

The paths are also handlebar template, allowing you to use values from the model or view data to write the file to the correct location.

Example of a template:

```
var command = function (user, {{ parameters }}) {
	var {{toLowerCase type.name}} = repository.find('{{type.name}}', id);

	if({{toLowerCase type.name}}){
		eventsource.raise('{{raises}}', [user, {{parameters}}]);
	}
}
```

### Partials

It's tedious to rewrite parts of code even in template files. To help with that clay
include all partials listed in a generator.

in the domain-documentation.html template I use the header partial as shown:

```
{{>header }}
		<h1>{{name}}</h1>
```

### Template helpers

#### markdown

The markdown helper method shown in the following example.
```
<p>
  {{markdown description}}
</p>
```

#### toLowerCase

Sometimes it makes sense to write fields and names with capitalized first letters. But when generating code for these names we need a lower case representation of the name.

```
var command = function (user, {{ parameters }}) {
	var {{toLowerCase type.name}} = repository.find('{{type.name}}', id);

	if({{toLowerCase type.name}}){
		eventsource.raise('{{raises}}', l[user, {{parameters}}]);
	}
}
```

### Changes

- [X] support casing help in helpers
- [X] inc one helper for indexes plus 1
- [X] use chalk to make pretty output... pretty output is... pretty
- [X] update generator and allow loading of node modules as generators	

### Future

- [ ] validations on models and generators
- [ ] add usage instructions to readme
- [ ] add an option to make dry runs
