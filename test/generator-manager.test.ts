import { expect } from 'chai';
import fs from 'fs-extra';
import path from 'path';
import sinon from 'sinon';
import * as generatorManager from '../src/generator-manager';
import type { ClayFileManager } from '../src/types/clay-file';

describe('generator-manager', () => {
  let clayFile: ClayFileManager;
  let testModelPath: string;
  let testGeneratorPath: string;

  beforeEach(() => {
    // Set up test environment
    testModelPath = path.join(__dirname, 'temp-model.json');
    testGeneratorPath = path.join(__dirname, 'temp-generators', 'test-gen');

    // Create test clay file structure
    clayFile = {
      models: [
        {
          path: testModelPath,
          output: 'output/',
          generated_files: {},
          setFileCheckSum: () => {},
          getFileCheckSum: () => null,
          delFileCheckSum: () => {},
          load: () => ({}),
        },
      ],
      getModelIndex: (modelPath: string, output?: string) => ({
        path: modelPath,
        output: output || '',
        generated_files: {},
        setFileCheckSum: () => {},
        getFileCheckSum: () => null,
        delFileCheckSum: () => {},
        load: () => ({}),
      }),
      save: sinon.stub(),
    };

    // Create test model
    const testModel = {
      name: 'test-model',
      generators: [],
      mixins: [],
      model: {
        types: [{ name: 'user', fields: [{ name: 'id', type: 'string' }] }],
      },
    };

    fs.ensureDirSync(path.dirname(testModelPath));
    fs.writeFileSync(testModelPath, JSON.stringify(testModel, null, 2));

    // Create test generator
    fs.ensureDirSync(testGeneratorPath);
    fs.writeFileSync(
      path.join(testGeneratorPath, 'generator.json'),
      JSON.stringify(
        {
          partials: [],
          steps: [
            {
              generate: 'templates/{{name}}.js',
              select: '$.model.types.*',
              target: 'generated/',
            },
          ],
        },
        null,
        2
      )
    );
  });

  afterEach(() => {
    // Clean up test files - be careful to only remove what we created
    if (fs.existsSync(testModelPath)) {
      fs.unlinkSync(testModelPath);
    }
    const modelDir = path.dirname(testModelPath);
    // Only remove the models directory if it exists and is in our test folder
    if (modelDir.includes('test-registry/models') && fs.existsSync(modelDir)) {
      try {
        fs.rmdirSync(modelDir); // Only works if empty
      } catch {
        // Directory not empty, that's okay
      }
    }
    if (fs.existsSync(testGeneratorPath)) {
      fs.removeSync(path.dirname(testGeneratorPath));
    }
    sinon.restore();
  });

  describe('getAllGenerators', () => {
    it('should return empty array when no generators are configured', () => {
      const generators = generatorManager.getAllGenerators(clayFile);
      expect(generators).to.be.an('array').that.is.empty;
    });

    it('should return generators from models', () => {
      // Add generator to model
      const model = JSON.parse(fs.readFileSync(testModelPath, 'utf-8'));
      model.generators = ['test-generator'];
      fs.writeFileSync(testModelPath, JSON.stringify(model, null, 2));

      // Clear require cache for the model file
      delete require.cache[require.resolve(testModelPath)];

      const generators = generatorManager.getAllGenerators(clayFile);
      expect(generators).to.have.length(1);
      expect(generators[0].name).to.equal('test-generator');
      expect(generators[0].usedInModels).to.have.length(1);
    });
  });

  describe('loadGeneratorRegistry', () => {
    it('should load the generator registry', async () => {
      const registry = await generatorManager.loadGeneratorRegistry();
      expect(registry).to.be.an('object');
      expect(registry).to.have.property('generators');
    });
  });

  describe('findGeneratorInRegistry', () => {
    it('should find existing generator in registry', async () => {
      const generator = await generatorManager.findGeneratorInRegistry(
        'clay-model-documentation'
      );
      expect(generator).to.not.be.null;
      expect(generator).to.have.property('name');
      expect(generator).to.have.property('repository');
    });

    it('should return null for non-existing generator', async () => {
      const generator = await generatorManager.findGeneratorInRegistry(
        'non-existing-generator'
      );
      expect(generator).to.be.null;
    });
  });

  describe('listAvailableGenerators', () => {
    it('should not throw when listing available generators', async () => {
      await generatorManager.listAvailableGenerators();
    });
  });

  describe('generatorExistsLocally', () => {
    it('should return true for existing generator directory with generator.json', () => {
      const exists = generatorManager.generatorExistsLocally(testGeneratorPath);
      expect(exists).to.be.true;
    });

    it('should return false for non-existing generator', () => {
      const exists = generatorManager.generatorExistsLocally(
        'non-existing-generator'
      );
      expect(exists).to.be.false;
    });

    it('should return true for direct path to generator.json', () => {
      const generatorJsonPath = path.join(testGeneratorPath, 'generator.json');
      const exists = generatorManager.generatorExistsLocally(generatorJsonPath);
      expect(exists).to.be.true;
    });
  });

  describe('listGenerators', () => {
    it('should not throw when no generators are found', () => {
      expect(() => {
        generatorManager.listGenerators(clayFile);
      }).to.not.throw();
    });
  });
});
