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
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const model = __importStar(require("../src/model"));
describe('the model module', () => {
    describe('basic initialization', () => {
        let result;
        beforeEach(() => {
            result = model.load('./test/samples/example-unknown-generator.json');
        });
        it('will load a model from a path', () => {
            (0, chai_1.expect)(result).to.not.equal(undefined);
        });
        it('will have a generators section according to the file', () => {
            (0, chai_1.expect)(result.generators).to.deep.equal(['unknown']);
        });
        it('will have a mixin according to the sample', () => {
            (0, chai_1.expect)(result.mixins).to.deep.equal([
                {
                    type: 'function',
                    name: 'has_created',
                    function: "(piece)=>piece.events.push({'name': piece.name+'created'})",
                },
            ]);
        });
        it('will have a model', () => {
            (0, chai_1.expect)(result.model).to.deep.equal({
                types: [
                    {
                        name: 'order',
                        commands: [
                            {
                                name: 'finish_order',
                                raise: 'order_finished',
                                parameters: [
                                    {
                                        name: 'finished',
                                    },
                                ],
                            },
                        ],
                        events: [{ name: 'ordercreated' }],
                        fields: [
                            {
                                name: 'test',
                            },
                        ],
                    },
                    {
                        name: 'product',
                        events: [{ name: 'productcreated' }],
                    },
                ],
            });
        });
    });
    describe('mixins', () => {
        let result;
        beforeEach(() => {
            result = model.load('./test/samples/example-unknown-generator.json');
        });
        it('will be able to add function to an entity', () => {
            (0, chai_1.expect)(result.model.types[0].events).to.deep.equal([
                { name: 'ordercreated' },
            ]);
        });
        it('wont show in the resulting model', () => {
            (0, chai_1.expect)(result.model.types[0].mixins).to.equal(undefined);
        });
    });
    describe('include', () => {
        let result;
        beforeEach(() => {
            result = model.load('./test/samples/include-example.json');
        });
        it('will include a file instead of its current object', () => {
            (0, chai_1.expect)(result.model.types[0].events).to.deep.equal([
                { name: 'ordercreated' },
            ]);
        });
        it('wont show in the resulting model', () => {
            (0, chai_1.expect)(result.model.types[0].include).to.equal(undefined);
        });
    });
});
//# sourceMappingURL=model.test.js.map