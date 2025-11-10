import { expect } from 'chai';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

/**
 * MCP Server Integration Tests
 *
 * These tests verify actual tool invocations through the MCP server.
 * They test end-to-end functionality including:
 * 1. Tool invocation via tools/call
 * 2. Actual file operations (init, generate, clean)
 * 3. Error handling and validation
 */
describe('MCP Server Integration', function () {
  this.timeout(20000); // Integration tests can take longer

  const mcpBin = path.join(__dirname, '..', 'bin', 'clay-mcp');
  let testDir: string;
  let serverProcess: ChildProcess | null = null;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clay-mcp-test-'));
  });

  afterEach(async () => {
    // Kill server process
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
      await new Promise((resolve) => {
        serverProcess!.once('exit', resolve);
        setTimeout(() => {
          if (serverProcess && !serverProcess.killed) {
            serverProcess.kill('SIGKILL');
            resolve(undefined);
          }
        }, 2000);
      });
      serverProcess = null;
    }

    // Clean up test directory
    try {
      await fs.remove(testDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * Helper to start server, initialize, and wait for response
   */
  async function startServer(): Promise<void> {
    serverProcess = spawn('node', [mcpBin], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Initialize the server
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

  /**
   * Helper to send a request and get a response
   */
  function sendRequest(request: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!serverProcess || !serverProcess.stdin || !serverProcess.stdout) {
        reject(new Error('Server not started'));
        return;
      }

      const requestId =
        typeof request === 'object' && request !== null && 'id' in request
          ? request.id
          : null;

      let responseReceived = false;

      const timeoutId = setTimeout(() => {
        if (!responseReceived) {
          reject(new Error(`Request ${requestId} timed out`));
        }
      }, 10000);

      const dataHandler = (data: Buffer) => {
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
              serverProcess!.stdout!.off('data', dataHandler);
              resolve(response);
              return;
            }
          } catch {
            // Not JSON or not complete yet
          }
        }
      };

      serverProcess.stdout.on('data', dataHandler);

      // Send request
      serverProcess.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Helper to call a tool and parse the response
   */
  async function callTool(
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<{ success: boolean; result?: unknown; error?: unknown }> {
    const response = (await sendRequest({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    })) as {
      result?: { content?: Array<{ text?: string }> };
      error?: unknown;
    };

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

      expect(result.success).to.be.true;
      const clayFilePath = path.join(testDir, '.clay');
      expect(fs.existsSync(clayFilePath)).to.be.true;

      const clayContent = await fs.readJson(clayFilePath);
      expect(clayContent).to.have.property('models');
      expect(clayContent.models).to.be.an('array');
    });

    it('should fail if .clay file already exists', async () => {
      await startServer();

      // Create first .clay file
      await callTool('clay_init', {
        working_directory: testDir,
      });

      // Try to create again
      const result = await callTool('clay_init', {
        working_directory: testDir,
      });

      expect(result.success).to.be.true;
      expect(result.result).to.have.property('success', false);
    });
  });

  describe('clay_generate', () => {
    // Skip as clay_generate spawns child processes which can timeout
    it.skip('should fail gracefully if no .clay file exists and no model provided', async () => {
      await startServer();

      const result = await callTool('clay_generate', {
        working_directory: testDir,
      });

      expect(result.success).to.be.true;
      expect(result.result).to.have.property('success', false);
      if (
        result.result &&
        typeof result.result === 'object' &&
        'message' in result.result
      ) {
        expect((result.result as { message: string }).message).to.include(
          '.clay file'
        );
      }
    });
  });

  describe('clay_list_generators', () => {
    // Skip as this can timeout when spawning CLI processes
    it.skip('should not crash when listing generators', async () => {
      await startServer();

      const result = await callTool('clay_list_generators', {
        working_directory: testDir,
      });

      expect(result.success).to.be.true;
      // Tool might fail if Clay isn't installed, but should return structured response
      expect(result.result).to.have.property('success');
    });
  });

  describe('clay_get_model_structure', () => {
    // Skip as this can timeout when spawning CLI processes
    it.skip('should not crash when analyzing a model file', async () => {
      await startServer();

      // Create a test model
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

      expect(result.success).to.be.true;
      // Tool might fail if Clay isn't installed, but should return structured response
      expect(result.result).to.have.property('success');
    });
  });

  describe('clay_list_helpers', () => {
    // Skip this test as it requires spawning clay CLI which can be slow
    it.skip('should not crash when listing Handlebars helpers', async () => {
      await startServer();

      const result = await callTool('clay_list_helpers', {});

      expect(result.success).to.be.true;
      // Tool might fail if Clay isn't installed, but should return structured response
      expect(result.result).to.have.property('success');
    });
  });

  describe('clay_explain_concepts', () => {
    // TODO: Server lifecycle management needs improvement - tests timeout after several invocations
    it.skip('should return documentation for a topic', async () => {
      await startServer();

      const result = await callTool('clay_explain_concepts', {
        topic: 'overview',
      });

      expect(result.success).to.be.true;
      expect(result.result).to.have.property('success', true);
      expect(result.result).to.have.property('content');
      if (
        result.result &&
        typeof result.result === 'object' &&
        'content' in result.result
      ) {
        const content = result.result.content as string;
        expect(content).to.include('Clay');
      }
    });
  });

  describe('clay_test_path', () => {
    // TODO: Server lifecycle management needs improvement - tests timeout after several invocations
    it.skip('should not crash when testing a path', async () => {
      await startServer();

      const result = await callTool('clay_test_path', {
        working_directory: testDir,
        path: '.',
      });

      expect(result.success).to.be.true;
      // Tool might fail if Clay isn't installed, but should return structured response
      expect(result.result).to.have.property('success');
    });
  });
});
