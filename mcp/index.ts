#!/usr/bin/env node
/**
 * Clay MCP Server
 * Model Context Protocol server for Clay code generator
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tools
import { generateTool } from './tools/generate.js';
import { cleanTool } from './tools/clean.js';
import { testPathTool } from './tools/test-path.js';
import { initTool } from './tools/init.js';
import { listGeneratorsTool } from './tools/list-generators.js';
import { getModelStructureTool } from './tools/get-model-structure.js';

// Import utilities
import { isClayAvailable, getClayVersion } from './shared/clay-wrapper.js';

/**
 * Main MCP server class
 */
class ClayMCPServer {
  private server: Server;
  
  constructor() {
    this.server = new Server(
      {
        name: 'clay-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  /**
   * Setup tool request handlers
   */
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'clay_generate',
          description: 'Generate code from Clay models. Call without parameters to regenerate all models tracked in .clay file, or specify model_path and output_path for a specific model.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file (optional - if omitted, all models in .clay are regenerated)',
              },
              output_path: {
                type: 'string',
                description: 'Output directory for generated files (required if model_path is specified)',
              },
            },
          },
        },
        {
          name: 'clay_clean',
          description: 'Clean up generated files tracked in the .clay file. Removes all tracked files or files from a specific model.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Optional: clean only files from this specific model',
              },
              output_path: {
                type: 'string',
                description: 'Required if model_path is specified',
              },
            },
          },
        },
        {
          name: 'clay_test_path',
          description: 'Test JSONPath expressions against a Clay model to see what data they select.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Path to model.json file',
              },
              json_path: {
                type: 'string',
                description: 'JSONPath expression to test (e.g., "$.model.types[*].name")',
              },
            },
            required: ['model_path', 'json_path'],
          },
        },
        {
          name: 'clay_init',
          description: 'Initialize a Clay project (create .clay file) or a new generator structure.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory where to create .clay file or generator (defaults to current working directory)',
              },
              type: {
                type: 'string',
                enum: ['project', 'generator'],
                default: 'project',
                description: 'What to initialize: project creates .clay file, generator creates generator structure',
              },
              name: {
                type: 'string',
                description: 'Generator name (required when type=generator)',
              },
            },
          },
        },
        {
          name: 'clay_list_generators',
          description: 'List all generators used in the project models.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              show_details: {
                type: 'boolean',
                default: false,
                description: 'Include detailed information about generator steps',
              },
            },
          },
        },
        {
          name: 'clay_get_model_structure',
          description: 'Get the structure of Clay models in the project. Shows model metadata and optionally the full structure.',
          inputSchema: {
            type: 'object',
            properties: {
              working_directory: {
                type: 'string',
                description: 'Directory containing .clay file (defaults to current working directory)',
              },
              model_path: {
                type: 'string',
                description: 'Specific model to inspect (if omitted, shows all models)',
              },
              include_mixins: {
                type: 'boolean',
                default: false,
                description: 'Execute mixins before returning model structure',
              },
            },
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'clay_generate':
            return await generateTool(args || {});
          case 'clay_clean':
            return await cleanTool(args || {});
          case 'clay_test_path':
            return await testPathTool(args || {});
          case 'clay_init':
            return await initTool(args || {});
          case 'clay_list_generators':
            return await listGeneratorsTool(args || {});
          case 'clay_get_model_structure':
            return await getModelStructureTool(args || {});
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: `Error executing ${name}: ${errorMessage}`,
              }, null, 2),
            },
          ],
        };
      }
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Check if Clay is available
    if (!isClayAvailable()) {
      console.error('ERROR: Clay CLI is not available in PATH');
      console.error('Please install Clay globally: npm install -g clay-generator');
      process.exit(1);
    }

    const version = getClayVersion();
    console.error(`Clay MCP Server starting (Clay version: ${version})...`);

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('Clay MCP Server running on stdio');
  }
}

// Start the server
const server = new ClayMCPServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
