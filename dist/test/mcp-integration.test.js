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
const fs = __importStar(require("fs-extra"));
const os = __importStar(require("os"));
describe('MCP Server Integration', function () {
    this.timeout(20000);
    const mcpBin = path.join(__dirname, '..', 'bin', 'clay-mcp');
    let testDir;
    let serverProcess = null;
    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clay-mcp-test-'));
    });
    afterEach(async () => {
        if (serverProcess && !serverProcess.killed) {
            serverProcess.kill('SIGTERM');
            await new Promise((resolve) => {
                serverProcess.once('exit', resolve);
                setTimeout(() => {
                    if (serverProcess && !serverProcess.killed) {
                        serverProcess.kill('SIGKILL');
                        resolve(undefined);
                    }
                }, 2000);
            });
            serverProcess = null;
        }
        try {
            await fs.remove(testDir);
        }
        catch {
        }
    });
    async function startServer() {
        serverProcess = (0, child_process_1.spawn)('node', [mcpBin], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        await sendRequest({
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
        });
    }
    function sendRequest(request) {
        return new Promise((resolve, reject) => {
            if (!serverProcess || !serverProcess.stdin || !serverProcess.stdout) {
                reject(new Error('Server not started'));
                return;
            }
            const requestId = typeof request === 'object' && request !== null && 'id' in request
                ? request.id
                : null;
            let responseReceived = false;
            const timeoutId = setTimeout(() => {
                if (!responseReceived) {
                    reject(new Error(`Request ${requestId} timed out`));
                }
            }, 10000);
            const dataHandler = (data) => {
                const lines = data
                    .toString()
                    .split('\n')
                    .filter((l) => l.trim());
                for (const line of lines) {
                    try {
                        const response = JSON.parse(line);
                        if (response.id === requestId) {
                            responseReceived = true;
                            clearTimeout(timeoutId);
                            serverProcess.stdout.off('data', dataHandler);
                            resolve(response);
                            return;
                        }
                    }
                    catch {
                    }
                }
            };
            serverProcess.stdout.on('data', dataHandler);
            serverProcess.stdin.write(JSON.stringify(request) + '\n');
        });
    }
    async function callTool(toolName, args = {}) {
        const response = (await sendRequest({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
                name: toolName,
                arguments: args,
            },
        }));
        if (response.error) {
            return { success: false, error: response.error };
        }
        if (response.result?.content?.[0]?.text) {
            const parsedResult = JSON.parse(response.result.content[0].text);
            return { success: true, result: parsedResult };
        }
        return { success: false, error: 'Invalid response format' };
    }
    describe('clay_init', () => {
        it('should create a .clay file in the working directory', async () => {
            await startServer();
            const result = await callTool('clay_init', {
                working_directory: testDir,
            });
            (0, chai_1.expect)(result.success).to.be.true;
            const clayFilePath = path.join(testDir, '.clay');
            (0, chai_1.expect)(fs.existsSync(clayFilePath)).to.be.true;
            const clayContent = await fs.readJson(clayFilePath);
            (0, chai_1.expect)(clayContent).to.have.property('models');
            (0, chai_1.expect)(clayContent.models).to.be.an('array');
        });
        it('should fail if .clay file already exists', async () => {
            await startServer();
            await callTool('clay_init', {
                working_directory: testDir,
            });
            const result = await callTool('clay_init', {
                working_directory: testDir,
            });
            (0, chai_1.expect)(result.success).to.be.true;
            (0, chai_1.expect)(result.result).to.have.property('success', false);
        });
    });
    describe('clay_generate', () => {
        it.skip('should fail gracefully if no .clay file exists and no model provided', async () => {
            await startServer();
            const result = await callTool('clay_generate', {
                working_directory: testDir,
            });
            (0, chai_1.expect)(result.success).to.be.true;
            (0, chai_1.expect)(result.result).to.have.property('success', false);
            if (result.result &&
                typeof result.result === 'object' &&
                'message' in result.result) {
                (0, chai_1.expect)(result.result.message).to.include('.clay file');
            }
        });
    });
    describe('clay_list_generators', () => {
        it.skip('should not crash when listing generators', async () => {
            await startServer();
            const result = await callTool('clay_list_generators', {
                working_directory: testDir,
            });
            (0, chai_1.expect)(result.success).to.be.true;
            (0, chai_1.expect)(result.result).to.have.property('success');
        });
    });
    describe('clay_get_model_structure', () => {
        it.skip('should not crash when analyzing a model file', async () => {
            await startServer();
            const modelPath = path.join(testDir, 'test-model.json');
            await fs.writeJson(modelPath, {
                name: 'TestEntity',
                properties: {
                    id: 'string',
                    name: 'string',
                },
            });
            const result = await callTool('clay_get_model_structure', {
                working_directory: testDir,
                model_path: modelPath,
            });
            (0, chai_1.expect)(result.success).to.be.true;
            (0, chai_1.expect)(result.result).to.have.property('success');
        });
    });
    describe('clay_list_helpers', () => {
        it.skip('should not crash when listing Handlebars helpers', async () => {
            await startServer();
            const result = await callTool('clay_list_helpers', {});
            (0, chai_1.expect)(result.success).to.be.true;
            (0, chai_1.expect)(result.result).to.have.property('success');
        });
    });
    describe('clay_explain_concepts', () => {
        it.skip('should return documentation for a topic', async () => {
            await startServer();
            const result = await callTool('clay_explain_concepts', {
                topic: 'overview',
            });
            (0, chai_1.expect)(result.success).to.be.true;
            (0, chai_1.expect)(result.result).to.have.property('success', true);
            (0, chai_1.expect)(result.result).to.have.property('content');
            if (result.result &&
                typeof result.result === 'object' &&
                'content' in result.result) {
                const content = result.result.content;
                (0, chai_1.expect)(content).to.include('Clay');
            }
        });
    });
    describe('clay_test_path', () => {
        it.skip('should not crash when testing a path', async () => {
            await startServer();
            const result = await callTool('clay_test_path', {
                working_directory: testDir,
                path: '.',
            });
            (0, chai_1.expect)(result.success).to.be.true;
            (0, chai_1.expect)(result.result).to.have.property('success');
        });
    });
});
//# sourceMappingURL=mcp-integration.test.js.map