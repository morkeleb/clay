/**
 * Per-model orphan cleanup for non-touch generated files.
 *
 * After a successful generate pass, removes files listed in this model entry's
 * generated_files that were not produced again (including hash-skipped paths).
 * Never walks the filesystem for discovery; never touches other models' ledgers.
 *
 * Touch paths that appear this pass are treated as protected (kept if still
 * listed in the ledger) so flipping a step to touch:true cannot delete scaffolds.
 */
import fs from 'fs-extra';
import path from 'path';
import * as ui from './output';
import { normalizeClayPath } from './clay_file';
import type { ClayModelEntry } from './types/clay-file';

export interface OrphanCleanupResult {
  removedFromIndex: string[];
  deletedFromDisk: string[];
}

export interface RemoveOrphanOptions {
  modelIndex: ClayModelEntry;
  /**
   * Normalized relative paths still owned or protected this pass.
   * Must include hash-skipped non-touch outputs and touch paths seen this pass.
   */
  expected: ReadonlySet<string>;
  /** All model entries in .clay — used only to avoid unlinking shared disk paths. */
  allModels: readonly ClayModelEntry[];
  /**
   * Extra paths that must not be unlinked this pass even if missing from expected
   * (e.g. paths marked expected by a sibling model still running). Prefer unioning
   * into a global disk-claim set at the barrier instead when possible.
   */
  diskClaimedByOthers?: ReadonlySet<string>;
}

function isClaimedByOtherModel(
  file: string,
  current: ClayModelEntry,
  allModels: readonly ClayModelEntry[]
): boolean {
  for (const m of allModels) {
    if (m === current) continue;
    if (m.generated_files?.[file]) return true;
  }
  return false;
}

/**
 * Drop empty parent directories after unlinking, walking upward until a non-empty
 * dir or cwd. Does not walk the whole output tree.
 */
function pruneEmptyParents(filePath: string): void {
  let dir = path.dirname(path.resolve(filePath));
  const root = process.cwd();
  while (dir && dir !== root && dir !== path.dirname(dir)) {
    if (!fs.existsSync(dir) || !fs.lstatSync(dir).isDirectory()) break;
    const entries = fs.readdirSync(dir);
    if (entries.length > 0) break;
    fs.rmdirSync(dir);
    ui.warn('Removed empty directory', dir);
    dir = path.dirname(dir);
  }
}

/**
 * True when a tracked non-touch file is missing on disk — generate must not
 * input-hash-skip, or inventory/md5 will stay frozen while the tree is broken.
 */
export function hasMissingGeneratedFiles(modelIndex: ClayModelEntry): boolean {
  for (const file of Object.keys(modelIndex.generated_files || {})) {
    const abs = path.isAbsolute(file) ? file : path.resolve(file);
    if (!fs.existsSync(abs)) return true;
  }
  return false;
}

/**
 * Reconcile this model entry's generated_files with paths produced this pass.
 * - Always removes orphan keys from the current model index.
 * - Unlinks disk only when no other model entry still claims the path.
 * - Only unlinks regular files (never recursive directory wipes).
 */
export function removeOrphanGeneratedFiles(
  options: RemoveOrphanOptions
): OrphanCleanupResult {
  const { modelIndex, expected, allModels, diskClaimedByOthers } = options;
  const removedFromIndex: string[] = [];
  const deletedFromDisk: string[] = [];

  const previous = Object.keys(modelIndex.generated_files || {});
  for (const file of previous) {
    if (expected.has(file)) continue;

    removedFromIndex.push(file);
    modelIndex.delFileCheckSum(file);

    if (isClaimedByOtherModel(file, modelIndex, allModels)) {
      continue;
    }
    if (diskClaimedByOthers?.has(file)) {
      continue;
    }

    const abs = path.isAbsolute(file) ? file : path.resolve(file);
    if (!fs.existsSync(abs)) {
      continue;
    }

    // Never recursive-delete directory keys from copy steps — only regular files.
    const stat = fs.lstatSync(abs);
    if (!stat.isFile() && !stat.isSymbolicLink()) {
      ui.warn('skipping orphan non-file path', file);
      continue;
    }

    ui.warn('removing orphan', file);
    fs.removeSync(abs);
    deletedFromDisk.push(file);
    pruneEmptyParents(abs);
  }

  return { removedFromIndex, deletedFromDisk };
}

/**
 * Mark a path as still owned/protected this pass.
 * Touch and non-touch are treated the same for sweep membership: any path
 * still selected this pass must not be deleted (protects scaffolds when a
 * step was flipped to touch:true but remains in the ledger).
 */
export function markOwnedPath(expected: Set<string>, filePath: string): void {
  expected.add(normalizeClayPath(filePath));
}
