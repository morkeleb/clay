import { marked } from 'marked';
import Handlebars from 'handlebars';
import jp from 'jsonpath';
import fs from 'fs';
import path from 'path';
import groupBy from 'handlebars-group-by';
import lobars from 'lobars';
import lodash from 'lodash';
import lodashInflection from 'lodash-inflection';

// Extend lodash with inflection methods
lodash.mixin(lodashInflection);

// Create a type-safe reference to Handlebars with our custom extensions
const handlebars = Handlebars as typeof Handlebars & {
  __switch_stack__: Array<{ switch_match: boolean; switch_value: any }>;
  load_partials: (templates: string[], directory: string) => void;
};

// Register lobars helpers (provides lodash functions as Handlebars helpers)
handlebars.registerHelper(lobars);

// Register group-by helper
groupBy.register(handlebars);

/**
 * Load partial templates from a directory
 */
handlebars.load_partials = function (
  templates: string[],
  directory: string
): void {
  templates.forEach(function (template) {
    const name = path.basename(template).split('.')[0];
    handlebars.registerPartial(
      name,
      fs.readFileSync(path.join(directory, template), 'utf8')
    );
  });
};

/**
 * Markdown helper - converts markdown to HTML
 */
handlebars.registerHelper('markdown', function (value: string) {
  if (value) {
    return new Handlebars.SafeString(marked(value) as string);
  } else {
    return '';
  }
});

/**
 * Property exists helper - checks if a property exists in any object in context
 */
handlebars.registerHelper(
  'propertyExists',
  function (context: any, field: string) {
    function getField(obj: any, fieldPath: string): any {
      return fieldPath.split('.').reduce((acc, part) => acc && acc[part], obj);
    }

    return !!Object.values(context).some(
      (item) => getField(item, field) !== undefined
    );
  }
);

/**
 * JSON helper - pretty-prints an object as JSON
 */
handlebars.registerHelper('json', function (context: any) {
  function censor(censorObj: any) {
    let i = 0;

    return function (_key: string, value: any) {
      if (
        i !== 0 &&
        typeof censorObj === 'object' &&
        typeof value === 'object' &&
        censorObj === value
      )
        return '[Circular]';

      if (i >= 29)
        // seems to be a hardcoded maximum of 30 serialized objects?
        return '[Unknown]';

      ++i; // so we know we aren't using the original object anymore

      return value;
    };
  }
  return JSON.stringify(context, censor(context), 2);
});

/**
 * PascalCase helper - converts string to PascalCase
 */
handlebars.registerHelper('pascalCase', function (value: string) {
  if (value) {
    return lodash
      .chain(value)
      .camelCase()
      .startCase()
      .replace(/\s/g, '')
      .value();
  } else {
    return '';
  }
});

/**
 * Inc helper - increments a number by 1
 */
handlebars.registerHelper('inc', function (value: number) {
  return parseInt(String(value)) + 1;
});

/**
 * Pluralize helper
 */
handlebars.registerHelper('pluralize', function (value: string) {
  return (lodash as any).pluralize(value);
});

/**
 * Singularize helper
 */
handlebars.registerHelper('singularize', function (value: string) {
  return (lodash as any).singularize(value);
});

// Initialize switch stack
handlebars.__switch_stack__ = [];

/**
 * Switch helper - implements switch/case logic
 */
handlebars.registerHelper(
  'switch',
  function (this: any, value: any, options: Handlebars.HelperOptions) {
    handlebars.__switch_stack__.push({
      switch_match: false,
      switch_value: value,
    });
    const html = options.fn(this);
    handlebars.__switch_stack__.pop();
    return html;
  }
);

/**
 * Times helper - repeats a block N times
 */
handlebars.registerHelper(
  'times',
  function (this: any, n: number, block: Handlebars.HelperOptions) {
    let accum = '';
    for (let i = 0; i < n; ++i) {
      if (block.data) {
        block.data.index = i;
        block.data.first = i === 0;
        block.data.last = i === n - 1;
      }
      accum += block.fn(this);
    }
    return accum;
  }
);

/**
 * Case helper - used within switch
 */
handlebars.registerHelper('case', function (this: any, ...args: any[]) {
  const options = args.pop() as Handlebars.HelperOptions;
  const caseValues = args;
  const stack =
    handlebars.__switch_stack__[handlebars.__switch_stack__.length - 1];

  if (stack.switch_match || caseValues.indexOf(stack.switch_value) === -1) {
    return '';
  } else {
    stack.switch_match = true;
    return options.fn(this);
  }
});

/**
 * Default helper - used within switch
 */
handlebars.registerHelper(
  'default',
  function (this: any, options: Handlebars.HelperOptions) {
    const stack =
      handlebars.__switch_stack__[handlebars.__switch_stack__.length - 1];
    if (!stack.switch_match) {
      return options.fn(this);
    }
    return '';
  }
);

/**
 * IfCond helper - conditional with operators
 */
handlebars.registerHelper(
  'ifCond',
  function (
    this: any,
    v1: any,
    operator: string,
    v2: any,
    options: Handlebars.HelperOptions
  ) {
    switch (operator) {
      case '==':
        return v1 == v2 ? options.fn(this) : options.inverse(this);
      case '===':
        return v1 === v2 ? options.fn(this) : options.inverse(this);
      case '!=':
        return v1 != v2 ? options.fn(this) : options.inverse(this);
      case '!==':
        return v1 !== v2 ? options.fn(this) : options.inverse(this);
      case '<':
        return v1 < v2 ? options.fn(this) : options.inverse(this);
      case '<=':
        return v1 <= v2 ? options.fn(this) : options.inverse(this);
      case '>':
        return v1 > v2 ? options.fn(this) : options.inverse(this);
      case '>=':
        return v1 >= v2 ? options.fn(this) : options.inverse(this);
      case '&&':
        return v1 && v2 ? options.fn(this) : options.inverse(this);
      case '||':
        return v1 || v2 ? options.fn(this) : options.inverse(this);
      default:
        return options.inverse(this);
    }
  }
);

/**
 * Comparison helpers
 */
handlebars.registerHelper({
  eq: (v1: any, v2: any) => v1 === v2,
  ne: (v1: any, v2: any) => v1 !== v2,
  lt: (v1: any, v2: any) => v1 < v2,
  gt: (v1: any, v2: any) => v1 > v2,
  lte: (v1: any, v2: any) => v1 <= v2,
  gte: (v1: any, v2: any) => v1 >= v2,
  and(...args: any[]) {
    return Array.prototype.every.call(args, Boolean);
  },
  or(...args: any[]) {
    return Array.prototype.slice.call(args, 0, -1).some(Boolean);
  },
});

/**
 * EachUnique helper - iterates over unique values
 */
handlebars.registerHelper(
  'eachUnique',
  function (this: any, array: any, options: any, context?: any) {
    let iterator = array;
    if (lodash.isObject(array) && !Array.isArray(array)) {
      iterator = Object.entries(array).map(([key, value]) => ({
        ...(value as object),
        '@key': key,
      }));
    }

    const uniqueArray =
      arguments.length === 3
        ? lodash.uniqBy(iterator, (x: any) => x[options])
        : lodash.uniq(iterator);

    // template buffer
    let buffer = '';
    for (let i = 0; i < uniqueArray.length; i++) {
      const entry = uniqueArray[i];
      buffer += (context || options).fn(entry, {
        data: {
          index: i,
          first: i === 0,
          last: i === uniqueArray.length - 1,
          key: entry['@key'],
        },
      });
    }
    // return the compiled template
    return buffer;
  }
);

/**
 * EachUniqueJSONPath helper - iterates over unique values from JSONPath
 */
handlebars.registerHelper(
  'eachUniqueJSONPath',
  function (this: any, modelToSelectFrom: any, options: any, context: any) {
    if (arguments.length !== 3) {
      throw new Error('eachUniqueJSONPath helper needs to have 3 arguments.');
    }
    const JSONPath = options;
    const jsonPathValues = jp
      .nodes(modelToSelectFrom, JSONPath)
      .filter((x: any) => x);
    const uniqueArray = lodash.uniqBy(jsonPathValues, (x: any) =>
      lodash.last(x.path)
    );

    // template buffer
    let buffer = '';
    for (let i = 0; i < uniqueArray.length; i++) {
      const entry = uniqueArray[i].value;
      buffer += (context || options).fn(entry, {
        data: {
          index: i,
          first: i === 0,
          last: i === uniqueArray.length - 1,
          key: lodash.last(uniqueArray[i].path),
        },
      });
    }
    // return the compiled template
    return buffer;
  }
);

/**
 * SplitAndUseWord helper - splits a string and returns word at index
 */
handlebars.registerHelper(
  'splitAndUseWord',
  function (inputString: string, splitWord: string, indexToUse: number) {
    return inputString.split(splitWord)[indexToUse];
  }
);

export default handlebars;
