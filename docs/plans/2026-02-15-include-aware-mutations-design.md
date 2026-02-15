# Include-Aware Mutations Design

## Problem

Clay models support `include` references that pull in data from external JSON files. The MCP mutation tools (`clay_model_add`, `clay_model_update`, `clay_model_delete`, `clay_model_rename`) currently operate on the raw model file, which means JSONPath queries can't find data that lives inside included files. An entity defined via `{ "include": "entities/user.json" }` appears as just that reference in the raw file — its fields, relations, and other properties are invisible to queries.

## Approach

**Query expanded, edit source.** Mutation tools query the expanded model (includes resolved) to find targets using JSONPath, then trace each target back to its source file (main model or included file) to make the actual edit.

This is done via an **include map** — a `Map<object, string>` built during include resolution that records which objects came from which files. Since `executeIncludes` merges properties into the same JS object that had the `include` property, object identity is preserved and can be used as the map key.

## Include Map

### How it's built

During `executeIncludes`, when an object with an `include` property is found:

1. Resolve the include file path
2. Load and merge the included data into the object
3. Record `map.set(object, resolvedFilePath)` in the include map

Since `executeIncludes` recurses, nested includes each get their own entry.

### New function: `loadWithIncludeMap`

Added to `src/model.ts` alongside the existing `load()`:

```typescript
export function loadWithIncludeMap(modelPath: string): {
  model: ClayModel;
  includeMap: Map<object, string>;
}
```

Runs the same logic as `load()` (includes then mixins) but also builds and returns the include map. The existing `load()` stays unchanged.

## Tracing Targets to Source Files

When a mutation tool finds a target via JSONPath on the expanded model:

1. Get the full path from `jp.paths()` — e.g., `['$', 'model', 'entities', 0, 'fields']`
2. Walk the expanded model from `$` down each path segment
3. At each step, check if the current object is in the include map
4. If an ancestor at `['$', 'model', 'entities', 0]` is in the map:
   - **Source file**: `includeMap.get(ancestor)` — e.g., `entities/user.json`
   - **Relative path within that file**: remaining segments — `['fields']`
5. Read the included file, apply the mutation at the relative path, write it back

If no ancestor is in the include map, it's a main-file mutation — use the current raw read/mutate/write approach.

## Mutation Flow (revised)

1. Load expanded model with include map
2. Query expanded model with JSONPath to find targets
3. For each target, trace ancestry to determine source file
4. Group mutations by source file
5. For each source file:
   - If included file: read it, apply mutation at relative path, write it back
   - If main model: read raw, apply mutation at the JSONPath on the raw data, write back
6. If main model has `$schema`: re-expand and validate the full model
7. Check conventions (warnings)

## Edge Cases

### Multiple targets across files

A JSONPath like `$.model.entities[*].fields` could match fields in entities from different included files and the main file. Each target is traced independently. A single mutation call may write to multiple files.

### Delete of an included entity

Deleting an entity that came from an include removes the `{ "include": "..." }` entry from the main model file's array. It does NOT delete the included file (it might be shared across models).

### Writing included files

Included files are plain JSON objects — no `name`, `generators`, or `$schema` wrapper. They're written as `JSON.stringify(data, null, 2) + '\n'`.

### Schema validation after include-file writes

After mutating an included file, the tool re-expands the model and validates against `$schema` if present. This ensures the overall model stays schema-valid even when the change was in an included file.

## Changes to Existing Code

### `src/model.ts`

Add `loadWithIncludeMap()`. Existing `load()` unchanged.

### `mcp/shared/model-file.ts`

Add `readExpandedModelWithIncludeMap()` that calls the new core function.

### `mcp/shared/include-writer.ts` (new)

Helper that takes a target object, the include map, the expanded model, and the JSONPath, and determines:
- Which file to edit (included or main)
- The path within that file
- Reads, mutates, and writes the correct file

### Mutation tools

`model-add.ts`, `model-update.ts`, `model-delete.ts`, `model-rename.ts` switch from "query raw" to "query expanded, trace to source, edit source."

### Unchanged

- `model-query.ts` — already queries expanded model
- `model-set-schema.ts` — operates on top-level `$schema`
- Convention checking — still runs on expanded model after mutations

## Response Shape

When the edit goes to an included file, the response includes `source_file`:

```json
{
  "success": true,
  "message": "Added value at $.model.entities[?(@.name=='User')].fields",
  "path": "$.model.entities[?(@.name=='User')].fields",
  "source_file": "entities/user.json"
}
```

When a multi-target mutation spans multiple files:

```json
{
  "success": true,
  "message": "Updated 3 item(s) at $.model.entities[*]",
  "matched": 3,
  "files_modified": ["model.json", "entities/user.json", "entities/order.json"]
}
```

Both fields are only present when relevant (omitted for simple main-file edits).
