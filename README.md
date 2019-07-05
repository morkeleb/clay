

> The original Greek word "model" means "misshapen ball of clay", and I try to think about that every time I go in front of the camera. - Derek Zoolander

# What is Clay

Clay is a template focused code generator. Used to take a model represented in JSON and konvert it to actual code matching the model through a set of generators using handlebar templates, shell commands and file operations.

The goal is to have a consistent implementation of all model related operations in a system. Similar to how Ruby On Rails scaffolds work but backed using files, so you can with confident change the model and have all files updated.

## Talks

* [A short concept overview in Swedish @ Agila sverige 2019](https://agilasverige.solidtango.com/video/varfor-skriver-vi-repetativ-kod-for-hand)

# Usage


## Installation

I use clay as a globally installed commandline tool.

```
>  npm install -g clay
```

Running `clay` will display its available commands.

```
> clay

Usage: clay [options] [command]

Options:
  -V, --version                        output the version number
  -v, --verbose                        ignore test hook
  -h, --help                           output usage information

Commands:
  clean <model_path> <output_path>     cleans up the output of the generators
  generate <model_path> <output_path>  runs the generators
  watch <model_path> <output_path>     runs the generators on filechanges in the models directory
```

## Generate

The first command to know in clay is the `generate` command.

```
> clay generate <model_path> <output_path>
```

It takes the model to generate as the first input and the second input is where the model should
be generated too.

## Clean

The `clean` command will clear up all generated code based on the generators specified in the
model.

It will not undo any commandline executions that has ben run by a generator.

```
> clay clean <model_path> <output_path>
```


## Watch

If you start using clay extensivly you will notice that you want to rerun clay as soon as you make
changes to the model or any of the custom generators you might be using.

For this there is a built in watch command that follows the same structure as the generate command.

```
> clay  <model_path> <output_path>
```

Using this will make clay listen for changes under the directory specified in the model.

### Recommended directory layout for the model and custom generators

We have a directory called clay where we keep our model and our custom generators.
```
.
├── dataaccess
│   ├── generator.json
│   └── template
│       └── db.js
├── frontend
│   ├── components
│   │   ├── {{pascalCase\ name}}Components.js
│   ├── generator.json
│   ├── partials
│   │   └── form-fields.js
│   └── reducers
│       └── {{kebabCase\ name}}.reducer.js
├── mixins
│   └── default_actions.mixin.js
└── model.json
```

This makes it simple to run clay watch on the "clay directory" and work continously on the
generators and the model.


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
	var {{lowerCase type.name}} = repository.find('{{type.name}}', id);

	if({{lowerCase type.name}}){
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

#### lobars

lobars and lodash string manipulation as helpers to the handlebar templating system.


```
var command = function (user, {{ parameters }}) {
	var {{lowerCase type.name}} = repository.find('{{type.name}}', id);

	if({{lowerCase type.name}}){
		eventsource.raise('{{raises}}', l[user, {{parameters}}]);
	}
}
```

### Changes

- [X] support casing help in helpers
- [X] inc one helper for indexes plus 1
- [X] use chalk to make pretty output... pretty output is... pretty
- [X] update generator and allow loading of node modules as generators
- [X] built in watch support
- [X] add usage instructions to readme
- [X] clean up command that will remove files instead of writing them

### Future

- [ ] validations on models and generators
- [ ] add an option to make dry runs
- [ ] tests on handlebar templating system to prevent regressions and broken generators
- [ ] option to clear directories

