// src/pipeline/file-target.ts
import path from 'path';

export function withClayFileTarget(
  modelData: unknown,
  outputDir: string,
  filename: string
): unknown {
  // Arrays are iterated by templates; a property on one would leak into {{#each}}.
  if (
    typeof modelData !== 'object' ||
    modelData === null ||
    Array.isArray(modelData)
  ) {
    return modelData;
  }
  const clay_file_target = path
    .relative(path.resolve(outputDir), filename)
    .split(path.sep)
    .join('/');
  return { ...modelData, clay_file_target };
}
