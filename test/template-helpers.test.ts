/**
 * Template helpers tests - verifies all Handlebars helpers work as documented
 */

import { expect } from 'chai';
import handlebars from '../src/template-engine';

describe('Template Helpers', () => {
  describe('String Case Conversion', () => {
    it('camelCase should convert to camelCase', () => {
      const result = handlebars.compile('{{camelCase "user name"}}')({});
      expect(result).to.equal('userName');
    });

    it('pascalCase should convert to PascalCase', () => {
      const result = handlebars.compile('{{pascalCase "user name"}}')({});
      expect(result).to.equal('UserName');
    });

    it('kebabCase should convert to kebab-case', () => {
      const result = handlebars.compile('{{kebabCase "userName"}}')({});
      expect(result).to.equal('user-name');
    });

    it('snakeCase should convert to snake_case', () => {
      const result = handlebars.compile('{{snakeCase "userName"}}')({});
      expect(result).to.equal('user_name');
    });

    it('upperCase should convert to UPPERCASE', () => {
      const result = handlebars.compile('{{upperCase "hello"}}')({});
      expect(result).to.equal('HELLO');
    });

    it('lowerCase should convert to lowercase', () => {
      const result = handlebars.compile('{{lowerCase "HELLO"}}')({});
      expect(result).to.equal('hello');
    });

    it('capitalize should capitalize first character', () => {
      const result = handlebars.compile('{{capitalize "hello world"}}')({});
      expect(result).to.equal('Hello world');
    });

    it('startCase should convert to Start Case', () => {
      const result = handlebars.compile('{{startCase "hello_world"}}')({});
      expect(result).to.equal('Hello World');
    });
  });

  describe('Pluralization', () => {
    it('pluralize should pluralize words', () => {
      expect(handlebars.compile('{{pluralize "category"}}')({})).to.equal('categories');
      expect(handlebars.compile('{{pluralize "user"}}')({})).to.equal('users');
      expect(handlebars.compile('{{pluralize "child"}}')({})).to.equal('children');
    });

    it('singularize should singularize words', () => {
      expect(handlebars.compile('{{singularize "categories"}}')({})).to.equal('category');
      expect(handlebars.compile('{{singularize "users"}}')({})).to.equal('user');
    });
  });

  describe('Comparison Helpers', () => {
    it('eq should check equality', () => {
      expect(handlebars.compile('{{eq a b}}')({ a: 5, b: 5 })).to.equal('true');
      expect(handlebars.compile('{{eq a b}}')({ a: 5, b: 3 })).to.equal('false');
    });

    it('ne should check inequality', () => {
      expect(handlebars.compile('{{ne a b}}')({ a: 5, b: 3 })).to.equal('true');
      expect(handlebars.compile('{{ne a b}}')({ a: 5, b: 5 })).to.equal('false');
    });

    it('lt should check less than', () => {
      expect(handlebars.compile('{{lt a b}}')({ a: 3, b: 5 })).to.equal('true');
      expect(handlebars.compile('{{lt a b}}')({ a: 5, b: 3 })).to.equal('false');
    });

    it('gt should check greater than', () => {
      expect(handlebars.compile('{{gt a b}}')({ a: 10, b: 5 })).to.equal('true');
      expect(handlebars.compile('{{gt a b}}')({ a: 5, b: 10 })).to.equal('false');
    });

    it('lte should check less than or equal', () => {
      expect(handlebars.compile('{{lte a b}}')({ a: 5, b: 5 })).to.equal('true');
      expect(handlebars.compile('{{lte a b}}')({ a: 3, b: 5 })).to.equal('true');
      expect(handlebars.compile('{{lte a b}}')({ a: 10, b: 5 })).to.equal('false');
    });

    it('gte should check greater than or equal', () => {
      expect(handlebars.compile('{{gte a b}}')({ a: 5, b: 5 })).to.equal('true');
      expect(handlebars.compile('{{gte a b}}')({ a: 10, b: 5 })).to.equal('true');
      expect(handlebars.compile('{{gte a b}}')({ a: 3, b: 5 })).to.equal('false');
    });
  });

  describe('Logic Helpers', () => {
    it('and should check all values are truthy', () => {
      expect(handlebars.compile('{{and true true}}')({})).to.equal('true');
      expect(handlebars.compile('{{and true false}}')({})).to.equal('false');
    });

    it('or should check any value is truthy', () => {
      expect(handlebars.compile('{{or true false}}')({})).to.equal('true');
      expect(handlebars.compile('{{or false false}}')({})).to.equal('false');
    });

    it('ifCond should support comparison operators', () => {
      const template = '{{#ifCond age ">=" 18}}Adult{{else}}Minor{{/ifCond}}';
      expect(handlebars.compile(template)({ age: 20 })).to.equal('Adult');
      expect(handlebars.compile(template)({ age: 15 })).to.equal('Minor');
    });

    it('switch/case should work correctly', () => {
      const template = '{{#switch type}}{{#case "admin"}}Admin{{/case}}{{#case "user"}}User{{/case}}{{#default}}Unknown{{/default}}{{/switch}}';
      expect(handlebars.compile(template)({ type: 'admin' })).to.equal('Admin');
      expect(handlebars.compile(template)({ type: 'user' })).to.equal('User');
      expect(handlebars.compile(template)({ type: 'guest' })).to.equal('Unknown');
    });

    it('propertyExists should check if property exists', () => {
      const template = '{{#if (propertyExists items "email")}}Has email{{else}}No email{{/if}}';
      const items = [{ name: 'John', email: 'john@example.com' }, { name: 'Jane' }];
      expect(handlebars.compile(template)({ items })).to.equal('Has email');
    });
  });

  describe('String Utilities', () => {
    it('pad should pad string to length', () => {
      const result = handlebars.compile('{{pad "abc" 5}}')({});
      expect(result.length).to.equal(5);
      expect(result).to.include('abc');
    });

    it('repeat should repeat string N times', () => {
      expect(handlebars.compile('{{repeat "*" 3}}')({})).to.equal('***');
      expect(handlebars.compile('{{repeat "ab" 2}}')({})).to.equal('abab');
    });

    it('replace should replace part of string', () => {
      expect(handlebars.compile('{{replace "hi" "i" "o"}}')({})).to.equal('ho');
      expect(handlebars.compile('{{replace "hello world" "world" "friend"}}')({})).to.equal('hello friend');
    });

    it('truncate should truncate string to length', () => {
      const result = handlebars.compile('{{truncate "hello world" 8}}')({});
      expect(result).to.include('hello');
      expect(result.length).to.be.lessThanOrEqual(11); // includes "..."
    });
  });

  describe('Iteration Helpers', () => {
    it('times should repeat N times', () => {
      const template = '{{#times 3}}*{{/times}}';
      expect(handlebars.compile(template)({})).to.equal('***');
    });

    it('eachUnique should iterate over unique values', () => {
      const template = '{{#eachUnique tags}}{{this}},{{/eachUnique}}';
      expect(handlebars.compile(template)({ tags: ['a', 'b', 'a', 'c', 'b'] })).to.equal('a,b,c,');
    });

    it('eachUnique should iterate over unique values by property', () => {
      const template = '{{#eachUnique items "category"}}{{this.category}},{{/eachUnique}}';
      const items = [
        { name: 'item1', category: 'A' },
        { name: 'item2', category: 'B' },
        { name: 'item3', category: 'A' }
      ];
      expect(handlebars.compile(template)({ items })).to.equal('A,B,');
    });

    it('eachUniqueJSONPath should iterate over unique values from JSONPath', () => {
      // This helper gets unique by the last element of the JSONPath
      // When selecting array items, each has a unique index
      const template = '{{#eachUniqueJSONPath model "$.types[*]"}}{{this.name}},{{/eachUniqueJSONPath}}';
      const model = {
        types: [
          { name: 'User', category: 'A' },
          { name: 'Admin', category: 'B' },
          { name: 'Guest', category: 'A' }
        ]
      };
      expect(handlebars.compile(template)({ model })).to.equal('User,Admin,Guest,');
    });

    it('group should group items by property', () => {
      const template = '{{#group items by="category"}}{{value}}:{{items.length}},{{/group}}';
      const items = [
        { name: 'item1', category: 'A' },
        { name: 'item2', category: 'B' },
        { name: 'item3', category: 'A' }
      ];
      expect(handlebars.compile(template)({ items })).to.equal('A:2,B:1,');
    });
  });

  describe('Utility Helpers', () => {
    it('inc should increment number by 1', () => {
      expect(handlebars.compile('{{inc 5}}')({})).to.equal('6');
      expect(handlebars.compile('{{inc 0}}')({})).to.equal('1');
    });

    it('parseInt should parse string to integer', () => {
      expect(handlebars.compile('{{parseInt "42"}}')({})).to.equal('42');
      expect(handlebars.compile('{{parseInt "123"}}')({})).to.equal('123');
    });

    it('json should stringify objects', () => {
      const result = handlebars.compile('{{{json this}}}')({ name: 'test', value: 123 });
      const parsed = JSON.parse(result);
      expect(parsed.name).to.equal('test');
      expect(parsed.value).to.equal(123);
    });

    it('splitAndUseWord should split and extract word at index', () => {
      expect(handlebars.compile('{{splitAndUseWord "foo-bar-baz" "-" 0}}')({})).to.equal('foo');
      expect(handlebars.compile('{{splitAndUseWord "foo-bar-baz" "-" 1}}')({})).to.equal('bar');
      expect(handlebars.compile('{{splitAndUseWord "foo-bar-baz" "-" 2}}')({})).to.equal('baz');
    });
  });
});
