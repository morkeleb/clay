import { expect } from 'chai';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('check-generated', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-check-gen-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.removeSync(tmpDir);
  });

  async function getModule() {
    return await import('../src/check-generated');
  }

  describe('checkGenerated', () => {
    it('returns allowed when no .clay file exists', async () => {
      const { checkGenerated } = await getModule();
      const result = checkGenerated(path.resolve('src/foo.ts'));
      expect(result.blocked).to.equal(false);
    });

    it('returns allowed when file is not in manifest', async () => {
      const { checkGenerated } = await getModule();
      fs.writeFileSync(
        path.resolve('.clay'),
        JSON.stringify({
          models: [
            {
              path: './clay/model.json',
              output: '.',
              generated_files: {
                'src/other.ts': { md5: 'abc', date: '2025-01-01' },
              },
            },
          ],
        })
      );

      const result = checkGenerated(path.resolve('src/foo.ts'));
      expect(result.blocked).to.equal(false);
    });

    it('returns blocked when file is in manifest', async () => {
      const { checkGenerated } = await getModule();
      fs.writeFileSync(
        path.resolve('.clay'),
        JSON.stringify({
          models: [
            {
              path: './clay/model.json',
              output: '.',
              generated_files: {
                'src/foo.ts': { md5: 'abc', date: '2025-01-01' },
              },
            },
          ],
        })
      );

      const result = checkGenerated(path.resolve('src/foo.ts'));
      expect(result.blocked).to.equal(true);
      expect(result.message).to.include('src/foo.ts');
      expect(result.message).to.include('Clay');
    });

    it('checks across multiple models in manifest', async () => {
      const { checkGenerated } = await getModule();
      fs.writeFileSync(
        path.resolve('.clay'),
        JSON.stringify({
          models: [
            {
              path: './clay/model1.json',
              output: '.',
              generated_files: {},
            },
            {
              path: './clay/model2.json',
              output: '.',
              generated_files: {
                'src/bar.ts': { md5: 'def', date: '2025-01-01' },
              },
            },
          ],
        })
      );

      const result = checkGenerated(path.resolve('src/bar.ts'));
      expect(result.blocked).to.equal(true);
    });

    it('returns allowed when file_path is empty', async () => {
      const { checkGenerated } = await getModule();
      const result = checkGenerated('');
      expect(result.blocked).to.equal(false);
    });

    it('returns allowed when file is outside project root', async () => {
      const { checkGenerated } = await getModule();
      fs.writeFileSync(
        path.resolve('.clay'),
        JSON.stringify({ models: [] })
      );

      const result = checkGenerated('/some/other/path/file.ts');
      expect(result.blocked).to.equal(false);
    });
  });

  describe('parseHookInput', () => {
    it('extracts file_path from JSON', async () => {
      const { parseHookInput } = await getModule();
      const result = parseHookInput('{"file_path": "/foo/bar.ts"}');
      expect(result).to.equal('/foo/bar.ts');
    });

    it('returns empty string for invalid JSON', async () => {
      const { parseHookInput } = await getModule();
      const result = parseHookInput('not json');
      expect(result).to.equal('');
    });

    it('returns empty string when file_path missing', async () => {
      const { parseHookInput } = await getModule();
      const result = parseHookInput('{"other": "value"}');
      expect(result).to.equal('');
    });
  });
});
