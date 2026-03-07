import { expect } from 'chai';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('init-claude', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-init-claude-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  async function runInitClaude(dir: string): Promise<void> {
    const { initClaude } = await import('../src/init-claude');
    return initClaude(dir);
  }

  it('creates .claude/settings.json with PreToolUse hook calling clay', async () => {
    await runInitClaude(tmpDir);

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    expect(fs.existsSync(settingsPath)).to.equal(true);

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    expect(settings).to.have.nested.property('hooks.PreToolUse');
    expect(settings.hooks.PreToolUse).to.be.an('array').with.length(1);
    expect(settings.hooks.PreToolUse[0].matcher).to.equal('Edit|Write');
    expect(settings.hooks.PreToolUse[0].hooks[0].type).to.equal('command');
    expect(settings.hooks.PreToolUse[0].hooks[0].command).to.equal(
      'clay check-generated'
    );
  });

  it('does not create a hooks directory or script', async () => {
    await runInitClaude(tmpDir);

    const hooksDir = path.join(tmpDir, '.claude', 'hooks');
    expect(fs.existsSync(hooksDir)).to.equal(false);
  });

  it('merges into existing .claude/settings.json without overwriting', async () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify({
        permissions: { allow: ['Bash(git status:*)'] },
      }),
      'utf8'
    );

    await runInitClaude(tmpDir);

    const settings = JSON.parse(
      fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8')
    );
    expect(settings.permissions.allow).to.deep.equal(['Bash(git status:*)']);
    expect(settings.hooks.PreToolUse).to.be.an('array').with.length(1);
  });

  it('does not duplicate hooks if run twice', async () => {
    await runInitClaude(tmpDir);
    await runInitClaude(tmpDir);

    const settings = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, '.claude', 'settings.json'),
        'utf8'
      )
    );
    expect(settings.hooks.PreToolUse).to.have.length(1);
  });
});
