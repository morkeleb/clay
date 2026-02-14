# MCP Model CRUD Tools Design

## Problem

Clay model JSON files can become large, and working with them through an AI assistant currently requires loading the entire file into context. The MCP server needs tools to query, add, update, and delete model data without reading/writing the whole file.

## Approach

Add 6 new fine-grained MCP tools, each doing one thing well. This matches the existing pattern where each tool has a focused purpose (e.g. `clay_generate`, `clay_clean`, `clay_test_path`).

Tools operate directly on model JSON files via `fs` + JSONPath (no CLI wrapping), consistent with how `get-model-structure.ts` already works.

## Tools

### clay_model_query

Query model data using JSONPath. Returns only matched items, not the whole file.

```typescript
// Input
{ model_path: string, json_path: string }
// Output
{ success: true, count: number, results: any[] }
```

Example: `json_path: "$.model.entities[?(@.name=='User')]"` returns just the User entity.

### clay_model_add

Add an item to an array or a property to an object at a JSONPath location.

```typescript
// Input
{ model_path: string, json_path: string, value: any }
// Output
{ success: true, message: string, path: string }
```

If `json_path` resolves to an array, `value` is appended. If it resolves to an object, `value` is merged as properties.

### clay_model_update

Update fields on all items matched by JSONPath.

```typescript
// Input
{ model_path: string, json_path: string, fields: Record<string, any> }
// Output
{ success: true, message: string, matched: number }
```

Merges `fields` into every matched item. Example: add `tableName` to User entity.

### clay_model_delete

Remove items matched by JSONPath from their parent arrays/objects.

```typescript
// Input
{ model_path: string, json_path: string }
// Output
{ success: true, message: string, removed: number }
```

### clay_model_rename

Rename a property key across all items matched by JSONPath.

```typescript
// Input
{ model_path: string, json_path: string, old_name: string, new_name: string }
// Output
{ success: true, message: string, renamed: number }
```

Example: rename `fields` to `columns` on all entities.

### clay_model_set_schema

Set or update the `$schema` reference on a model file.

```typescript
// Input
{ model_path: string, schema_path: string }
// Output
{ success: true, message: string, validation_warnings?: string[] }
```

Sets the `$schema` property to the given path. Validates current model against the schema and returns warnings for any violations (but still writes the reference).

## Schema Validation

Uses the standard `$schema` convention — a top-level property referencing an external JSON Schema file:

```json
{
  "$schema": "./schemas/api-model.schema.json",
  "name": "UserAPI",
  "generators": ["typescript-api"],
  "model": { ... }
}
```

Schema is **optional**. When present:
- All mutation tools (`add`, `update`, `delete`, `rename`) validate the resulting `model` against the schema before writing
- If validation fails, the mutation is rejected with detailed error messages
- If no `$schema` is present, mutations just ensure valid JSON

The schema file is resolved relative to the model file's directory. Validated using **Ajv** (standard JSON Schema library).

## Addressing

All tools use **JSONPath** expressions to address items, consistent with existing Clay concepts (generator steps, `clay_test_path`).

## Implementation Architecture

### New files

```
mcp/
├── tools/
│   ├── model-query.ts
│   ├── model-add.ts
│   ├── model-update.ts
│   ├── model-delete.ts
│   ├── model-rename.ts
│   └── model-set-schema.ts
├── shared/
│   ├── schemas.ts              # + 6 new Zod input schemas
│   └── model-file.ts           # NEW: shared read/write/validate
└── index.ts                    # + 6 new tool registrations
```

### Shared helper: model-file.ts

- `readModelFile(modelPath)` — reads and parses model JSON
- `writeModelFile(modelPath, data)` — validates against `$schema` if present, writes with `JSON.stringify(data, null, 2)` + trailing newline
- `validateAgainstSchema(modelData, schemaPath)` — loads schema file, validates with Ajv, returns errors

### Dependencies

- **Ajv** — JSON Schema validation (new dependency for mcp package)
- **jsonpath** — already a dependency in main Clay package (add to mcp package)

### No CLI changes

These tools operate directly on JSON files. No changes to the Clay CLI itself.

## Error Handling

- **Path matches nothing**: `query` returns empty results; mutation tools return error `"No items matched"`
- **Invalid JSONPath syntax**: error before any file read
- **`$schema` file not found**: error with path details
- **Schema validation fails**: error with Ajv's detailed messages, mutation not written
- **Model file not found**: clear error message
- **Unknown top-level properties**: preserved (never stripped)

## File Formatting

All writes use `JSON.stringify(data, null, 2)` with trailing newline. This may normalize indentation on first mutation.
