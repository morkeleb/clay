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
const generator = __importStar(require("../src/generator"));
const chai_1 = require("chai");
const sinon_1 = __importDefault(require("sinon"));
const output = __importStar(require("../src/output"));
const model = __importStar(require("../src/model"));
const fs_extra_1 = __importDefault(require("fs-extra"));
describe('a generator', () => {
    afterEach(() => {
        fs_extra_1.default.removeSync('./tmp');
    });
    describe('basic initialization', () => {
        it('will read a json array with instructions', () => {
            const result = generator.load('./test/samples/generator.json', '', {});
            (0, chai_1.expect)(result.steps).to.deep.equal([
                {
                    runCommand: 'jhipster microservice',
                },
                {
                    generate: 'templates/jdl-files',
                    select: '$.jsonpath.statement',
                },
                {
                    runCommand: 'jhipster import-jdl {{service.name}}',
                    select: '$.jsonpath.statement',
                },
                {
                    copy: 'git+morkeleb/foundation',
                    select: '$.jsonpath.statement',
                    target: '{{microservice}}',
                },
            ]);
        });
    });
    describe('jsonpath selection error handling', () => {
        let warnStub;
        let criticalStub;
        beforeEach(() => {
            warnStub = sinon_1.default.stub(output, 'warn');
            criticalStub = sinon_1.default.stub(output, 'critical');
        });
        afterEach(() => {
            warnStub.restore();
            criticalStub.restore();
        });
        it('will warn if no selection is found', async () => {
            const clayFile = require('../src/clay_file');
            const modelIndex = clayFile
                .load('./test/samples')
                .getModelIndex('./test/include-example.json', './tmp/test-output/');
            const g = generator.load('./test/samples/just-copy-example.json', '', modelIndex);
            g.steps[0].select = '$.valid.jsonpath';
            await g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output');
            (0, chai_1.expect)(warnStub.calledWith('No entries found for jsonpath', '$.valid.jsonpath')).to.be.true;
        });
        it('will warn and stop if jsonpath expression is bad', async () => {
            const clayFile = require('../src/clay_file');
            const modelIndex = clayFile
                .load('./test/samples')
                .getModelIndex('./test/include-example.json', './tmp/test-output/');
            const g = generator.load('./test/samples/just-copy-example.json', '', modelIndex);
            g.steps[0].select = 'I will so crash!';
            await g.generate(model.load('./test/samples/example-unknown-generator.json'), './tmp/test-output');
            (0, chai_1.expect)(criticalStub.calledOnce).to.be.true;
        });
    });
});
//# sourceMappingURL=generator.test.js.map