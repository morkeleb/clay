import { PostGenerateHook, type HookContext } from '../../../src/code-generator';
import fs from 'fs';
import path from 'path';

export default class extends PostGenerateHook {
  async run({ data, helpers, touchFiles, outputDir, generatedFiles }: HookContext): Promise<void> {
    // Write a marker file to prove the hook ran
    const markerPath = path.join(outputDir, `hook-ran-${data.name || 'default'}.txt`);
    const content = [
      `name: ${data.name || 'no-name'}`,
      `touchFiles: ${touchFiles.length}`,
      `generatedFiles: ${generatedFiles.length}`,
      `hasHelpers: ${typeof helpers.pascalCase === 'function'}`,
    ].join('\n');
    fs.mkdirSync(path.dirname(markerPath), { recursive: true });
    fs.writeFileSync(markerPath, content, 'utf-8');
  }
}
