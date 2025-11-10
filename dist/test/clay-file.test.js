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
const path_1 = __importDefault(require("path"));
const chai_1 = require("chai");
const fs_extra_1 = __importDefault(require("fs-extra"));
const sinon_1 = __importDefault(require("sinon"));
const clay_file = __importStar(require("../src/clay_file"));
const output = __importStar(require("../src/output"));
const clayFilePath = path_1.default.resolve('.clay');
describe('clay_file', () => {
    let outputWriteStub;
    beforeEach(() => {
        outputWriteStub = sinon_1.default.stub(output, 'write');
    });
    afterEach(() => {
        outputWriteStub.restore();
        if (fs_extra_1.default.existsSync(clayFilePath)) {
            fs_extra_1.default.unlinkSync(clayFilePath);
        }
    });
    describe('createClayFile', () => {
        it('should create a .clay file with the correct structure and log output', () => {
            clay_file.createClayFile('.');
            const fileExists = fs_extra_1.default.existsSync(clayFilePath);
            const fileContent = JSON.parse(fs_extra_1.default.readFileSync(clayFilePath, 'utf8'));
            (0, chai_1.expect)(fileExists).to.be.true;
            (0, chai_1.expect)(fileContent).to.deep.equal({ models: [] });
            (0, chai_1.expect)(outputWriteStub.calledWith('.clay file has been created successfully.')).to.be.true;
        });
        it('should throw an error if a .clay file already exists', () => {
            fs_extra_1.default.writeFileSync(clayFilePath, '', 'utf8');
            (0, chai_1.expect)(() => clay_file.createClayFile('.')).to.throw('A .clay file already exists in this folder.');
            (0, chai_1.expect)(outputWriteStub.notCalled).to.be.true;
        });
    });
    describe('models management', () => {
        it('keeps track of all models generated and which params used', () => {
            const clay_index = clay_file.load('./test/samples');
            const fileMd5 = '32453245345';
            clay_index
                .getModelIndex('./test/include-example.json', './tmp/test-output/')
                .setFileCheckSum('order.txt', fileMd5);
            (0, chai_1.expect)(clay_index.models[1]).to.include({
                output: './tmp/test-output/',
                path: './test/include-example.json',
            });
        });
        it('keeps track of which files have been generated for the model', () => {
            const clay_index = clay_file.load('./test/samples');
            const fileMd5 = '32453245345';
            clay_index
                .getModelIndex('./test/include-example.json', './tmp/test-output/')
                .setFileCheckSum('order.txt', fileMd5);
            (0, chai_1.expect)(clay_index.models[1].generated_files['order.txt']).to.include({
                md5: fileMd5,
            });
        });
        it('keeps the md5 checksum of the file content last generated for each file', () => {
            const clay_index = clay_file.load('./test/samples');
            const fileMd5 = '32453245345';
            clay_index
                .getModelIndex('./test/include-example.json', './tmp/test-output/')
                .setFileCheckSum('order.txt', fileMd5);
            const resultMd5 = clay_index
                .getModelIndex('./test/include-example.json', './tmp/test-output/')
                .getFileCheckSum('order.txt');
            (0, chai_1.expect)(resultMd5).to.equal(fileMd5);
        });
    });
    describe('loading the generated file', () => {
        it('will check for a .clay file in the specified directory', () => {
            const clay_index = clay_file.load('./test/samples');
            (0, chai_1.expect)(clay_index).to.not.be.null;
            (0, chai_1.expect)(clay_index.models.length).to.eq(1);
        });
        it('will return a new index file if no file found', () => {
            const clay_index = clay_file.load('./test/no_file_here');
            (0, chai_1.expect)(clay_index).to.not.be.null;
            (0, chai_1.expect)(clay_index.models.length).to.eq(0);
        });
    });
});
//# sourceMappingURL=clay-file.test.js.map