"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const marked_1 = require("marked");
const handlebars_1 = __importDefault(require("handlebars"));
const jsonpath_1 = __importDefault(require("jsonpath"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const handlebars_group_by_1 = __importDefault(require("handlebars-group-by"));
const lobars_1 = __importDefault(require("lobars"));
const lodash_1 = __importDefault(require("lodash"));
const lodash_inflection_1 = __importDefault(require("lodash-inflection"));
lodash_1.default.mixin(lodash_inflection_1.default);
const handlebars = handlebars_1.default;
handlebars.registerHelper(lobars_1.default);
handlebars_group_by_1.default.register(handlebars);
handlebars.load_partials = function (templates, directory) {
    templates.forEach(function (template) {
        const name = path_1.default.basename(template).split('.')[0];
        handlebars.registerPartial(name, fs_1.default.readFileSync(path_1.default.join(directory, template), 'utf8'));
    });
};
handlebars.registerHelper('markdown', function (value) {
    if (value) {
        return new handlebars_1.default.SafeString((0, marked_1.marked)(value));
    }
    else {
        return '';
    }
});
handlebars.registerHelper('propertyExists', function (context, field) {
    function getField(obj, fieldPath) {
        return fieldPath.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
    return !!Object.values(context).some((item) => getField(item, field) !== undefined);
});
handlebars.registerHelper('json', function (context) {
    function censor(censorObj) {
        let i = 0;
        return function (_key, value) {
            if (i !== 0 &&
                typeof censorObj === 'object' &&
                typeof value === 'object' &&
                censorObj === value)
                return '[Circular]';
            if (i >= 29)
                return '[Unknown]';
            ++i;
            return value;
        };
    }
    return JSON.stringify(context, censor(context), 2);
});
handlebars.registerHelper('pascalCase', function (value) {
    if (value) {
        return lodash_1.default
            .chain(value)
            .camelCase()
            .startCase()
            .replace(/\s/g, '')
            .value();
    }
    else {
        return '';
    }
});
handlebars.registerHelper('inc', function (value) {
    return parseInt(String(value)) + 1;
});
handlebars.registerHelper('pluralize', function (value) {
    return lodash_1.default.pluralize(value);
});
handlebars.registerHelper('singularize', function (value) {
    return lodash_1.default.singularize(value);
});
handlebars.__switch_stack__ = [];
handlebars.registerHelper('switch', function (value, options) {
    handlebars.__switch_stack__.push({
        switch_match: false,
        switch_value: value,
    });
    const html = options.fn(this);
    handlebars.__switch_stack__.pop();
    return html;
});
handlebars.registerHelper('times', function (n, block) {
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
});
handlebars.registerHelper('case', function (...args) {
    const options = args.pop();
    const caseValues = args;
    const stack = handlebars.__switch_stack__[handlebars.__switch_stack__.length - 1];
    if (stack.switch_match || caseValues.indexOf(stack.switch_value) === -1) {
        return '';
    }
    else {
        stack.switch_match = true;
        return options.fn(this);
    }
});
handlebars.registerHelper('default', function (options) {
    const stack = handlebars.__switch_stack__[handlebars.__switch_stack__.length - 1];
    if (!stack.switch_match) {
        return options.fn(this);
    }
    return '';
});
handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
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
});
handlebars.registerHelper({
    eq: (v1, v2) => v1 === v2,
    ne: (v1, v2) => v1 !== v2,
    lt: (v1, v2) => v1 < v2,
    gt: (v1, v2) => v1 > v2,
    lte: (v1, v2) => v1 <= v2,
    gte: (v1, v2) => v1 >= v2,
    and(...args) {
        return Array.prototype.every.call(args, Boolean);
    },
    or(...args) {
        return Array.prototype.slice.call(args, 0, -1).some(Boolean);
    },
});
handlebars.registerHelper('eachUnique', function (array, options, context) {
    let iterator = array;
    if (lodash_1.default.isObject(array) && !Array.isArray(array)) {
        iterator = Object.entries(array).map(([key, value]) => ({
            ...value,
            '@key': key,
        }));
    }
    const uniqueArray = arguments.length === 3
        ? lodash_1.default.uniqBy(iterator, (x) => x[options])
        : lodash_1.default.uniq(iterator);
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
    return buffer;
});
handlebars.registerHelper('eachUniqueJSONPath', function (modelToSelectFrom, options, context) {
    if (arguments.length !== 3) {
        throw new Error('eachUniqueJSONPath helper needs to have 3 arguments.');
    }
    const JSONPath = options;
    const jsonPathValues = jsonpath_1.default
        .nodes(modelToSelectFrom, JSONPath)
        .filter((x) => x);
    const uniqueArray = lodash_1.default.uniqBy(jsonPathValues, (x) => lodash_1.default.last(x.path));
    let buffer = '';
    for (let i = 0; i < uniqueArray.length; i++) {
        const entry = uniqueArray[i].value;
        buffer += (context || options).fn(entry, {
            data: {
                index: i,
                first: i === 0,
                last: i === uniqueArray.length - 1,
                key: lodash_1.default.last(uniqueArray[i].path),
            },
        });
    }
    return buffer;
});
handlebars.registerHelper('splitAndUseWord', function (inputString, splitWord, indexToUse) {
    return inputString.split(splitWord)[indexToUse];
});
exports.default = handlebars;
//# sourceMappingURL=template-engine.js.map