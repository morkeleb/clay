import fs from 'fs';

/**
 * Raw .clay data as serialized to disk (without runtime methods).
 */
interface ClayModel {
  path: string;
  output?: string;
  generated_files: Record<string, { md5: string; date?: string }>;
  last_generated?: string;
}

interface ClayData {
  models: ClayModel[];
  [key: string]: unknown;
}

function parseClayFile(filePath: string): ClayData {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function modelKey(m: ClayModel): string {
  return JSON.stringify([m.path, m.output || '']);
}

/**
 * Three-way merge of .clay files.
 *
 * Strategy:
 * - Models added on either side (not in ancestor) are included.
 * - Models deleted on one side (in ancestor but not in that side) stay deleted.
 * - Models present on both sides are merged: union of generated_files,
 *   keeping the newer entry when both sides have the same file.
 * - Config flags use last-writer-wins: if a side changed a flag from the
 *   ancestor value, that change is taken. If both sides changed, theirs wins.
 */
export function mergeClayFiles(
  ancestorPath: string,
  oursPath: string,
  theirsPath: string
): ClayData {
  const ancestor = parseClayFile(ancestorPath);
  const ours = parseClayFile(oursPath);
  const theirs = parseClayFile(theirsPath);

  const merged: ClayData = { models: [] };

  // Merge config flags with three-way logic
  const allConfigKeys = new Set<string>();
  for (const obj of [ancestor, ours, theirs]) {
    for (const key of Object.keys(obj)) {
      if (key !== 'models') allConfigKeys.add(key);
    }
  }
  for (const key of allConfigKeys) {
    const ancestorVal = ancestor[key];
    const oursVal = ours[key];
    const theirsVal = theirs[key];

    if (oursVal !== ancestorVal && theirsVal !== ancestorVal) {
      // Both sides changed — theirs wins
      merged[key] = theirsVal;
    } else if (oursVal !== ancestorVal) {
      merged[key] = oursVal;
    } else if (theirsVal !== ancestorVal) {
      merged[key] = theirsVal;
    } else {
      merged[key] = ancestorVal;
    }
  }
  // Clean up undefined/false config values
  for (const key of allConfigKeys) {
    if (merged[key] === undefined || merged[key] === false) {
      delete merged[key];
    }
  }

  // Build maps keyed by path+output
  const ancestorMap = new Map<string, ClayModel>();
  for (const m of ancestor.models) ancestorMap.set(modelKey(m), m);

  const oursMap = new Map<string, ClayModel>();
  for (const m of ours.models) oursMap.set(modelKey(m), m);

  const theirsMap = new Map<string, ClayModel>();
  for (const m of theirs.models) theirsMap.set(modelKey(m), m);

  const allKeys = new Set([
    ...ancestorMap.keys(),
    ...oursMap.keys(),
    ...theirsMap.keys(),
  ]);

  for (const key of allKeys) {
    const inAncestor = ancestorMap.has(key);
    const ourModel = oursMap.get(key);
    const theirModel = theirsMap.get(key);

    // Deletion detection: if model was in ancestor but removed by one side, respect the deletion
    if (inAncestor && !ourModel && theirModel) continue; // ours deleted it
    if (inAncestor && ourModel && !theirModel) continue; // theirs deleted it
    if (inAncestor && !ourModel && !theirModel) continue; // both deleted it

    if (ourModel && theirModel) {
      // Both sides have this model — merge generated_files
      const mergedFiles: Record<string, { md5: string; date?: string }> = {
        ...ourModel.generated_files,
      };
      for (const [file, entry] of Object.entries(
        theirModel.generated_files || {}
      )) {
        const existing = mergedFiles[file];
        if (
          !existing ||
          (entry.date && (!existing.date || entry.date > existing.date))
        ) {
          mergedFiles[file] = entry;
        }
      }

      const lastGen =
        (ourModel.last_generated || '') >= (theirModel.last_generated || '')
          ? ourModel.last_generated
          : theirModel.last_generated;

      merged.models.push({
        path: ourModel.path,
        output: ourModel.output,
        generated_files: mergedFiles,
        last_generated: lastGen,
      });
    } else {
      // Only one side has this model (and it wasn't in ancestor, so it's an addition)
      merged.models.push((ourModel || theirModel)!);
    }
  }

  return merged;
}

/**
 * Git merge driver entry point.
 * Git calls: clay merge-driver %O %A %B
 * %O = ancestor, %A = ours (result written here), %B = theirs
 * Exit 0 = success (conflict resolved), non-zero = conflict.
 */
export function runMergeDriver(
  ancestorPath: string,
  oursPath: string,
  theirsPath: string
): boolean {
  try {
    const merged = mergeClayFiles(ancestorPath, oursPath, theirsPath);
    fs.writeFileSync(
      oursPath,
      JSON.stringify(merged, null, 2) + '\n',
      'utf8'
    );
    return true;
  } catch {
    return false;
  }
}
