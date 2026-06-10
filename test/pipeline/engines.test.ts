// test/pipeline/engines.test.ts
import { expect } from 'chai';
import path from 'path';
import { renderWithEngine, clearEngineCaches } from '../../src/pipeline/engines';
import { getHelpers } from '../../src/helpers';
import { CodeGenerator } from '../../src/code-generator';
import type { ClayHelpers } from '../../src/code-generator';

const samplesDir = path.resolve('test/samples/templates');

describe('template engines', () => {
  beforeEach(() => {
    clearEngineCaches();
  });

  describe('renderWithEngine', () => {
    const modelData = { name: 'User' };

    it('renders Handlebars template', async () => {
      const result = await renderWithEngine(
        'handlebars',
        path.join(samplesDir, 'simple.hbs'),
        modelData
      );
      expect(result).to.equal('export class User {}');
    });

    it('renders EJS template', async () => {
      const result = await renderWithEngine(
        'ejs',
        path.join(samplesDir, 'simple.ejs'),
        modelData
      );
      expect(result).to.equal('export class User {}');
    });

    it('renders TypeScript CodeGenerator template', async () => {
      const result = await renderWithEngine(
        'ts',
        path.join(samplesDir, 'simple-generator.ts'),
        modelData
      );
      expect(result).to.equal('export class User {}');
    });

    it('throws on unknown engine', async () => {
      try {
        await renderWithEngine('unknown', 'test.hbs', modelData);
        expect.fail('should have thrown');
      } catch (e: any) {
        expect(e.message).to.include('Unknown template engine');
      }
    });

    it('defaults Handlebars when engine is "handlebars"', async () => {
      const result = await renderWithEngine(
        'handlebars',
        path.join(samplesDir, 'simple.hbs'),
        { name: 'Order' }
      );
      expect(result).to.equal('export class Order {}');
    });
  });

  describe('EJS with helpers', () => {
    it('makes Clay helpers available via helpers object', async () => {
      const modelData = {
        name: 'user order',
        fields: [
          { name: 'order_id', type: 'string' },
          { name: 'total_amount', type: 'number' },
        ],
      };

      const result = await renderWithEngine(
        'ejs',
        path.join(samplesDir, 'with-helpers.ejs'),
        modelData
      );
      expect(result).to.include('export class UserOrder');
      expect(result).to.include('orderId: string');
      expect(result).to.include('totalAmount: number');
    });
  });

  describe('TypeScript CodeGenerator', () => {
    it('passes helpers to render context', async () => {
      const modelData = {
        name: 'user order',
        fields: [
          { name: 'order_id', type: 'string' },
          { name: 'total_amount', type: 'number' },
        ],
      };

      const result = await renderWithEngine(
        'ts',
        path.join(samplesDir, 'with-helpers-generator.ts'),
        modelData
      );
      expect(result).to.include('export class UserOrder');
      expect(result).to.include('orderId: string');
      expect(result).to.include('totalAmount: number');
    });

    it('supports async render', async () => {
      const modelData = {
        name: 'user',
        clay_model: { name: 'test-model' },
      };

      const result = await renderWithEngine(
        'ts',
        path.join(samplesDir, 'async-generator.ts'),
        modelData
      );
      expect(result).to.equal('export class UserService {}');
    });
  });

  describe('getHelpers', () => {
    it('returns an object with helper functions', () => {
      const helpers = getHelpers();
      expect(helpers).to.be.an('object');
      expect(helpers.pascalCase).to.be.a('function');
      expect(helpers.camelCase).to.be.a('function');
      expect(helpers.kebabCase).to.be.a('function');
      expect(helpers.snakeCase).to.be.a('function');
      expect(helpers.pluralize).to.be.a('function');
      expect(helpers.singularize).to.be.a('function');
      expect(helpers.eq).to.be.a('function');
      expect(helpers.inc).to.be.a('function');
    });

    it('helpers produce correct output', () => {
      const helpers = getHelpers();
      expect(helpers.pascalCase('user name')).to.equal('UserName');
      expect(helpers.camelCase('user name')).to.equal('userName');
      expect(helpers.kebabCase('userName')).to.equal('user-name');
      expect(helpers.snakeCase('userName')).to.equal('user_name');
      expect(helpers.pluralize('category')).to.equal('categories');
      expect(helpers.singularize('users')).to.equal('user');
    });
  });

  describe('CodeGenerator base class', () => {
    it('can be extended with a render method', () => {
      class TestGenerator extends CodeGenerator {
        render({ data }: { data: Record<string, any>; helpers: ClayHelpers; model: Record<string, any> }): string {
          return `class ${data.name} {}`;
        }
      }
      const gen = new TestGenerator();
      expect(gen).to.be.instanceOf(CodeGenerator);
    });
  });
});
