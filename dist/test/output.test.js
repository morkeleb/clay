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
const sinon_1 = __importDefault(require("sinon"));
const chai_1 = require("chai");
const output = __importStar(require("../src/output"));
const chalk_1 = __importDefault(require("chalk"));
describe('the output module', () => {
    let consoleLogStub;
    let consoleWarnStub;
    let processExitStub;
    before(() => {
        consoleLogStub = sinon_1.default.stub(console, 'log');
        consoleWarnStub = sinon_1.default.stub(console, 'warn');
        processExitStub = sinon_1.default.stub(process, 'exit');
        process.isCLI = true;
    });
    after(() => {
        consoleLogStub.restore();
        consoleWarnStub.restore();
        processExitStub.restore();
    });
    it('will print to the log for logging', () => {
        output.log('test');
        (0, chai_1.expect)(consoleLogStub.calledWithMatch('test')).to.be.true;
    });
    it('will print to the log for copy', () => {
        output.copy('t2est', 'test2');
        sinon_1.default.assert.calledWith(consoleLogStub, chalk_1.default.magenta('copying: '), 't2est', chalk_1.default.magenta(' -> '), 'test2');
    });
    it('will print to the log for move', () => {
        output.move('t2es2t', 'te2st2');
        sinon_1.default.assert.calledWith(consoleLogStub, chalk_1.default.green('moving: '), 't2es2t', chalk_1.default.green(' -> '), 'te2st2');
    });
    it('will print to the log for write', () => {
        output.write('te12st');
        sinon_1.default.assert.calledWith(consoleLogStub, chalk_1.default.green('writing: '), 'te12st');
    });
    it('will print to the log for execute', () => {
        output.execute('tes2t');
        sinon_1.default.assert.calledWith(consoleLogStub, chalk_1.default.blue('executing: '), 'tes2t');
    });
    it('will print to the stderr for warn', () => {
        output.warn('test');
        sinon_1.default.assert.calledWith(consoleWarnStub, chalk_1.default.red('Warning! '), 'test');
    });
    it('will print to the stderr for critical and quit', () => {
        output.critical('test');
        sinon_1.default.assert.calledWith(consoleWarnStub, chalk_1.default.red('CRITICAL! '), 'test');
        (0, chai_1.expect)(processExitStub.calledOnce).to.be.true;
    });
});
//# sourceMappingURL=output.test.js.map