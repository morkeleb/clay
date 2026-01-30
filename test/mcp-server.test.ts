import { expect } from 'chai';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * MCP Server Tests
 *
 * These tests verify that the MCP server:
 * 1. Binary exists and is executable
 * 2. Server starts successfully
 * 3. Server responds to basic JSON-RPC requests
 */
describe('MCP Server', function () {
  this.timeout(15000); // MCP server startup can take a few seconds

  const mcpBin = path.join(__dirname, '..', 'bin', 'clay-mcp');
  const mcpDist = path.join(__dirname, '..', 'mcp', 'dist', 'index.js');
  const mcpSource = path.join(__dirname, '..', 'mcp', 'index.ts');

  describe('Installation', () => {
    it('should have clay-mcp binary', () => {
      expect(fs.existsSync(mcpBin)).to.be.true;
    });

    it('should have MCP source or compiled files', () => {
      const hasSource = fs.existsSync(mcpSource);
      const hasDist = fs.existsSync(mcpDist);
      expect(
        hasSource || hasDist,
        'Neither source nor compiled MCP files found'
      ).to.be.true;
    });
  });

  describe('Server Startup', () => {
    let serverProcess: ChildProcess | null = null;

    afterEach((done) => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.once('exit', () => done());
        serverProcess.kill('SIGTERM');
        setTimeout(() => {
          if (serverProcess && !serverProcess.killed) {
            serverProcess.kill('SIGKILL');
          }
        }, 2000);
      } else {
        done();
      }
    });

    it('should start without crashing', (done) => {
      serverProcess = spawn('node', [mcpBin], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let crashed = false;
      serverProcess.on('exit', (code) => {
        if (code !== null && code !== 0 && code !== 143 && code !== 130) {
          crashed = true;
        }
      });

      // Wait 3 seconds to see if it crashes
      setTimeout(() => {
        expect(crashed, 'Server crashed on startup').to.be.false;
        expect(serverProcess?.killed).to.be.false;
        done();
      }, 3000);
    });

    it('should respond to initialization', (done) => {
      serverProcess = spawn('node', [mcpBin], {
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

      serverProcess.stdout?.on('data', (data: Buffer) => {
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
              expect(response.result).to.have.property('serverInfo');
              done();
              return;
            }
          } catch {
            // Not JSON or not complete yet
          }
        }
      });

      // Send initialization request
      setTimeout(() => {
        serverProcess?.stdin?.write(JSON.stringify(initRequest) + '\n');
      }, 1000);
    });
  });

  describe('Tool Discovery', () => {
    let serverProcess: ChildProcess | null = null;

    afterEach((done) => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.once('exit', () => done());
        serverProcess.kill('SIGTERM');
        setTimeout(() => {
          if (serverProcess && !serverProcess.killed) {
            serverProcess.kill('SIGKILL');
          }
        }, 2000);
      } else {
        done();
      }
    });

    it('should list 8 Clay tools', (done) => {
      serverProcess = spawn('node', [mcpBin], {
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

      serverProcess.stdout?.on('data', (data: Buffer) => {
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
              expect(tools).to.be.an('array');
              expect(tools.length).to.equal(8);

              const toolNames = tools.map((t: { name: string }) => t.name);
              expect(toolNames).to.include('clay_generate');
              expect(toolNames).to.include('clay_clean');
              expect(toolNames).to.include('clay_test_path');
              expect(toolNames).to.include('clay_init');
              expect(toolNames).to.include('clay_list_generators');
              expect(toolNames).to.include('clay_get_model_structure');
              expect(toolNames).to.include('clay_list_helpers');
              expect(toolNames).to.include('clay_explain_concepts');

              done();
              return;
            }
          } catch {
            // Not JSON or not complete yet
          }
        }
      });

      // Send tools/list request after a delay
      setTimeout(() => {
        serverProcess?.stdin?.write(JSON.stringify(listToolsRequest) + '\n');
      }, 1000);
    });

    it('should list 2 Clay prompts', (done) => {
      serverProcess = spawn('node', [mcpBin], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let promptsReceived = false;
      const listPromptsRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'prompts/list',
        params: {},
      };

      const timeoutId = setTimeout(() => {
        if (!promptsReceived) {
          done(new Error('Server did not respond to prompts/list'));
        }
      }, 5000);

      serverProcess.stdout?.on('data', (data: Buffer) => {
        const lines = data
          .toString()
          .split('\n')
          .filter((l) => l.trim());
        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (
              response.id === 3 &&
              response.result &&
              response.result.prompts
            ) {
              promptsReceived = true;
              clearTimeout(timeoutId);

              const prompts = response.result.prompts;
              expect(prompts).to.be.an('array');
              expect(prompts.length).to.equal(2);

              const promptNames = prompts.map((p: { name: string }) => p.name);
              expect(promptNames).to.include('clay-getting-started');
              expect(promptNames).to.include('clay-workflow');

              done();
              return;
            }
          } catch {
            // Not JSON or not complete yet
          }
        }
      });

      // Send prompts/list request after a delay
      setTimeout(() => {
        serverProcess?.stdin?.write(JSON.stringify(listPromptsRequest) + '\n');
      }, 1000);
    });
  });
});
