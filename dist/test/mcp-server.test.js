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
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
describe('MCP Server', function () {
    this.timeout(15000);
    const mcpBin = path.join(__dirname, '..', 'bin', 'clay-mcp');
    const mcpDist = path.join(__dirname, '..', 'mcp', 'dist', 'index.js');
    const mcpSource = path.join(__dirname, '..', 'mcp', 'index.ts');
    describe('Installation', () => {
        it('should have clay-mcp binary', () => {
            (0, chai_1.expect)(fs.existsSync(mcpBin)).to.be.true;
        });
        it('should have MCP source or compiled files', () => {
            const hasSource = fs.existsSync(mcpSource);
            const hasDist = fs.existsSync(mcpDist);
            (0, chai_1.expect)(hasSource || hasDist, 'Neither source nor compiled MCP files found').to.be.true;
        });
    });
    describe('Server Startup', () => {
        let serverProcess = null;
        afterEach((done) => {
            if (serverProcess && !serverProcess.killed) {
                serverProcess.once('exit', () => done());
                serverProcess.kill('SIGTERM');
                setTimeout(() => {
                    if (serverProcess && !serverProcess.killed) {
                        serverProcess.kill('SIGKILL');
                    }
                }, 2000);
            }
            else {
                done();
            }
        });
        it('should start without crashing', (done) => {
            serverProcess = (0, child_process_1.spawn)('node', [mcpBin], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            let crashed = false;
            serverProcess.on('exit', (code) => {
                if (code !== null && code !== 0 && code !== 143 && code !== 130) {
                    crashed = true;
                }
            });
            setTimeout(() => {
                (0, chai_1.expect)(crashed, 'Server crashed on startup').to.be.false;
                (0, chai_1.expect)(serverProcess?.killed).to.be.false;
                done();
            }, 3000);
        });
        it('should respond to initialization', (done) => {
            serverProcess = (0, child_process_1.spawn)('node', [mcpBin], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            let responseReceived = false;
            const initRequest = {
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: {
                        name: 'test-client',
                        version: '1.0.0',
                    },
                },
            };
            const timeoutId = setTimeout(() => {
                if (!responseReceived) {
                    done(new Error('Server did not respond to initialization'));
                }
            }, 5000);
            serverProcess.stdout?.on('data', (data) => {
                const lines = data
                    .toString()
                    .split('\n')
                    .filter((l) => l.trim());
                for (const line of lines) {
                    try {
                        const response = JSON.parse(line);
                        if (response.id === 1 && response.result) {
                            responseReceived = true;
                            clearTimeout(timeoutId);
                            (0, chai_1.expect)(response.result).to.have.property('serverInfo');
                            done();
                            return;
                        }
                    }
                    catch {
                    }
                }
            });
            setTimeout(() => {
                serverProcess?.stdin?.write(JSON.stringify(initRequest) + '\n');
            }, 1000);
        });
    });
    describe('Tool Discovery', () => {
        let serverProcess = null;
        afterEach((done) => {
            if (serverProcess && !serverProcess.killed) {
                serverProcess.once('exit', () => done());
                serverProcess.kill('SIGTERM');
                setTimeout(() => {
                    if (serverProcess && !serverProcess.killed) {
                        serverProcess.kill('SIGKILL');
                    }
                }, 2000);
            }
            else {
                done();
            }
        });
        it('should list 8 Clay tools', (done) => {
            serverProcess = (0, child_process_1.spawn)('node', [mcpBin], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            let toolsReceived = false;
            const listToolsRequest = {
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
                params: {},
            };
            const timeoutId = setTimeout(() => {
                if (!toolsReceived) {
                    done(new Error('Server did not respond to tools/list'));
                }
            }, 5000);
            serverProcess.stdout?.on('data', (data) => {
                const lines = data
                    .toString()
                    .split('\n')
                    .filter((l) => l.trim());
                for (const line of lines) {
                    try {
                        const response = JSON.parse(line);
                        if (response.id === 2 && response.result && response.result.tools) {
                            toolsReceived = true;
                            clearTimeout(timeoutId);
                            const tools = response.result.tools;
                            (0, chai_1.expect)(tools).to.be.an('array');
                            (0, chai_1.expect)(tools.length).to.equal(8);
                            const toolNames = tools.map((t) => t.name);
                            (0, chai_1.expect)(toolNames).to.include('clay_generate');
                            (0, chai_1.expect)(toolNames).to.include('clay_clean');
                            (0, chai_1.expect)(toolNames).to.include('clay_test_path');
                            (0, chai_1.expect)(toolNames).to.include('clay_init');
                            (0, chai_1.expect)(toolNames).to.include('clay_list_generators');
                            (0, chai_1.expect)(toolNames).to.include('clay_get_model_structure');
                            (0, chai_1.expect)(toolNames).to.include('clay_list_helpers');
                            (0, chai_1.expect)(toolNames).to.include('clay_explain_concepts');
                            done();
                            return;
                        }
                    }
                    catch {
                    }
                }
            });
            setTimeout(() => {
                serverProcess?.stdin?.write(JSON.stringify(listToolsRequest) + '\n');
            }, 1000);
        });
    });
});
//# sourceMappingURL=mcp-server.test.js.map