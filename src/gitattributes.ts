import fs from 'fs';
import path from 'path';
import type { ClayFile } from './types/clay-file';

const MARKER_START = '# clay:generated:start';
const MARKER_END = '# clay:generated:end';

/**
 * Update .gitattributes with linguist-generated markers for all
 * non-touch generated files tracked in the .clay manifest.
 */
export function updateGitattributes(directory: string): void {
  const clayPath = path.join(directory, '.clay');
  if (!fs.existsSync(clayPath)) return;

  const data: ClayFile = JSON.parse(fs.readFileSync(clayPath, 'utf8'));

  if (!data.gitattributes) return;

  // Collect all generated file paths across models
  const generatedFiles = new Set<string>();
  for (const model of data.models) {
    for (const filePath of Object.keys(model.generated_files || {})) {
      generatedFiles.add(filePath);
    }
  }

  const sorted = [...generatedFiles].sort();

  // Build the managed block
  const lines: string[] = [MARKER_START];
  for (const file of sorted) {
    lines.push(`${file} linguist-generated=true`);
  }
  lines.push(MARKER_END);

  const managedBlock = lines.join('\n');

  const attrPath = path.join(directory, '.gitattributes');

  if (fs.existsSync(attrPath)) {
    const existing = fs.readFileSync(attrPath, 'utf8');
    const startIdx = existing.indexOf(MARKER_START);
    const endIdx = existing.indexOf(MARKER_END);

    if (startIdx !== -1 && endIdx !== -1) {
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
