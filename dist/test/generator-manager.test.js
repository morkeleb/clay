"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const sinon_1 = __importDefault(require("sinon"));
const generatorManager = __importStar(require("../src/generator-manager"));
describe('generator-manager', () => {
    let clayFile;
    let testModelPath;
    let testGeneratorPath;
    beforeEach(() => {
        testModelPath = path_1.default.join(__dirname, 'temp-model.json');
        testGeneratorPath = path_1.default.join(__dirname, 'temp-generators', 'test-gen');
        clayFile = {
            models: [
                {
                    path: testModelPath,
                    output: 'output/',
                    generated_files: {},
                    setFileCheckSum: () => { },
                    getFileCheckSum: () => null,
                    delFileCheckSum: () => { },
                    load: () => ({}),
                },
            ],
            getModelIndex: (modelPath, output) => ({
                path: modelPath,
                output: output || '',
                generated_files: {},
                setFileCheckSum: () => { },
                getFileCheckSum: () => null,
                delFileCheckSum: () => { },
                load: () => ({}),
            }),
            save: sinon_1.default.stub(),
        };
        const testModel = {
            name: 'test-model',
            generators: [],
            mixins: [],
            model: {
                types: [{ name: 'user', fields: [{ name: 'id', type: 'string' }] }],
            },
        };
        fs_extra_1.default.ensureDirSync(path_1.default.dirname(testModelPath));
        fs_extra_1.default.writeFileSync(testModelPath, JSON.stringify(testModel, null, 2));
        fs_extra_1.default.ensureDirSync(testGeneratorPath);
        fs_extra_1.default.writeFileSync(path_1.default.join(testGeneratorPath, 'generator.json'), JSON.stringify({
            partials: [],
            steps: [
                {
                    generate: 'templates/{{name}}.js',
                    select: '$.model.types.*',
                    target: 'generated/',
                },
            ],
        }, null, 2));
    });
    afterEach(() => {
        if (fs_extra_1.default.existsSync(testModelPath)) {
            fs_extra_1.default.unlinkSync(testModelPath);
        }
        const modelDir = path_1.default.dirname(testModelPath);
        if (modelDir.includes('test-registry/models') && fs_extra_1.default.existsSync(modelDir)) {
            try {
                fs_extra_1.default.rmdirSync(modelDir);
            }
            catch {
            }
        }
        if (fs_extra_1.default.existsSync(testGeneratorPath)) {
            fs_extra_1.default.removeSync(path_1.default.dirname(testGeneratorPath));
        }
        sinon_1.default.restore();
    });
    describe('getAllGenerators', () => {
        it('should return empty array when no generators are configured', () => {
            const generators = generatorManager.getAllGenerators(clayFile);
            (0, chai_1.expect)(generators).to.be.an('array').that.is.empty;
        });
        it('should return generators from models', () => {
            const model = JSON.parse(fs_extra_1.default.readFileSync(testModelPath, 'utf-8'));
            model.generators = ['test-generator'];
            fs_extra_1.default.writeFileSync(testModelPath, JSON.stringify(model, null, 2));
            delete require.cache[require.resolve(testModelPath)];
            const generators = generatorManager.getAllGenerators(clayFile);
            (0, chai_1.expect)(generators).to.have.length(1);
            (0, chai_1.expect)(generators[0].name).to.equal('test-generator');
            (0, chai_1.expect)(generators[0].usedInModels).to.have.length(1);
        });
    });
    describe('loadGeneratorRegistry', () => {
        it('should load the generator registry', async () => {
            const registry = await generatorManager.loadGeneratorRegistry();
            (0, chai_1.expect)(registry).to.be.an('object');
            (0, chai_1.expect)(registry).to.have.property('generators');
        });
    });
    describe('findGeneratorInRegistry', () => {
        it('should find existing generator in registry', async () => {
            const generator = await generatorManager.findGeneratorInRegistry('clay-model-documentation');
            (0, chai_1.expect)(generator).to.not.be.null;
            (0, chai_1.expect)(generator).to.have.property('name');
            (0, chai_1.expect)(generator).to.have.property('repository');
        });
        it('should return null for non-existing generator', async () => {
            const generator = await generatorManager.findGeneratorInRegistry('non-existing-generator');
            (0, chai_1.expect)(generator).to.be.null;
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
            (0, chai_1.expect)(exists).to.be.true;
        });
        it('should return false for non-existing generator', () => {
            const exists = generatorManager.generatorExistsLocally('non-existing-generator');
            (0, chai_1.expect)(exists).to.be.false;
        });
        it('should return true for direct path to generator.json', () => {
            const generatorJsonPath = path_1.default.join(testGeneratorPath, 'generator.json');
            const exists = generatorManager.generatorExistsLocally(generatorJsonPath);
            (0, chai_1.expect)(exists).to.be.true;
        });
    });
    describe('listGenerators', () => {
        it('should not throw when no generators are found', () => {
            (0, chai_1.expect)(() => {
                generatorManager.listGenerators(clayFile);
            }).to.not.throw();
        });
    });
});
//# sourceMappingURL=generator-manager.test.js.map