// test/pipeline/copy-command.test.ts
import { expect } from 'chai';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { executeCopy } from '../../src/pipeline/stages/copy';
import { executeCommand } from '../../src/pipeline/stages/command';
import type { ClayModelEntry } from '../../src/types/clay-file';

function makeModelIndex(): ClayModelEntry {
  return {
    path: 'model.json',
    generated_files: {},
    setFileCheckSum: () => {},
    getFileCheckSum: () => null,
    delFileCheckSum: () => {},
    load: () => ({}),
  };
}

describe('copy stage', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-copy-'));
  });

  afterEach(() => {
    fs.removeSync(testDir);
  });

  it('copies a file to the output directory', async () => {
    const src = path.join(testDir, 'source.txt');
    fs.writeFileSync(src, 'content', 'utf8');

    const outDir = path.join(testDir, 'out');
    const modelIndex = makeModelIndex();

    await executeCopy(src, outDir, modelIndex);

    expect(fs.existsSync(path.join(outDir, 'source.txt'))).to.be.true;
    expect(fs.readFileSync(path.join(outDir, 'source.txt'), 'utf8')).to.equal('content');
  });
});

describe('command stage', () => {
  it('executes a shell command asynchronously', async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-cmd-'));
    const outFile = path.join(testDir, 'result.txt');

    await executeCommand(`echo "hello" > "${outFile}"`, testDir);

    expect(fs.readFileSync(outFile, 'utf8').trim()).to.equal('hello');
    fs.removeSync(testDir);
  });

  it('does not throw on command failure (logs and continues)', async () => {
    // Original behavior: ui.critical logs the error but in non-CLI mode
    // it's a no-op, so command failures are silently handled
    await executeCommand('exit 1', os.tmpdir());
    // If we get here without throwing, the test passes
  });
});
