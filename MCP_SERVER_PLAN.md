# Clay MCP Server - Implementation Plan

**Date:** November 9, 2025  
**Author:** GitHub Copilot  
**Status:** Planning Phase

## Executive Summary

This document outlines the plan to create a Model Context Protocol (MCP) server for Clay, enabling reliable LLM integration (Claude, Cline, etc.) with built-in validation and structured interactions that prevent parameter hallucination and errors.

## Table of Contents

1. [Background & Motivation](#background--motivation)
2. [What is MCP?](#what-is-mcp)
3. [Architecture Overview](#architecture-overview)
4. [MCP Tools Specification](#mcp-tools-specification)
5. [Implementation Plan](#implementation-plan)
6. [User Setup & Workflow](#user-setup--workflow)
7. [VS Code Integration](#vs-code-integration)
8. [Testing Strategy](#testing-strategy)
9. [Rollout Plan](#rollout-plan)

---

## Background & Motivation

### Current Problem

When using Clay with Claude or other LLMs, they frequently:

- Invent non-existent command parameters
- Change parameter order or format
- Make assumptions about file paths and structure
- Call commands incorrectly, leading to errors

### Why MCP is the Solution

The Model Context Protocol (MCP) provides:

- **Structured tool definitions** with typed parameters and validation
- **Native integration** with Claude Desktop and VS Code extensions
- **Schema-based validation** preventing invalid inputs
- **Clear error messages** that guide the LLM to correct usage
- **Local execution** with full file system access

---

## What is MCP?

### Overview

MCP (Model Context Protocol) is an open protocol developed by Anthropic that enables AI assistants to securely interact with local tools, data sources, and services. Think of it as a "USB-C for AI" - a standardized way for LLMs to connect to external systems.

### Key Concepts

**MCP Server:**

- A local process that exposes tools and resources
- Communicates via stdio (standard input/output)
- Can be written in TypeScript, Python, or other languages

**MCP Tools:**

- Structured function definitions with JSON schemas
- Input validation and type checking
- Return structured results to the LLM

**MCP Clients:**

- Claude Desktop (official)
- Cline (VS Code extension)
- Other MCP-compatible AI tools

### How It Works

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│             │  MCP    │              │  calls  │             │
│  Claude /   │────────▶│  MCP Server  │────────▶│  Clay CLI   │
│  Cline      │  stdio  │  (Node.js)   │         │             │
│             │◀────────│              │◀────────│             │
└─────────────┘ results └──────────────┘ output  └─────────────┘
```

---

## Architecture Overview

### Component Structure

```
clay/
├── mcp/                          # New MCP server directory
│   ├── package.json              # MCP server dependencies
│   ├── tsconfig.json             # TypeScript config for MCP
│   ├── index.ts                  # Main MCP server entry point
│   ├── tools/                    # MCP tool implementations
│   │   ├── generate.ts           # clay generate tool
│   │   ├── clean.ts              # clay clean tool
│   │   ├── test-path.ts          # clay test-path tool
│   │   ├── init.ts               # clay init tool
│   │   ├── list-generators.ts   # List available generators
│   │   └── get-model-structure.ts # Get model structure
│   ├── shared/                   # Shared utilities
│   │   ├── clay-wrapper.ts       # Wrapper for calling Clay CLI
│   │   ├── validation.ts         # Input validation helpers
│   │   ├── schemas.ts            # JSON schemas for tools
│   │   └── workspace-manager.ts  # Manages working directory context
│   └── README.md                 # MCP server documentation
├── src/                          # Existing Clay source
└── package.json                  # Main Clay package.json
```

### Technology Stack

- **Runtime:** Node.js 18+ (same as Clay)
- **Language:** TypeScript (consistent with Clay's codebase)
- **MCP SDK:** `@modelcontextprotocol/sdk` (official SDK)
- **IPC:** stdio transport (standard for MCP)
- **Validation:** Zod (already used in Clay)

### Working Directory Context

**Critical Design Principle:**

Clay operates on a **working directory** concept, similar to Git. The MCP server must:

1. **Track the current working directory** for each MCP client session
2. **Look for `.clay` file** in the working directory to understand project context
3. **Allow parameterless operations** when `.clay` file exists (e.g., just `clay generate`)
4. **Support explicit paths** when working outside a Clay project directory

**How .clay File Works:**

```json
{
  "models": [
    {
      "path": "./clay/model.json",
      "output": "./src",
      "generated_files": {
        "src/User.ts": {
          "md5": "abc123...",
          "date": "2025-11-09T10:30:00Z"
        }
      },
      "last_generated": "2025-11-09T10:30:00Z"
    }
  ]
}
```

The `.clay` file:
- Tracks all models in the project
- Records every generated file with MD5 checksum
- Enables incremental regeneration (only changes are written)
- Allows `clay generate` without arguments (regenerates ALL models)
- Supports clean operations to remove all tracked files

---

## MCP Tools Specification

### Tool 1: `clay_generate`

**Purpose:** Generate code from a Clay model using configured generators.

**Important:** This tool respects Clay's working directory context. When called without parameters, it regenerates ALL models tracked in the `.clay` file.

**Parameters:**

```typescript
{
  working_directory?: string;  // Directory containing .clay file (default: cwd)
  model_path?: string;         // Specific model to generate (optional)
  output_path?: string;        // Output directory (required if model_path specified)
}
```

**Behavior:**

1. **No parameters:** Looks for `.clay` file in `working_directory` (or cwd), regenerates ALL tracked models
2. **With model_path:** Generates only that specific model, updates `.clay` file
3. **No .clay file:** Returns error asking user to run `clay_init` first

**Returns:**

```typescript
{
  success: boolean;
  message: string;
  models_processed: number;        // How many models were generated
  total_files_generated: number;   // New files created
  total_files_updated: number;     // Existing files modified
  total_files_unchanged: number;   // Files with no changes (not written)
  details: Array<{                 // Per-model breakdown
    model_path: string;
    output_path: string;
    files_generated: number;
    files_updated: number;
    files_unchanged: number;
  }>;
}
```

**Example Usage:**

```json
// Regenerate all models in current directory
{}

// Regenerate all models in specific directory
{
  "working_directory": "/path/to/project"
}

// Generate specific model
{
  "model_path": "./clay/users-model.json",
  "output_path": "./src"
}
```

**Common Workflow:**
```
User: "Regenerate everything"
Claude: calls clay_generate({})
Result: All models in .clay file are regenerated
```

---

### Tool 2: `clay_clean`

**Purpose:** Clean up generated files tracked in the .clay file.

**Important:** Removes files based on what's tracked in `.clay` file. Safely removes only generated files, never touches source files.

**Parameters:**

```typescript
{
  working_directory?: string;  // Directory containing .clay file (default: cwd)
  model_path?: string;         // Optional: clean only this specific model
  output_path?: string;        // Required if model_path specified
}
```

**Behavior:**

1. **No parameters:** Cleans ALL files tracked in `.clay` for all models
2. **With model_path:** Cleans only files for that specific model
3. **Removes from disk AND updates .clay file** to reflect removed files

**Returns:**

```typescript
{
  success: boolean;
  message: string;
  models_cleaned: number;      // How many models were cleaned
  total_files_removed: number; // Total files deleted
  details: Array<{
    model_path: string;
    files_removed: number;
    files: string[];           // List of removed files
  }>;
}
```

**Example Usage:**

```json
// Clean all generated files in project
{}

// Clean specific model
{
  "model_path": "./clay/users-model.json",
  "output_path": "./src"
}
```

---

### Tool 3: `clay_test_path`

**Purpose:** Test JSONPath expressions against a model to see what data they select.

**Parameters:**

```typescript
{
  model_path: string; // Path to model.json (required)
  json_path: string; // JSONPath expression to test (required)
}
```

**Returns:**

```typescript
{
  success: boolean;
  results: any[];          // Array of matched objects
  count: number;           // Number of matches
  formatted_output: string; // Pretty-printed JSON
}
```

**Example:**

```json
{
  "model_path": "./clay/model.json",
  "json_path": "$.model.types[*].name"
}
```

---

### Tool 4: `clay_init`

**Purpose:** Initialize a new Clay project or generator.

**Important:** Creates `.clay` file which is essential for all other operations. This file tracks all models and generated files in the project.

**Parameters:**

```typescript
{
  working_directory?: string;      // Where to create .clay file (default: cwd)
  type?: 'project' | 'generator';  // What to initialize (default: 'project')
  name?: string;                   // Generator name (required if type='generator')
}
```

**Behavior:**

1. **type='project':** Creates empty `.clay` file with `{"models": []}`
2. **type='generator':** Creates generator directory structure under `clay/generators/{name}/`
3. **Fails if `.clay` already exists** (prevents accidental overwrites)

**Returns:**

```typescript
{
  success: boolean;
  message: string;
  created_files: string[];
  next_steps?: string[];  // Helpful suggestions for what to do next
}
```

**Example Usage:**

```json
// Initialize Clay project in current directory
{
  "type": "project"
}

// Initialize in specific directory
{
  "working_directory": "/path/to/new/project",
  "type": "project"
}

// Create new generator
{
  "type": "generator",
  "name": "api-endpoints"
}
```

---

### Tool 5: `clay_list_generators`

**Purpose:** List all generators referenced in models tracked by the project's `.clay` file.

**Parameters:**

```typescript
{
  working_directory?: string;  // Directory containing .clay file (default: cwd)
  show_details?: boolean;      // Include generator step details (default: false)
}
```

**Behavior:**

1. Reads `.clay` file to find all models
2. Loads each model to discover configured generators
3. Returns unique list of generators with metadata

**Returns:**

```typescript
{
  success: boolean;
  generators: Array<{
    name: string;
    path: string;
    used_by_models: string[];  // Which models use this generator
    steps_count: number;
    has_formatters: boolean;
    has_partials: boolean;
    steps?: Array<any>;        // Included if show_details=true
  }>;
}
```

**Example Usage:**

```json
// List all generators
{}

// Get detailed information
{
  "show_details": true
}
```

---

### Tool 6: `clay_get_model_structure`

**Purpose:** Get the structure of a Clay model for context/understanding.

**Parameters:**

```typescript
{
  working_directory?: string;  // Directory containing .clay file (default: cwd)
  model_path?: string;         // Specific model (if not provided, shows all models)
  include_mixins?: boolean;    // Execute mixins before returning (default: false)
}
```

**Behavior:**

1. **With model_path:** Returns structure of that specific model
2. **Without model_path:** Returns list of all models from `.clay` file
3. **include_mixins=true:** Processes model through mixins to show final structure

**Returns:**

```typescript
{
  success: boolean;
  models: Array<{
    path: string;
    output: string;
    name: string;
    generators: string[];
    model_keys: string[];    // Top-level keys in the model
    structure?: any;         // Full model (only if single model requested)
    file_count?: number;     // Files tracked for this model
    last_generated?: string; // ISO timestamp
  }>;
}
```

**Example Usage:**

```json
// List all models in project
{}

// Get specific model structure
{
  "model_path": "./clay/users-model.json",
  "include_mixins": true
}
```

---

## Implementation Plan

### Phase 1: Core MCP Server Setup (Week 1)

**Tasks:**

1. Create `mcp/` directory structure
2. Set up MCP TypeScript project with dependencies
3. Implement basic MCP server with stdio transport
4. Create server registration and initialization logic
5. Add basic error handling and logging

**Deliverables:**

- Working MCP server that can start and accept connections
- Basic health check/ping tool for testing

---

### Phase 2: Core Tools Implementation (Week 2)

**Tasks:**

1. Implement **workspace-manager** utility
   - Track working directory for MCP session
   - Detect and validate `.clay` file presence
   - Provide helpers for relative/absolute path resolution
2. Implement `clay_generate` tool
   - Support parameterless call (regenerate all from `.clay`)
   - Support single model generation
   - Validate inputs with Zod schemas
   - Call Clay CLI via wrapper with correct working directory
   - Parse and return structured output with per-model details
3. Implement `clay_clean` tool
   - Support cleaning all models or specific model
   - Track files removed
4. Implement `clay_test_path` tool
5. Implement `clay_init` tool
   - Create `.clay` file or generator structure

**Key Implementation Detail:**

All tools must execute Clay CLI commands **in the correct working directory**. The wrapper must:

```typescript
// Example wrapper pattern
async function executeClayCommand(
  command: string,
  args: string[],
  workingDirectory: string
): Promise<CommandResult> {
  return execSync(`clay ${command} ${args.join(' ')}`, {
    cwd: workingDirectory,
    encoding: 'utf8'
  });
}
```

**Deliverables:**

- 4 fully functional MCP tools
- Workspace manager utility
- Unit tests for each tool
- Input validation schemas

**Tasks:**

1. Implement `clay_generate` tool
   - Validate inputs with Zod schemas
   - Call Clay CLI via wrapper
   - Parse and return structured output
2. Implement `clay_clean` tool
3. Implement `clay_test_path` tool
4. Implement `clay_init` tool

**Deliverables:**

- 4 fully functional MCP tools
- Unit tests for each tool
- Input validation schemas

---

### Phase 3: Enhanced Tools & Features (Week 3)

**Tasks:**

1. Implement `clay_list_generators` tool
2. Implement `clay_get_model_structure` tool
3. Enhance error messages and validation feedback
4. Add progress reporting for long-running operations
5. Improve working directory context handling

**Note on Watch Feature:**

The `clay watch` command is intentionally **not included** in the MCP server because:
- Watch is a long-running background process, not suited for MCP's request-response model
- Users can run `clay watch` directly in their terminal for better control
- VS Code users should use VS Code tasks to manage watch processes
- LLMs can instruct users to run watch mode manually when needed
- Simplifies MCP server implementation and process management

**Deliverables:**

- 2 additional tools (`clay_list_generators`, `clay_get_model_structure`)
- Enhanced error handling
- Progress indicators
- Documentation on when to use `clay watch` manually

---

### Phase 4: Documentation & Integration (Week 4)

**Tasks:**

1. Write comprehensive MCP server README
2. Create setup guides for:
   - Claude Desktop
   - Cline (VS Code)
   - Generic MCP clients
3. Add troubleshooting guide
4. Create example workflows and demos
5. Update main Clay README with MCP information

**Deliverables:**

- Complete documentation
- Setup tutorials
- Example projects

---

## User Setup & Workflow

### Prerequisites

- Node.js 18 or higher
- Clay installed globally or locally
- An MCP-compatible client (Claude Desktop or Cline)

---

### Setup: Claude Desktop

**Step 1: Build the MCP Server**

```bash
cd /path/to/clay
cd mcp
npm install
npm run build
```

**Step 2: Configure Claude Desktop**

Edit Claude's configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%/Claude/claude_desktop_config.json`  
**Linux:** `~/.config/Claude/claude_desktop_config.json`

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

**Step 3: Restart Claude Desktop**

The MCP server will now be available in Claude.

---

### Setup: Cline (VS Code Extension)

**Step 1: Install Cline Extension**

```bash
code --install-extension saoudrizwan.claude-dev
```

**Step 2: Configure Cline**

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

**Note:** If Clay is in a different location, use absolute path.

**Step 3: Reload VS Code**

The Clay tools will be available in Cline.

---

### Workflow Example: Generating Code with Claude

**Scenario 1: First-time generation**

**User Prompt:**
> "Generate code for my user model using Clay"

**Claude's Actions:**

1. Calls `clay_get_model_structure({})` to see what models exist
2. Calls `clay_generate({ model_path: "./clay/users-model.json", output_path: "./src" })`
3. Reports results

**User sees:**
```
✓ Model: ./clay/users-model.json
✓ Generated 12 files
✓ Updated 0 files
✓ 0 files unchanged
```

---

**Scenario 2: Regenerating everything after model changes**

**User Prompt:**
> "I updated my models, regenerate everything"

**Claude's Actions:**

1. Calls `clay_generate({})` with no parameters
2. Clay reads `.clay` file and regenerates ALL tracked models

**User sees:**
```
✓ Processed 3 models
✓ Generated 5 files
✓ Updated 18 files
✓ 34 files unchanged (no changes needed)

Details:
  - users-model.json: 2 generated, 8 updated, 15 unchanged
  - products-model.json: 3 generated, 6 updated, 12 unchanged
  - orders-model.json: 0 generated, 4 updated, 7 unchanged
```

**No more hallucinated parameters!** Claude uses the exact MCP tool schema, and Clay's `.clay` file context means minimal parameters needed.

---

**Scenario 3: Working in VS Code with Cline**

**User in VS Code:**
> Opens project with `.clay` file
> 
> "@clay regenerate my code"

**Cline's Actions:**

1. Detects workspace folder from VS Code context
2. Calls `clay_generate({ working_directory: "${workspaceFolder}" })`
3. Shows inline results in chat

**Benefits:**
- Automatic working directory detection from VS Code
- All models regenerated with one command
- Results shown in context

---

### Workflow Example: Testing JSONPath

**User Prompt:**
> "Show me all array-type parameters in my model"

**Claude's Actions:**

1. Calls `clay_get_model_structure({})` to find models
2. Calls `clay_test_path` with:
   ```json
   {
     "model_path": "./clay/users-model.json",
     "json_path": "$.model.types[*].commands[*].parameters[?(@.type=='array')]"
   }
   ```
3. Shows the user the formatted results

**Benefit:** JSONPath expressions are validated before execution, preventing syntax errors.

---

### Workflow Example: Starting a New Project

**User Prompt:**
> "Set up a new Clay project for me"

**Claude's Actions:**

1. Calls `clay_init({ type: 'project' })`
2. Suggests next steps based on the result

**User sees:**
```
✓ Created .clay file
✓ Your Clay project is initialized!

Next steps:
  1. Create your first model in ./clay/model.json
  2. Add generators to the model
  3. Run clay_generate to generate code
```

**Claude then offers:**
> "Would you like me to create a sample model for you?"

---

## VS Code Integration

**No more hallucinated parameters!** Claude uses the exact MCP tool schema.

---

### Workflow Example: Testing JSONPath

**User Prompt:**

> "Show me all array-type parameters in my model"

**Claude's Actions:**

1. Calls `clay_test_path` with:
   ```json
   {
     "model_path": "./clay/model.json",
     "json_path": "$.model.types[*].commands[*].parameters[?(@.type=='array')]"
   }
   ```
2. Shows the user the formatted results

**Benefit:** JSONPath expressions are validated before execution.

---

## VS Code Integration

### Recommended Extensions

**For Best Experience:**

1. **Cline** - Claude in VS Code with MCP support
2. **GitHub Copilot** - Can use enhanced copilot-instructions.md
3. **MCP Inspector** (if available) - Debug MCP connections

---

### VS Code Tasks (Complementary)

While MCP is the primary integration, we can also add VS Code tasks for manual execution:

**.vscode/tasks.json:**

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Clay: Generate",
      "type": "shell",
      "command": "clay",
      "args": ["generate"],
      "problemMatcher": [],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    {
      "label": "Clay: Clean",
      "type": "shell",
      "command": "clay",
      "args": ["clean"],
      "problemMatcher": []
    }
  ]
}
```

---

### Workspace Settings

**.vscode/settings.json:**

```json
{
  "files.associations": {
    "*.clay": "json",
    "generator.json": "json"
  },
  "files.exclude": {
    "**/dist": true,
    "**/coverage": true
  }
}
```

---

## Testing Strategy

### Unit Tests

**Location:** `mcp/test/`

**Framework:** Mocha + Chai (consistent with Clay)

**Coverage:**

- Each MCP tool in isolation
- Input validation (valid and invalid inputs)
- Error handling scenarios
- Clay CLI wrapper functionality

**Example Test:**

```typescript
describe('clay_generate tool', () => {
  it('should work with working directory and .clay file', async () => {
    // Setup test project with .clay file
    const testDir = '/tmp/test-clay-project';
    fs.writeFileSync(
      path.join(testDir, '.clay'),
      JSON.stringify({
        models: [
          { path: './clay/model.json', output: './src' }
        ]
      })
    );
    
    // Call with just working_directory
    const result = await tools.clay_generate({
      working_directory: testDir
    });
    
    expect(result.success).to.be.true;
    expect(result.models_processed).to.equal(1);
  });

  it('should regenerate all models when no parameters provided', async () => {
    // Test that it uses cwd and finds .clay file
    const result = await tools.clay_generate({});
    expect(result.success).to.be.true;
    expect(result.models_processed).to.be.greaterThan(0);
  });
  
  it('should require .clay file or explicit parameters', async () => {
    // No .clay file, no parameters
    const result = await tools.clay_generate({
      working_directory: '/tmp/no-clay-here'
    });
    expect(result.success).to.be.false;
    expect(result.message).to.include('.clay file not found');
  });
});
```

---

### Integration Tests

**Approach:**

1. Create test Clay projects in `mcp/test/fixtures/` with:
   - `.clay` files tracking multiple models
   - Sample models with different structures
   - Generators with various step types
2. Run MCP server in test mode
3. Call tools via MCP protocol
4. Verify outputs and side effects
5. Test working directory context changes

**Critical Test Cases:**

- **Parameterless regeneration:** Verify all models in `.clay` are processed
- **Partial regeneration:** Single model updates `.clay` correctly
- **Clean operations:** Only tracked files are removed
- **Path resolution:** Relative paths work from working directory
- **Multi-model projects:** Multiple models managed correctly

---

### Manual Testing Checklist

- [ ] Claude Desktop can connect to MCP server
- [ ] Cline can connect to MCP server
- [ ] **Parameterless `clay_generate` regenerates all models from `.clay`**
- [ ] **Working directory context is correctly maintained**
- [ ] **Single model generation updates `.clay` file properly**
- [ ] Each tool executes successfully
- [ ] Error messages are clear and actionable
- [ ] File system changes are tracked correctly in `.clay`
- [ ] **Incremental generation only writes changed files**
- [ ] Server handles crashes gracefully
- [ ] Logging output is helpful for debugging
- [ ] **Multi-model projects work correctly**

---

## Rollout Plan

### Alpha Release (Internal Testing)

**Timeline:** Week 5

**Audience:** Clay contributors and early adopters

**Goals:**

- Validate core functionality
- Gather initial feedback
- Identify edge cases

**Distribution:**

- GitHub branch: `feature/mcp-server`
- Documentation in MCP_SERVER_PLAN.md (this doc)

---

### Beta Release

**Timeline:** Week 6-8

**Audience:** Clay users who work with Claude/AI tools

**Goals:**

- Test with real-world projects
- Refine documentation
- Fix reported issues

**Distribution:**

- Merge to `main` branch
- Add to Clay README
- Announce in GitHub Discussions

---

### Stable Release

**Timeline:** Week 9+

**Goals:**

- Include in next Clay version
- Full documentation
- Video tutorial (optional)

**Distribution:**

- npm package includes MCP server
- Listed in MCP server registry (if available)
- Blog post / announcement

---

## Success Metrics

### Technical Metrics

- **Error Rate:** < 5% of MCP tool calls fail
- **Response Time:** < 2 seconds for generate operations
- **Test Coverage:** > 80% for MCP tools

### User Metrics

- **Setup Time:** < 10 minutes from README to working integration
- **User Satisfaction:** Positive feedback from beta testers
- **Adoption:** 20%+ of active Clay users try MCP integration

---

## Security Considerations

### File System Access

**Risk:** MCP server has full file system access

**Mitigation:**

- MCP server runs with user's permissions (not elevated)
- All file operations logged
- Validate and sanitize all paths
- Restrict operations to project workspace where possible

### Input Validation

**Risk:** Malicious or malformed inputs

**Mitigation:**

- Zod schema validation on all inputs
- JSONPath expression validation before execution
- Command injection prevention (no shell execution of user input)
- **Working directory validation:** Ensure paths are within expected bounds
- **Path traversal prevention:** Validate all file paths before operations

### Secrets & Credentials

**Risk:** Accidental exposure of secrets

**Mitigation:**

- No credential storage in MCP server
- Environment variables not logged
- `.clay` file should not contain secrets

### Working Directory Isolation

**Risk:** Operations affecting unintended directories

**Mitigation:**

- Always validate `.clay` file presence before operations
- Log all file operations with full paths
- Require explicit confirmation for operations outside project root
- Fail safe: If `.clay` file not found and no explicit paths given, return error

---

## Future Enhancements

### Phase 2 Features (Post-Launch)

1. **Resource API:** Expose Clay models as MCP resources
   - LLMs can read model structure directly
   - Auto-completion suggestions for JSONPath

2. **Streaming Support:** Real-time progress updates
   - Long-running generations show progress
   - File-by-file generation updates

3. **Prompt Templates:** Built-in prompts for common tasks
   - "Create CRUD operations for entity X"
   - "Add validation to all commands"

4. **Generator Marketplace Integration:**
   - Browse generators via MCP
   - Install generators through Claude

5. **Generator Management Tools:**
   - Add/remove generators via MCP
   - Update generators from registry
   - Create custom generators interactively

### Features Intentionally Excluded

**Watch Mode (`clay watch`):**

Not included because:
- Long-running background processes don't fit MCP's request-response model
- Better managed directly via terminal or VS Code tasks
- Process lifecycle management adds unnecessary complexity
- LLMs can guide users to run `clay watch` manually

**Alternative for VS Code users:**
- Create a VS Code task that runs `clay watch`
- LLM can help set up the task configuration
- User controls watch process through VS Code UI

**For terminal users:**
- LLM instructs: "Run `clay watch` in a separate terminal"
- User has full control over the watch process

---

## Appendix

### A. MCP Resources

- **Official Docs:** https://modelcontextprotocol.io/
- **SDK Repository:** https://github.com/modelcontextprotocol/typescript-sdk
- **Example Servers:** https://github.com/modelcontextprotocol/servers

### B. Glossary

- **MCP:** Model Context Protocol
- **Tool:** A function exposed by MCP server that LLMs can call
- **Resource:** Read-only data exposed by MCP server
- **Prompt:** Templated instructions for LLMs
- **Transport:** Communication method (stdio, HTTP, WebSocket)

### C. FAQ

**Q: Do I need to rebuild the MCP server after updating Clay?**  
A: No, the MCP server calls the global `clay` command, so Clay updates are automatically used.

**Q: Can I use this with GitHub Copilot?**  
A: GitHub Copilot doesn't support MCP yet, but the enhanced copilot-instructions.md still helps.

**Q: Does this work on Windows?**  
A: Yes, Node.js and MCP work cross-platform. Paths may need adjustment in config.

**Q: Can I debug the MCP server?**  
A: Yes, set `CLAY_VERBOSE=true` in the MCP config and check logs in Claude's developer tools.

**Q: How does the working directory context work?**  
A: The MCP server maintains the working directory context from where the LLM client is running. For VS Code/Cline, it uses the workspace folder. For Claude Desktop, it uses the current directory where Claude was launched or can be explicitly set via the `working_directory` parameter.

**Q: What if I have multiple models in my project?**  
A: Perfect! The `.clay` file tracks all your models. Just call `clay_generate({})` with no parameters, and all models will be regenerated. You can also target specific models with the `model_path` parameter.

**Q: Does the MCP server modify my .clay file?**  
A: Yes, when you generate or clean code, the MCP server updates the `.clay` file to track which files were generated, their checksums, and timestamps. This enables incremental generation and safe cleaning.

**Q: What happens if I call clay_generate without a .clay file?**  
A: If there's no `.clay` file and you don't provide explicit `model_path` and `output_path` parameters, the tool will return an error asking you to run `clay_init` first to create the `.clay` file.

**Q: Why isn't `clay watch` included in the MCP server?**  
A: Watch mode is a long-running background process that doesn't fit the MCP request-response model. It's better to run `clay watch` directly in a terminal or as a VS Code task. The LLM can guide you to set this up manually. This keeps the MCP server focused on discrete operations that work well with LLM interactions.

**Q: How do I use watch mode with my project?**  
A: Run `clay watch` in a separate terminal, or create a VS Code task. The LLM can help you set up a task configuration. This gives you better control over the watch process (start/stop/restart) compared to managing it through the MCP server.

---

## Conclusion

The Clay MCP server will provide a robust, type-safe interface for LLMs to interact with Clay, eliminating parameter hallucination and errors. With clear documentation and easy setup, VS Code users will be able to integrate Claude and other AI assistants seamlessly into their Clay workflows.

**Core MCP Tools:**
- ✅ `clay_generate` - Generate code from models (with parameterless all-model regeneration)
- ✅ `clay_clean` - Clean up generated files
- ✅ `clay_test_path` - Test JSONPath expressions
- ✅ `clay_init` - Initialize projects
- ✅ `clay_list_generators` - List available generators
- ✅ `clay_get_model_structure` - Inspect model structure

**Not Included:**
- ❌ `clay_watch` - Use terminal or VS Code tasks instead

**Next Steps:**

1. Review and approve this plan
2. Begin Phase 1 implementation
3. Set up development environment
4. Create initial MCP server skeleton

---

**Document Version:** 1.1  
**Last Updated:** November 9, 2025  
**Changelog:**
- v1.1: Removed watch tool, added working directory context support, enhanced tool specifications
- v1.0: Initial plan  
**Maintained By:** Clay Development Team
