// test/pipeline/copy-command.test.ts
import { expect } from 'chai';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { executeCommand } from '../../src/pipeline/stages/command';

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
