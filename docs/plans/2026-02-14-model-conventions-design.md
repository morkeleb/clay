# Model Conventions Design

## Problem

Clay models need project-specific rules enforced — bidirectional relations, naming conventions, forbidden auto-generated fields, required fields. LLMs frequently violate these conventions when editing models (e.g. adding `created_at` to the model when templates already generate it). There's no mechanism to catch these errors before code generation.

## Approach

Add a `conventions` system to generators. Convention rules are JS functions defined in `generator.json` (inline or via Clay's existing `include` mechanism). They validate the expanded model and return error strings.

Conventions are checked:
- **On MCP mutations** — soft enforcement. The mutation writes successfully, but the response includes `convention_violations` as warnings. This allows multi-step changes (e.g. adding both sides of a bidirectional relation across two mutations).
- **On `clay generate`** — hard enforcement. Generation blocks if any conventions fail. This is the point of no return.

## Convention Structure

A convention is an object with three fields:

```json
{
  "name": "entity-names-pascal-case",
  "description": "Entity names must be PascalCase",
  "function": "(model) => model.entities.filter(e => e.name[0] !== e.name[0].toUpperCase()).map(e => `Entity '${e.name}' must be PascalCase`)"
}
```

- `name` — identifier for the convention
- `description` — human-readable explanation (shown in error context)
- `function` — JS function string that receives the model's `model` object (expanded, with includes resolved and mixins applied) and returns an array of error strings. Empty array means no violations.

## Generator Configuration

Conventions live in `generator.json` under a `conventions` key. Inline definitions and includes can be mixed:

```json
{
  "steps": [...],
  "conventions": [
    {
      "name": "no-auto-fields",
      "description": "Don't include fields that templates generate automatically",
      "function": "(model) => { const auto = ['created_at', 'updated_at']; return model.entities.flatMap(e => (e.fields || []).filter(f => auto.includes(f.name)).map(f => `${e.name}: remove auto-generated field '${f.name}'`)) }"
    },
    { "include": "conventions/bidirectional-relations.json" }
  ]
}
```

Includes use Clay's existing `executeIncludes` mechanism — the included JSON file contains the same convention object structure.

## Enforcement Points

### MCP Mutations (soft — warn)

After a mutation tool (`clay_model_add`, `clay_model_update`, `clay_model_delete`, `clay_model_rename`) successfully writes the model file:

1. Read the model's `generators` array
2. Resolve each generator path
3. Load `generator.json`, resolve includes in the `conventions` array
4. `eval()` each convention function (same as how mixins work)
5. Run each function against the expanded model
6. Return violations in the response

Response shape when violations exist:

```json
{
  "success": true,
  "message": "Added value at $.model.entities",
  "convention_violations": [
    {
      "generator": "typescript-api",
      "convention": "no-auto-fields",
      "errors": ["User: remove auto-generated field 'created_at'"]
    }
  ]
}
```

`convention_violations` is only present when there are violations. The mutation still succeeds — the LLM sees the warnings and can fix them with follow-up mutations.

Rationale for soft enforcement: multi-step changes (like bidirectional relations) are temporarily invalid between mutations. Blocking would make them impossible.

If generators can't be found (model not tracked, generators not set up yet), convention checking is skipped silently.

### `$schema` validation remains hard

`$schema` validation continues to block mutations (reject, don't write). Schema violations aren't multi-step — the data structure is just wrong. Conventions are a separate concern checked after the write.

### CLI Generate (hard — block)

The `clay generate` pipeline checks conventions before generating code. If any violations exist, generation fails with the full error list. This applies to both MCP `clay_generate` and command-line `clay generate`.

## Implementation Architecture

### Core module: `src/conventions.ts`

```typescript
loadConventions(generatorPath: string): Convention[]
// Reads generator.json, resolves includes in conventions array, returns convention objects

runConventions(conventions: Convention[], expandedModel: object): ConventionViolation[]
// Evals each function, runs against model, collects errors grouped by convention
```

Lives in the core Clay package so both MCP tools and CLI can use it.

### Generator schema update: `src/schemas/generator_schema.json`

Add `conventions` to the generator schema:

```json
{
  "conventions": {
    "type": "array",
    "items": {
      "oneOf": [
        {
          "type": "object",
          "required": ["name", "description", "function"],
          "properties": {
            "name": { "type": "string" },
            "description": { "type": "string" },
            "function": { "type": "string" }
          }
        },
        {
          "type": "object",
          "required": ["include"],
          "properties": {
            "include": { "type": "string" }
          }
        }
      ]
    }
  }
}
```

### MCP shared helper: `mcp/shared/conventions.ts`

Wraps the core `loadConventions` and `runConventions` for use by mutation tools. Handles generator path resolution using workspace context.

### Changes to existing files

- `src/command-line.ts` or `src/generator.ts` — add convention check before generation
- `mcp/tools/model-add.ts`, `model-update.ts`, `model-delete.ts`, `model-rename.ts` — add convention check after write, include violations in response
