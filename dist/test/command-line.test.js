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
const decache_1 = __importDefault(require("decache"));
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const clay_file_1 = require("../src/clay_file");
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
describe('the command line interface', () => {
    const clayFilePath = path_1.default.resolve('.clay');
    beforeEach(() => {
        if (fs_extra_1.default.existsSync(clayFilePath)) {
            fs_extra_1.default.unlinkSync(clayFilePath);
        }
        (0, clay_file_1.createClayFile)('.');
    });
    afterEach(() => {
        fs_extra_1.default.removeSync('./tmp');
        (0, decache_1.default)('./clay-file');
        if (fs_extra_1.default.existsSync(clayFilePath)) {
            fs_extra_1.default.unlinkSync(clayFilePath);
        }
        const generatorPath = path_1.default.join('clay', 'generators');
        if (fs_extra_1.default.existsSync(generatorPath)) {
            fs_extra_1.default.removeSync(generatorPath);
        }
    });
    describe('the generate command', () => {
        it('will generate using a specified model', async () => {
            const cmdln = (await Promise.resolve().then(() => __importStar(require('../src/command-line')))).default;
            const result = cmdln.parse([
                'node',
                'clay',
                'generate',
                'test/samples/cmd-example.json',
                'tmp/output',
            ]);
            await Promise.all(result._actionResults || []);
            (0, chai_1.expect)(fs_extra_1.default.existsSync('./tmp/output/order.txt'), 'template file not generated').to.equal(true);
        });
        it('will throw exceptions if generator not found', async () => {
            const cmdln = (await Promise.resolve().then(() => __importStar(require('../src/command-line')))).default;
            const args = [
                'node',
                'clay',
                'generate',
                'test/samples/example-unknown-generator.json',
                'tmp/output',
            ];
            const result = cmdln.parse(args);
            let run = false;
            try {
                const actionResults = result._actionResults || [];
                await actionResults[1];
                run = true;
            }
            catch (e) {
                (0, chai_1.expect)(e).to.match(/.*generator not found.*/g);
            }
            (0, chai_1.expect)(run).to.equal(false);
        });
        it('will supply the generator with a specified output if specified', async () => {
            const cmdln = (await Promise.resolve().then(() => __importStar(require('../src/command-line')))).default;
            const result = cmdln.parse([
                'node',
                'clay',
                'generate',
                'test/samples/cmd-example.json',
                'tmp/output',
            ]);
            const actionResults = result._actionResults || [];
            await actionResults[2];
            await sleep(1);
            (0, chai_1.expect)(fs_extra_1.default.existsSync('./tmp/output/otheroutput/order.txt'), 'template file not generated').to.equal(true);
        });
        it('should fail if .clay file is missing', () => {
            try {
                (0, child_process_1.execSync)('node dist/index.js generate', { stdio: 'pipe' });
            }
            catch (error) {
                (0, chai_1.expect)(error.message).to.match(/This folder has not been initiated with clay/);
            }
        });
    });
    describe('the clean command', () => {
        it('should fail if .clay file is missing', () => {
            try {
                (0, child_process_1.execSync)('node dist/index.js clean', { stdio: 'pipe' });
            }
            catch (error) {
                (0, chai_1.expect)(error.message).to.match(/This folder has not been initiated with clay/);
            }
        });
    });
    describe('the test command', () => {
        it('should fail if .clay file is missing', () => {
            try {
                (0, child_process_1.execSync)('node dist/index.js test-path test/samples/cmd-example.json $', {
                    stdio: 'pipe',
                });
            }
            catch (error) {
                (0, chai_1.expect)(error.message).to.match(/This folder has not been initiated with clay/);
            }
        });
    });
    describe('the init command', () => {
        it('should create a .clay file', () => {
            if (fs_extra_1.default.existsSync(clayFilePath)) {
                fs_extra_1.default.unlinkSync(clayFilePath);
            }
            (0, child_process_1.execSync)('node dist/index.js init', { stdio: 'pipe' });
            (0, chai_1.expect)(fs_extra_1.default.existsSync(clayFilePath)).to.equal(true);
        });
        it('should fail if .clay file already exists', () => {
            fs_extra_1.default.writeFileSync(clayFilePath, '', 'utf8');
            try {
                (0, child_process_1.execSync)('node dist/index.js init', { stdio: 'pipe' });
            }
            catch (error) {
                (0, chai_1.expect)(error.message).to.match(/A .clay file already exists in this folder/);
            }
        });
        it('should create a generator.json file when initializing a generator', async () => {
            const cmdln = (await Promise.resolve().then(() => __importStar(require('../src/command-line')))).default;
            const generatorName = 'myOwnGenerator';
            const generatorPath = path_1.default.join('clay', 'generators', generatorName);
            const generatorFilePath = path_1.default.join(generatorPath, 'generator.json');
            cmdln.parse(['node', 'clay', 'init', 'generator', generatorName]);
            (0, chai_1.expect)(fs_extra_1.default.existsSync(generatorPath)).to.equal(true);
            (0, chai_1.expect)(fs_extra_1.default.existsSync(generatorFilePath)).to.equal(true);
            const generatorContent = JSON.parse(fs_extra_1.default.readFileSync(generatorFilePath, 'utf8'));
            (0, chai_1.expect)(generatorContent).to.have.property('steps').that.is.an('array');
        });
    });
});
//# sourceMappingURL=command-line.test.js.map