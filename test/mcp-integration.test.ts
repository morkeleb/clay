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
      const proc = serverProcess;
      proc.kill('SIGTERM');
      await new Promise((resolve) => {
        // Clear the SIGKILL fallback once the process exits — a leaked
        // timer here would kill the NEXT test's server via the shared
        // serverProcess variable.
        const killTimer = setTimeout(() => {
          proc.kill('SIGKILL');
          resolve(undefined);
        }, 2000);
        proc.once('exit', () => {
          clearTimeout(killTimer);
          resolve(undefined);
        });
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
    // Drain stderr so the server can never block on a full pipe buffer
    serverProcess.stderr!.resume();

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

      // Buffer stdout across chunks — a large response is split over
      // multiple 'data' events and can only be parsed once its full
      // newline-terminated line has arrived.
      let buffered = '';
      const dataHandler = (data: Buffer) => {
        buffered += data.toString();
        const lines = buffered.split('\n');
        buffered = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
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
            // Not JSON (e.g. log line) — ignore
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
    it('should fail gracefully if no .clay file exists and no model provided', async () => {
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

  describe('clay_generate precheck failures', () => {
    it('reports precheck violations in the error result', async function () {
      this.timeout(20000);

      // Project with a generator whose precheck always fails
      const genDir = path.join(testDir, 'badgen');
      await fs.ensureDir(path.join(genDir, 'checks'));
      await fs.writeJson(path.join(genDir, 'generator.json'), {
        preChecks: [{ run: 'checks/fail.ts' }],
        steps: [],
      });
      await fs.writeFile(
        path.join(genDir, 'checks', 'fail.ts'),
        `export default class {
  check() {
    return ['cloudkit invariant broken'];
  }
}
`
      );
      await fs.writeJson(path.join(testDir, 'model.json'), {
        name: 'precheck-test',
        generators: ['./badgen'],
        model: { types: [] },
      });
      await fs.writeJson(path.join(testDir, '.clay'), {
        models: [{ path: 'model.json', output: 'out', generated_files: {} }],
      });

      await startServer();

      const result = await callTool('clay_generate', {
        working_directory: testDir,
      });

      expect(result.success).to.be.true;
      expect(result.result).to.have.property('success', false);
      const r = result.result as {
        message: string;
        precheck_violations?: string[];
      };
      expect(r.message).to.include('cloudkit invariant broken');
      expect(r.precheck_violations).to.be.an('array').with.lengthOf(1);
      expect(r.precheck_violations![0]).to.include('cloudkit invariant broken');
    });
  });

  describe('clay_list_generators', () => {
    it('should not crash when listing generators', async () => {
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
    it('should return model structure when .clay file exists', async function() {
      this.timeout(15000);
      
      // Manually create .clay file without calling clay_init
      const clayFilePath = path.join(testDir, '.clay');
      const modelPath = path.join(testDir, 'test-model.json');
      
      await fs.writeJson(modelPath, {
        name: 'TestEntity',
        properties: {
          id: 'string',
          name: 'string',
        },
      });

      await fs.writeJson(clayFilePath, {
        models: [
          {
            path: 'test-model.json',
            output: './output',
            generated_files: {},
          },
        ],
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      await startServer();

      const result = await callTool('clay_get_model_structure', {
        working_directory: testDir,
        model_path: 'test-model.json',
      });

      expect(result.success).to.be.true;
      expect(result.result).to.have.property('success', true);
      expect(result.result).to.have.property('models');
      
      const models = (result.result as { models: unknown[] }).models;
      expect(models).to.be.an('array').with.lengthOf(1);
      expect(models[0]).to.have.property('name', 'test-model');
      expect(models[0]).to.have.property('model_keys');
      expect((models[0] as { model_keys: string[] }).model_keys).to.include.members(['name', 'properties']);
      expect(models[0]).to.have.property('structure');
      expect((models[0] as { structure: { name: string } }).structure).to.have.property('name', 'TestEntity');
    });

    it('should return all models when no model_path specified', async function() {
      this.timeout(15000); // Increase timeout for this specific test
      
      // Manually create .clay file and models
      const clayFilePath = path.join(testDir, '.clay');
      const model1Path = path.join(testDir, 'model1.json');
      const model2Path = path.join(testDir, 'model2.json');
      
      await fs.writeJson(model1Path, { name: 'Model1' });
      await fs.writeJson(model2Path, { name: 'Model2' });

      await fs.writeJson(clayFilePath, {
        models: [
          { path: 'model1.json', output: './output1', generated_files: {} },
          { path: 'model2.json', output: './output2', generated_files: {} },
        ],
      });

      // Small delay before starting server
      await new Promise(resolve => setTimeout(resolve, 100));

      await startServer();

      const result = await callTool('clay_get_model_structure', {
        working_directory: testDir,
      });

      expect(result.success).to.be.true;
      expect(result.result).to.have.property('success', true);
      
      const models = (result.result as { models: unknown[] }).models;
      expect(models).to.be.an('array').with.lengthOf(2);
      expect(models[0]).to.have.property('name', 'model1');
      expect(models[1]).to.have.property('name', 'model2');
    });

    it('should handle absolute paths correctly', async function() {
      this.timeout(15000);
      
      // Manually create .clay file and model
      const clayFilePath = path.join(testDir, '.clay');
      const modelPath = path.join(testDir, 'absolute-test.json');
      
      await fs.writeJson(modelPath, { name: 'AbsoluteTest' });

      await fs.writeJson(clayFilePath, {
        models: [
          {
            path: 'absolute-test.json',
            output: './output',
            generated_files: {},
          },
        ],
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      await startServer();

      // Query with absolute path
      const result = await callTool('clay_get_model_structure', {
        working_directory: testDir,
        model_path: modelPath, // absolute path
      });

      expect(result.success).to.be.true;
      expect(result.result).to.have.property('success', true);
      
      const models = (result.result as { models: unknown[] }).models;
      expect(models).to.be.an('array').with.lengthOf(1);
      expect(models[0]).to.have.property('name', 'absolute-test');
      expect((models[0] as { structure: { name: string } }).structure).to.have.property('name', 'AbsoluteTest');
    });
  });

  describe('clay_list_helpers', () => {
    it('should not crash when listing Handlebars helpers', async () => {
      await startServer();

      const result = await callTool('clay_list_helpers', {});

      expect(result.success).to.be.true;
      // Tool might fail if Clay isn't installed, but should return structured response
      expect(result.result).to.have.property('success');
    });
  });

  describe('clay_explain_concepts', () => {
    it('should return documentation for a topic', async () => {
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
    it('should not crash when testing a path', async () => {
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
