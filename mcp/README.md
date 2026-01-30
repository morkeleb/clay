# Clay MCP Server

Model Context Protocol (MCP) server for Clay code generator. Enables AI assistants like Claude to reliably interact with Clay through structured, validated tools.

## What is This?

This MCP server provides a robust interface between AI assistants (Claude, Cline, etc.) and Clay, eliminating parameter hallucination and errors through type-safe, validated tool calls.

## Features

### 8 Core Tools

- **`clay_generate`** - Generate code from models (supports parameterless all-model regeneration)
- **`clay_clean`** - Clean up generated files tracked in .clay
- **`clay_test_path`** - Test JSONPath expressions against models
- **`clay_init`** - Initialize Clay projects or generators
- **`clay_list_generators`** - List all generators in project
- **`clay_get_model_structure`** - Inspect model structure and metadata
- **`clay_list_helpers`** - List all available Handlebars helpers with syntax and examples
- **`clay_explain_concepts`** - Get comprehensive documentation on Clay concepts

### 2 Built-in Prompts

- **`clay-getting-started`** - Complete guide to Clay architecture, project structure, and using basic tools (clean, generate)
- **`clay-workflow`** - Step-by-step workflow from project setup to code generation with real examples

### Key Benefits

✅ **Zero-parameter operations** - Call `clay_generate({})` to regenerate everything  
✅ **Working directory context** - Automatically uses project's .clay file  
✅ **Input validation** - Prevents invalid parameters before execution  
✅ **Structured responses** - Consistent JSON output for all operations  
✅ **Error handling** - Clear, actionable error messages  
✅ **Built-in prompts** - AI can learn Clay architecture and best practices instantly

## Prerequisites

- Node.js 18 or higher
- Clay installed globally: `npm install -g clay-generator`
- An MCP-compatible client (Claude Desktop or Cline)

## Installation

### 1. Install Dependencies

```bash
cd mcp
npm install
```

### 2. Build the Server

```bash
npm run build
```

The compiled server will be in `dist/index.js`.

## Setup with Claude Desktop

### Step 1: Build the MCP Server

```bash
cd /path/to/clay/mcp
npm install
npm run build
```

### Step 2: Configure Claude Desktop

Edit Claude's configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Add the Clay MCP server:

```json
{
  "mcpServers": {
    "clay": {
      "command": "node",
      "args": ["/absolute/path/to/clay/mcp/dist/index.js"],
      "env": {
        "CLAY_VERBOSE": "false"
      }
    }
  }
}
```

**Important:** Use absolute paths!

### Step 3: Restart Claude Desktop

The MCP server will now be available. Claude can see and call all 7 Clay tools.

## Setup with Cline (VS Code Extension)

### Step 1: Install Cline

```bash
code --install-extension saoudrizwan.claude-dev
```

### Step 2: Configure Cline

Open VS Code settings (JSON) and add:

```json
{
  "cline.mcpServers": {
    "clay": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp/dist/index.js"]
    }
  }
}
```

If Clay is in a different location, use an absolute path.

### Step 3: Reload VS Code

The Clay tools will be available in Cline within your workspace.

## Using Prompts

The Clay MCP server includes built-in prompts that teach AI assistants about Clay architecture and workflows. These are especially useful when you're starting a new project or onboarding someone (or an AI!) to Clay.

### Available Prompts

#### `clay-getting-started`

**Purpose:** Complete introduction to Clay architecture and basic tools

**What it covers:**
- Project structure and file organization
- Core concepts (models, generators, templates, .clay file)
- How to use `clay_init`, `clay_generate`, and `clay_clean`
- Best practices and common patterns
- Real examples with code snippets

**When to use:**
- Starting a new Clay project
- Teaching AI about your Clay setup
- Quick reference for architecture decisions

**How to use (in Claude Desktop):**
Simply reference the prompt in your conversation:
> "Use the clay-getting-started prompt to help me set up a new project"

Or Claude will automatically discover it when you ask about Clay basics.

#### `clay-workflow`

**Purpose:** Step-by-step guide through a complete Clay workflow

**What it covers:**
- Complete development cycle from init to generation
- Creating generators and configuring them
- Building models and testing them
- Iterating on templates
- Real-world example: Building a TypeScript DTO generator
- Common scenarios and how to handle them

**When to use:**
- Learning the Clay development process
- Understanding how pieces fit together
- Following a practical example from start to finish

**How to use (in Claude Desktop):**
> "Show me the clay-workflow to understand how to build a generator"

### How Prompts Work

Prompts are pre-written, comprehensive guides that the AI can access instantly. They provide:

✅ **Consistent knowledge** - Same information every time  
✅ **Comprehensive coverage** - No important details missed  
✅ **Structured learning** - Organized in logical progression  
✅ **Code examples** - Real, working examples  
✅ **Best practices** - Built-in guidance

When you mention Clay concepts or ask for help, Claude can pull in these prompts to give you accurate, detailed guidance based on your specific needs.

## Usage Examples

### Example 0: Learn Clay Basics

**You say to Claude:**

> "I want to learn how Clay works and set up my first project"

**Claude responds:**

Claude will automatically use the `clay-getting-started` prompt to provide comprehensive guidance on Clay architecture, explain the project structure, and walk you through using the basic tools.

### Example 1: Regenerate All Models

**You say to Claude:**

> "Regenerate all my Clay models"

**Claude calls:**

```json
clay_generate({})
```

**Result:**

```json
{
  "success": true,
  "message": "Successfully regenerated all models",
  "models_processed": 3,
  "details": [...]
}
```

### Example 2: Generate Specific Model

**You:**

> "Generate code for the users model"

**Claude:**

```json
clay_generate({
  "model_path": "./clay/users-model.json",
  "output_path": "./src"
})
```

### Example 3: Test JSONPath

**You:**

> "Show me all array-type parameters in my model"

**Claude:**

```json
clay_test_path({
  "model_path": "./clay/model.json",
  "json_path": "$.model.types[*].commands[*].parameters[?(@.type=='array')]"
})
```

### Example 4: Initialize New Project

**You:**

> "Set up a new Clay project"

**Claude:**

```json
clay_init({
  "type": "project"
})
```

## Tool Reference

### `clay_generate`

Generate code from Clay models.

**Parameters:**

- `working_directory` (optional): Directory containing .clay file
- `model_path` (optional): Specific model to generate
- `output_path` (optional): Output directory (required if model_path given)

**Behavior:**

- No parameters: Regenerates ALL models from .clay file
- With model_path: Generates that specific model

### `clay_clean`

Clean up generated files.

**Parameters:**

- `working_directory` (optional): Directory containing .clay file
- `model_path` (optional): Clean only this model's files
- `output_path` (optional): Required if model_path given

### `clay_test_path`

Test JSONPath expressions.

**Parameters:**

- `working_directory` (optional): Directory containing .clay file
- `model_path` (required): Path to model.json
- `json_path` (required): JSONPath expression to test

### `clay_init`

Initialize Clay project or generator.

**Parameters:**

- `working_directory` (optional): Where to initialize
- `type` (optional): 'project' or 'generator' (default: 'project')
- `name` (optional): Generator name (required if type='generator')

### `clay_list_generators`

List all generators in project.

**Parameters:**

- `working_directory` (optional): Directory containing .clay file
- `show_details` (optional): Include generator step details (default: false)

### `clay_get_model_structure`

Get model structure and metadata.

**Parameters:**

- `working_directory` (optional): Directory containing .clay file
- `model_path` (optional): Specific model to inspect
- `include_mixins` (optional): Execute mixins first (default: false)

### `clay_list_helpers`

List all available Handlebars helpers for templates. Essential for LLMs when creating or modifying Clay templates.

**Parameters:**

- `category` (optional): Filter by category (string, comparison, logic, iteration, formatting, math, type-check, utility)
- `include_examples` (optional): Include usage examples (default: false)

**Returns:**

- Complete list of 47+ Handlebars helpers
- Syntax and descriptions for each helper
- Available categories
- Clay-specific context variables (clay_model, clay_parent, clay_key, clay_json_key)

**Example Use Cases:**

- "What helpers can I use for string manipulation?"
- "Show me all comparison helpers with examples"
- "List all available helpers in the logic category"

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run build:watch
```

### Run Directly (for testing)

```bash
npm run dev
```

### Testing

The MCP server is tested as part of Clay's test suite. Tests verify:

- ✅ Server starts without errors
- ✅ Responds to initialization requests
- ✅ Lists all 7 tools correctly
- ✅ Handles JSON-RPC protocol correctly

Run tests from the main Clay directory:

```bash
# Run all tests including MCP server tests
npm test

# Run only MCP server tests
npm test -- --grep "MCP Server"
```

The tests use the `clay-mcp` binary in development mode, ensuring both source and compiled versions work correctly.

## Troubleshooting

### "Clay CLI is not available"

Ensure Clay is installed globally:

```bash
npm install -g clay-generator
clay --version
```

### "No .clay file found"

Run `clay_init` first to create a .clay file in your project.

### MCP Server Not Appearing in Claude

1. Check the config file path is correct
2. Ensure absolute paths are used
3. Restart Claude Desktop completely
4. Check Claude's developer console for errors

### Permission Errors

Make sure the MCP server has execute permissions:

```bash
chmod +x mcp/dist/index.js
```

## Why No Watch Mode?

The `clay watch` command is intentionally **not included** in the MCP server because:

- Watch is a long-running background process, not suited for MCP's request-response model
- Better managed directly via terminal or VS Code tasks
- LLMs can instruct users to run `clay watch` manually when needed

**To use watch mode:**

- Run `clay watch` in a separate terminal
- Or create a VS Code task for it

## Architecture

```
mcp/
├── index.ts                 # Main MCP server
├── shared/                  # Shared utilities
│   ├── schemas.ts          # Zod validation schemas
│   ├── workspace-manager.ts # Working directory context
│   ├── clay-wrapper.ts     # Clay CLI execution
│   └── validation.ts       # Input validation
└── tools/                  # Tool implementations
    ├── generate.ts
    ├── clean.ts
    ├── test-path.ts
    ├── init.ts
    ├── list-generators.ts
    ├── get-model-structure.ts
    └── list-helpers.ts
```

## License

ISC - Same as Clay

## Links

- [Clay Documentation](../README.md)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Implementation Plan](../MCP_SERVER_PLAN.md)
