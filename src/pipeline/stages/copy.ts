// src/pipeline/stages/copy.ts
import fs from 'fs-extra';
import path from 'path';
import * as ui from '../../output';
import type { ClayModelEntry } from '../../types/clay-file';

/**
 * Copy a file or directory to the output directory.
 * Not a streaming stage — copy is inherently a batch filesystem operation.
 */
export async function executeCopy(
  source: string,
  outputDir: string,
  modelIndex: ClayModelEntry
): Promise<void> {
  await fs.ensureDir(outputDir);

  const stat = await fs.lstat(source);
  let dest: string;

  if (stat.isFile()) {
    dest = path.join(outputDir, path.basename(source));
  } else {
    dest = outputDir;
  }

  ui.copy(source, dest);
  await fs.copy(source, dest);

  // Track in index
  const relFile = path.relative(process.cwd(), dest);
  const normalizedPath = relFile.split(path.sep).join('/');
  if (!modelIndex.generated_files[normalizedPath]) {
    modelIndex.generated_files[normalizedPath] = {
      md5: '',
      date: new Date().toISOString(),
    };
  }
}
