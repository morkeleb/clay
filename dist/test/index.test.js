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
const command_line_1 = __importDefault(require("../src/command-line"));
describe('index.js', () => {
    let parseStub;
    let outputHelpStub;
    beforeEach(() => {
        parseStub = sinon_1.default.stub(command_line_1.default, 'parse');
        outputHelpStub = sinon_1.default.stub(command_line_1.default, 'outputHelp');
    });
    afterEach(() => {
        sinon_1.default.restore();
    });
    it('will call the commandline functions', async () => {
        const originalArgv = process.argv;
        process.argv = ['node', 'clay'];
        delete require.cache[require.resolve('../index')];
        await Promise.resolve().then(() => __importStar(require('../index')));
        process.argv = originalArgv;
        (0, chai_1.expect)(parseStub.calledOnce, 'parse not called').to.be.true;
        (0, chai_1.expect)(outputHelpStub.calledOnce, 'outputhelp not called').to.be.true;
    });
});
//# sourceMappingURL=index.test.js.map