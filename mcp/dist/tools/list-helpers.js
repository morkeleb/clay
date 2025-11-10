/**
 * MCP Tool: clay_list_helpers
 *
 * Lists all available Handlebars helpers that can be used in Clay templates.
 * This helps LLMs understand which helpers are available when creating or
 * modifying templates.
 */
import { ListHelpersInputSchema, } from '../shared/schemas.js';
/**
 * List all available Handlebars helpers with documentation
 */
export async function listHelpers(input) {
    const includeExamples = input.include_examples ?? false;
    const category = input.category;
    // Define all helpers with their categories, descriptions, and examples
    const allHelpers = [
        // Clay Built-in Helpers
        {
            name: 'markdown',
            category: 'formatting',
            description: 'Renders a string as HTML using Markdown',
            syntax: '{{markdown description}}',
            example: includeExamples
                ? '{{markdown "# Hello\n\nThis is **bold**"}}'
                : undefined,
        },
        {
            name: 'propertyExists',
            category: 'logic',
            description: 'Checks if a property exists in any object in a context',
            syntax: '{{#if (propertyExists this "fieldName")}}...{{/if}}',
            example: includeExamples
                ? '{{#if (propertyExists this "email")}}Has email{{/if}}'
                : undefined,
        },
        {
            name: 'json',
            category: 'formatting',
            description: 'Pretty-prints a JavaScript object as JSON',
            syntax: '{{{json this}}}',
            example: includeExamples ? '<pre>{{{json user}}}</pre>' : undefined,
        },
        {
            name: 'pascalCase',
            category: 'string',
            description: 'Converts a string to PascalCase',
            syntax: '{{pascalCase name}}',
            example: includeExamples
                ? '{{pascalCase "user name"}} → UserName'
                : undefined,
        },
        {
            name: 'inc',
            category: 'math',
            description: 'Increments a number by 1 (useful for 1-based indexes)',
            syntax: '{{inc @index}}',
            example: includeExamples
                ? '{{#each items}}{{inc @index}}. {{name}}{{/each}}'
                : undefined,
        },
        {
            name: 'pluralize',
            category: 'string',
            description: 'Pluralizes a word',
            syntax: '{{pluralize "category"}}',
            example: includeExamples
                ? '{{pluralize "category"}} → categories'
                : undefined,
        },
        {
            name: 'singularize',
            category: 'string',
            description: 'Singularizes a word',
            syntax: '{{singularize "categories"}}',
            example: includeExamples
                ? '{{singularize "categories"}} → category'
                : undefined,
        },
        {
            name: 'switch/case/default',
            category: 'logic',
            description: 'Implements switch/case/default logic',
            syntax: '{{#switch value}}{{#case "x"}}...{{/case}}{{#default}}...{{/default}}{{/switch}}',
            example: includeExamples
                ? '{{#switch type}}{{#case "admin"}}Admin{{/case}}{{#default}}User{{/default}}{{/switch}}'
                : undefined,
        },
        {
            name: 'times',
            category: 'iteration',
            description: 'Repeats a block N times',
            syntax: '{{#times 3}}...{{/times}}',
            example: includeExamples ? '{{#times 3}}*{{/times}} → ***' : undefined,
        },
        {
            name: 'ifCond',
            category: 'logic',
            description: 'Conditional logic with operators (==, ===, !=, !==, <, <=, >, >=, &&, ||)',
            syntax: '{{#ifCond a "==" b}}...{{else}}...{{/ifCond}}',
            example: includeExamples
                ? '{{#ifCond value ">" 10}}Large{{else}}Small{{/ifCond}}'
                : undefined,
        },
        {
            name: 'eq',
            category: 'comparison',
            description: 'Check if two values are equal',
            syntax: '{{#if (eq a b)}}...{{/if}}',
            example: includeExamples
                ? '{{#if (eq status "active")}}Active{{/if}}'
                : undefined,
        },
        {
            name: 'ne',
            category: 'comparison',
            description: 'Check if two values are not equal',
            syntax: '{{#if (ne a b)}}...{{/if}}',
            example: includeExamples
                ? '{{#if (ne type "admin")}}Not admin{{/if}}'
                : undefined,
        },
        {
            name: 'lt',
            category: 'comparison',
            description: 'Check if first value is less than second',
            syntax: '{{#if (lt a b)}}...{{/if}}',
            example: includeExamples ? '{{#if (lt age 18)}}Minor{{/if}}' : undefined,
        },
        {
            name: 'gt',
            category: 'comparison',
            description: 'Check if first value is greater than second',
            syntax: '{{#if (gt a b)}}...{{/if}}',
            example: includeExamples
                ? '{{#if (gt score 100)}}High score{{/if}}'
                : undefined,
        },
        {
            name: 'lte',
            category: 'comparison',
            description: 'Check if first value is less than or equal to second',
            syntax: '{{#if (lte a b)}}...{{/if}}',
            example: includeExamples
                ? '{{#if (lte count 0)}}Empty{{/if}}'
                : undefined,
        },
        {
            name: 'gte',
            category: 'comparison',
            description: 'Check if first value is greater than or equal to second',
            syntax: '{{#if (gte a b)}}...{{/if}}',
            example: includeExamples ? '{{#if (gte age 18)}}Adult{{/if}}' : undefined,
        },
        {
            name: 'and',
            category: 'logic',
            description: 'Check if all values are truthy',
            syntax: '{{#if (and a b c)}}...{{/if}}',
            example: includeExamples
                ? '{{#if (and isActive hasPermission)}}Allowed{{/if}}'
                : undefined,
        },
        {
            name: 'or',
            category: 'logic',
            description: 'Check if any value is truthy',
            syntax: '{{#if (or a b c)}}...{{/if}}',
            example: includeExamples
                ? '{{#if (or isAdmin isModerator)}}Privileged{{/if}}'
                : undefined,
        },
        {
            name: 'eachUnique',
            category: 'iteration',
            description: 'Iterates over unique values in an array or by a property',
            syntax: '{{#eachUnique items}}...{{/eachUnique}} or {{#eachUnique items "id"}}...{{/eachUnique}}',
            example: includeExamples
                ? '{{#eachUnique users "role"}}{{this.role}}{{/eachUnique}}'
                : undefined,
        },
        {
            name: 'eachUniqueJSONPath',
            category: 'iteration',
            description: 'Iterates over unique values selected by a JSONPath',
            syntax: '{{#eachUniqueJSONPath model "$.types[*].name"}}...{{/eachUniqueJSONPath}}',
            example: includeExamples
                ? '{{#eachUniqueJSONPath model "$.types[*].category"}}{{this}}{{/eachUniqueJSONPath}}'
                : undefined,
        },
        {
            name: 'splitAndUseWord',
            category: 'string',
            description: 'Splits a string and returns the word at the given index',
            syntax: '{{splitAndUseWord "foo-bar-baz" "-" 1}}',
            example: includeExamples
                ? '{{splitAndUseWord "user-profile-page" "-" 1}} → profile'
                : undefined,
        },
        {
            name: 'group',
            category: 'iteration',
            description: 'Groups items in an array by a specified property (supports nested properties with dot notation)',
            syntax: '{{#group items by="property"}}{{value}} - {{#each items}}...{{/each}}{{/group}}',
            example: includeExamples
                ? '{{#group posts by="category"}}Category: {{value}}{{#each items}}{{title}}{{/each}}{{/group}}'
                : undefined,
        },
        // Lobars (Lodash) String Helpers
        {
            name: 'camelCase',
            category: 'string',
            description: 'Converts a string to camelCase',
            syntax: '{{camelCase "hello world"}}',
            example: includeExamples
                ? '{{camelCase "user name"}} → userName'
                : undefined,
        },
        {
            name: 'capitalize',
            category: 'string',
            description: 'Capitalizes the first character of a string',
            syntax: '{{capitalize "hello world"}}',
            example: includeExamples
                ? '{{capitalize "hello world"}} → Hello world'
                : undefined,
        },
        {
            name: 'kebabCase',
            category: 'string',
            description: 'Converts a string to kebab-case',
            syntax: '{{kebabCase "Hello World"}}',
            example: includeExamples
                ? '{{kebabCase "User Profile"}} → user-profile'
                : undefined,
        },
        {
            name: 'snakeCase',
            category: 'string',
            description: 'Converts a string to snake_case',
            syntax: '{{snakeCase "Hello World"}}',
            example: includeExamples
                ? '{{snakeCase "User Name"}} → user_name'
                : undefined,
        },
        {
            name: 'lowerCase',
            category: 'string',
            description: 'Converts a string to lower case',
            syntax: '{{lowerCase "Hello World"}}',
            example: includeExamples ? '{{lowerCase "HELLO"}} → hello' : undefined,
        },
        {
            name: 'upperCase',
            category: 'string',
            description: 'Converts a string to upper case',
            syntax: '{{upperCase "Hello World"}}',
            example: includeExamples ? '{{upperCase "hello"}} → HELLO' : undefined,
        },
        {
            name: 'startCase',
            category: 'string',
            description: 'Converts a string to Start Case',
            syntax: '{{startCase "hello world"}}',
            example: includeExamples
                ? '{{startCase "user-name"}} → User Name'
                : undefined,
        },
        {
            name: 'pad',
            category: 'string',
            description: 'Pads a string to a given length',
            syntax: '{{pad "abc" 5}}',
            example: includeExamples ? '{{pad "abc" 5}} → " abc "' : undefined,
        },
        {
            name: 'padStart',
            category: 'string',
            description: 'Pads a string from the start',
            syntax: '{{padStart "abc" 5 "0"}}',
            example: includeExamples ? '{{padStart "5" 3 "0"}} → 005' : undefined,
        },
        {
            name: 'padEnd',
            category: 'string',
            description: 'Pads a string from the end',
            syntax: '{{padEnd "abc" 5 "0"}}',
            example: includeExamples ? '{{padEnd "5" 3 "0"}} → 500' : undefined,
        },
        {
            name: 'repeat',
            category: 'string',
            description: 'Repeats a string N times',
            syntax: '{{repeat "ab" 3}}',
            example: includeExamples ? '{{repeat "*" 5}} → *****' : undefined,
        },
        {
            name: 'replace',
            category: 'string',
            description: 'Replaces part of a string',
            syntax: '{{replace "foo bar" "bar" "baz"}}',
            example: includeExamples
                ? '{{replace "hello world" "world" "friend"}} → hello friend'
                : undefined,
        },
        {
            name: 'truncate',
            category: 'string',
            description: 'Truncates a string to a given length',
            syntax: '{{truncate "Hello World" 5}}',
            example: includeExamples
                ? '{{truncate "Hello World" 8}} → Hello...'
                : undefined,
        },
        {
            name: 'split',
            category: 'string',
            description: 'Splits a string into an array',
            syntax: '{{#each (split "a,b,c" ",")}}...{{/each}}',
            example: includeExamples
                ? '{{#each (split "foo,bar,baz" ",")}}{{this}}{{/each}}'
                : undefined,
        },
        {
            name: 'words',
            category: 'string',
            description: 'Splits a string into words',
            syntax: '{{#each (words "foo bar")}}...{{/each}}',
            example: includeExamples
                ? '{{#each (words "hello world")}}{{this}}{{/each}}'
                : undefined,
        },
        {
            name: 'parseInt',
            category: 'utility',
            description: 'Parses a string to an integer',
            syntax: '{{parseInt "42"}}',
            example: includeExamples ? '{{parseInt "123"}} → 123' : undefined,
        },
        {
            name: 'isArray',
            category: 'type-check',
            description: 'Check if a value is an array',
            syntax: '{{#if (isArray items)}}...{{/if}}',
            example: includeExamples
                ? '{{#if (isArray users)}}Is array{{/if}}'
                : undefined,
        },
        {
            name: 'isString',
            category: 'type-check',
            description: 'Check if a value is a string',
            syntax: '{{#if (isString value)}}...{{/if}}',
            example: includeExamples
                ? '{{#if (isString name)}}Is string{{/if}}'
                : undefined,
        },
        {
            name: 'isNumber',
            category: 'type-check',
            description: 'Check if a value is a number',
            syntax: '{{#if (isNumber value)}}...{{/if}}',
            example: includeExamples
                ? '{{#if (isNumber age)}}Is number{{/if}}'
                : undefined,
        },
        {
            name: 'isBoolean',
            category: 'type-check',
            description: 'Check if a value is a boolean',
            syntax: '{{#if (isBoolean value)}}...{{/if}}',
            example: includeExamples
                ? '{{#if (isBoolean isActive)}}Is boolean{{/if}}'
                : undefined,
        },
        {
            name: 'isObject',
            category: 'type-check',
            description: 'Check if a value is an object',
            syntax: '{{#if (isObject value)}}...{{/if}}',
            example: includeExamples
                ? '{{#if (isObject user)}}Is object{{/if}}'
                : undefined,
        },
        {
            name: 'isEmpty',
            category: 'type-check',
            description: 'Check if a value is empty',
            syntax: '{{#if (isEmpty value)}}...{{/if}}',
            example: includeExamples
                ? '{{#if (isEmpty items)}}No items{{/if}}'
                : undefined,
        },
        {
            name: 'includes',
            category: 'utility',
            description: 'Check if a string/array includes a value',
            syntax: '{{#if (includes "foobar" "foo")}}...{{/if}}',
            example: includeExamples
                ? '{{#if (includes name "admin")}}Has admin{{/if}}'
                : undefined,
        },
        {
            name: 'startsWith',
            category: 'utility',
            description: 'Check if a string starts with a value',
            syntax: '{{#if (startsWith "hello" "he")}}...{{/if}}',
            example: includeExamples
                ? '{{#if (startsWith name "user_")}}Is user{{/if}}'
                : undefined,
        },
        {
            name: 'endsWith',
            category: 'utility',
            description: 'Check if a string ends with a value',
            syntax: '{{#if (endsWith "hello" "lo")}}...{{/if}}',
            example: includeExamples
                ? '{{#if (endsWith file ".js")}}Is JS file{{/if}}'
                : undefined,
        },
    ];
    // Filter by category if specified
    const filteredHelpers = category
        ? allHelpers.filter((h) => h.category === category)
        : allHelpers;
    // Group helpers by category
    const categories = Array.from(new Set(filteredHelpers.map((h) => h.category))).sort();
    const categorizedHelpers = categories.map((cat) => ({
        category: cat,
        helpers: filteredHelpers.filter((h) => h.category === cat),
    }));
    return {
        success: true,
        total_helpers: filteredHelpers.length,
        categories: categorizedHelpers,
        available_categories: [
            'string',
            'comparison',
            'logic',
            'iteration',
            'formatting',
            'math',
            'type-check',
            'utility',
        ],
        context_variables: [
            {
                name: 'clay_model',
                description: 'Complete root model - accessible from any template context for lookups and cross-references',
                example: '{{clay_model.name}}, {{clay_model.model.types.length}}',
            },
            {
                name: 'clay_parent',
                description: 'Parent element in JSON structure with its JSONPath',
                example: '{{clay_parent.name}}, {{clay_parent.clay_parent.name}}',
            },
            {
                name: 'clay_key',
                description: 'JSON property name of current element',
                example: '{{clay_key}}',
            },
            {
                name: 'clay_json_key',
                description: 'Alternative reference to JSON property name',
                example: '{{clay_json_key}}',
            },
        ],
    };
}
/**
 * MCP tool handler for clay_list_helpers
 */
export async function listHelpersTool(args) {
    const input = ListHelpersInputSchema.parse(args);
    const result = await listHelpers(input);
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(result, null, 2),
            },
        ],
    };
}
//# sourceMappingURL=list-helpers.js.map