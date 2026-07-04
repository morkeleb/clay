import fs from 'fs';
import path from 'path';
import type { ClayFile } from './types/clay-file';

const MARKER_START = '# clay:generated:start';
const MARKER_END = '# clay:generated:end';
const AUTOMERGE_LINE = '.clay merge=clay-generator';

/**
 * Update .gitattributes with linguist-generated markers for all
 * non-touch generated files tracked in the .clay manifest,
 * and the automerge driver attribute for .clay files.
 *
 * When automerge is enabled this also (re)installs the local git merge
 * driver config. The `.gitattributes` line is committed and shared, but
 * `git config merge.clay-generator.driver` is per-clone and never shared —
 * so without this a fresh clone has the attribute but no driver and git
 * silently falls back to a plain merge, conflicting on .clay. Installing it
 * here (idempotently) means any clone that runs `clay generate` self-heals.
 */
export function updateGitattributes(directory: string): void {
  const clayPath = path.join(directory, '.clay');
  if (!fs.existsSync(clayPath)) return;

  const data: ClayFile = JSON.parse(fs.readFileSync(clayPath, 'utf8'));

  if (!data.gitattributes && !data.automerge) return;

  if (data.automerge) {
    configureGitMergeDriver(directory, true);
  }

  // Collect all generated file paths across models
  const generatedFiles = new Set<string>();
  if (data.gitattributes) {
    for (const model of data.models) {
      for (const filePath of Object.keys(model.generated_files || {})) {
        generatedFiles.add(filePath);
      }
    }
  }

  const sorted = [...generatedFiles].sort();

  // Build the managed block
  const lines: string[] = [MARKER_START];
  if (data.automerge) {
    lines.push(AUTOMERGE_LINE);
  }
  for (const file of sorted) {
    // Quote paths containing spaces, #, or ! per gitattributes format
    const escaped =
      /[\s#!]/.test(file) ? `"${file.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : file;
    lines.push(`${escaped} linguist-generated=true`);
  }
  lines.push(MARKER_END);

  const managedBlock = lines.join('\n');

  const attrPath = path.join(directory, '.gitattributes');

  if (fs.existsSync(attrPath)) {
    const existing = fs.readFileSync(attrPath, 'utf8');
    const startIdx = existing.indexOf(MARKER_START);
    const endIdx = existing.indexOf(MARKER_END);

    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
      // Replace existing managed block
      const before = existing.slice(0, startIdx);
      const after = existing.slice(endIdx + MARKER_END.length);
      const updated = before + managedBlock + after;
      fs.writeFileSync(attrPath, updated, 'utf8');
    } else {
      // Append managed block
      const sep = existing.endsWith('\n') ? '' : '\n';
      fs.writeFileSync(attrPath, existing + sep + '\n' + managedBlock + '\n', 'utf8');
    }
  } else {
    fs.writeFileSync(attrPath, managedBlock + '\n', 'utf8');
  }
}

/**
 * Configure the git merge driver for .clay files in the local repo.
 */
export function configureGitMergeDriver(
  directory: string,
  enable: boolean = true
): void {
  const { execSync } = require('child_process');
  try {
    if (enable) {
      execSync(
        'git config merge.clay-generator.name "Clay auto-merge driver"',
        { cwd: directory, stdio: 'pipe' }
      );
      execSync(
        'git config merge.clay-generator.driver "clay merge-driver %O %A %B"',
        { cwd: directory, stdio: 'pipe' }
      );
    } else {
      execSync('git config --remove-section merge.clay-generator', {
        cwd: directory,
        stdio: 'pipe',
      });
    }
  } catch {
    // Not a git repo, git not available, or section doesn't exist — silently skip
  }
}
