

> The original Greek word "model" means "misshapen ball of clay", and I try to think about that every time I go in front of the camera. - Derek Zoolander


# Domain model

Clay takes a structured specification of a domain model and generates code based on the domain model and a given set of generators.

Generators use handlebar template files that are fed parts of the domain model to generate files based on the model.

Clay can also generate views. Since applications usually have a structure different from the domain model Clay takes a file describing views and joins it with the domain model to allow the generation of a structure for most of the views needed to make an application based on the domain model.

Clay tries to stay clear of exactly how the domain model i structured, but in order to successfully generate from the model there needs to be some structure.

# Files

Clay works of a structure of yaml files. These files are used to describe the domain model, views and the generators needed to implement these files.

## Models

Clays models are described in a file called models.yaml.

The structure for describing a model in clay is as follows:

* A model contains a list of types.
* Each type has a list of fields, events and commands.

Example of a models.yaml file:
```
- name: Order
    description: |
      ### testing markdown

      ---

      moose
    Fields:
        - name: Title
          description: Holds a summary of the order to be used in the
          type: string
        - name: State
          type: enum
          values: [waiting_assignment, assigned, started, paused, finished, aborted]
    Commands:
      - name: create_order
        parameters: [id]
        raises: order_created
      - name: set_title
        parameters: [type, id, title]
        raises: order_updated
    Events:
      - order_started: Occurs when someone starts work on the order
      - order_created: Occurs when the order is first registered
  - name: Assignment
    Fields:
      - name: Title
        type: string
      - name: User
        type: reference
        reference_type: user
    Commands:
      - name: set_title
        parameters: [id, title]
        raises: assignment_updated
    Events:
      - assignment_started:
```

## Views

Given such a model there is usually a wish to generate one or more views based on the domain model.

With clay views are listed in a yaml file called views.yaml.

- name that identifies a specific view
- layout which is used to generate the correct type of view
- [optional] a type which is used in the generators to fill out fields

Example of a views.yaml file
```
views:
  - name: start
    layout: landing
    actions:
      - name: new_order
        goto: new_order
      - name: find_order
        goto: find_order
  - name: new_order
    layout: form
    type: Order
    actions:
      - name: save
        goto: view_order
```


## Generators

Generators describe different parts of an application. A generator is a yaml file describing how to use the models and views to generate code based on a set of handlebar generators.

A generator thus has the following structure inside the generators folder
```
/generators/commands/
                    index.yaml
                    command.js
                    command_spec.js
```


A special folder inside the generators folder is the views folder. It works in the same fashion as the normal generators but holds layouts for the views to generate.


### index.yaml

The index.yaml file of a generator describes how each handlebar template will be used to generate a specific set of files, and what that template will be fed from the model.

Example generator/index.yaml:
```
AllCommands:
  - template: 'command.js'
    file: 'app/commands/{{name}}.js'
  - template: 'command_spec.js'
    file: 'spec/commands/{{name}}_spec.js'
```

Clay will look for the following lists in a generator yaml file:

* **AllCommands**

  The template structure will be looped over given all commands as a parameter. The command object will have a special `type` property from which information for the given type can be specified.

* **AllEvents**

  The template structure will be looped over given all events as a parameter. The command object will have a special `type` property from which information for the given type can be specified.

* **AllTypes**

  The template structure will be looped over given each type as a parameter.

* **WithTypes**

  This will not loop. Simply give access to the complete model document in the template.
  This is useful for creating for example a sitemap for a documentation or similar structures.


### Templates

Clay uses the handlebars template engine to generate a files. The index.yaml file points to a template that will generate a file moved to the location specified in the yaml file.

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

It's tedious to rewrite parts of code even in template files. To help with that clay will find all folders called `partials` in the generator folders.

Each file in a `partials` folder will be registered for the handlebar template engine using its filename as key and be available when working with the generators when generating. Thus partial filenames should be unique.

Example:
in the generators folder I have the following file structure
```
/generators/doc/
               partials/
                        header.html
               index.yaml
               domain-documentation.html
               index.html
```

in the domain-documentation.html template I use the header partial as shown:

```
{{>header }}
		<h1>{{name}}</h1>
```

The index.yaml file looks like the following and is used to generate a html documentation of the domain model.

```
AllTypes:
  - template: 'domain-documentation.hbs'
    file: 'doc/type/{{name}}.html'
WithTypes:
  - template: 'index.html'
    file: 'doc/index.html'
```

### Template helpers

#### markdown

The markdown helper method shown in the following example.
```
<p>
  {{markdown description}}
</p>
```

It can take any property from the models.yaml or views.yaml given to the template and render the markdown documentation as HTML.

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

# Default locations

Clay looks for a .clay-defaults.yaml file in your home folder.
This file can specify where to look for, generators, models and views.

```
models_path: /home/morten/src/path_to_my_generator_files
views_path: /home/morten/src/path_to_my_generator_files
generators_path: /home/morten/path_to_my_generator_files
```

it will look for the files with the convention based names.

If no .clay-defaults.yaml file is located Clay will look in the working directory for the files and the generators folder.

You can override the paths used from the commandline
```
Usage: clay [options] [command]


Commands:

  *       Generates the specifed generator
  list    Lists all available generators
  all     Generates all available generators and views
  views   Generates the views based on the model

Options:

  -h, --help                    output usage information
  -V, --version                 output the version number
  -m, --models_path [path]      the path to the model yaml file
  -v, --views_path [path]       the path to the views yaml file
  -g, --generators_path [path]  the path to the generators folder

```


### Gen 2 clay

1. Partial/mixnis inside the model
  ```
- name: Order
  mixin: has_created
  mixin: has_errorstate
  ```

  mixins are defined in the same yaml file?
  because they are inherent to the model
2. include inside the model
  parts that have already been described should be includable
  ```
    include: Order
  ``` 
2. generators should be able to
  1. Run commands
  2. clone repositories
  This enables the use of jhipster to create more complex solutions quickly

  This also means that a generator needs to have an order in which it does things
  
  Can AllTypes/WithTypes be expressed using a query language?
3. plugins should be using the module


use json instead of yaml. Yaml did not achieve the desired effect of making it
easier to work with models. An editor might be needed to work with models.



model.json
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

generator.json
```
[
  {
    runCommand: 'jhipster microservice'
  },
  {
    generate: 'templates/jdl-files',
    select: 'jsoniq statement'
   },
  {
    runCommand: 'jhipster import-jdl {{service.name}}',
    select: 'jsoniq statement'
  },
  {
    copyFoundation: 'git+morkeleb/foundation',
    select: 'jsoniq statement',
    target: '{{microservice}}'
  }
]

```

we need validation of models and queries using this approach
