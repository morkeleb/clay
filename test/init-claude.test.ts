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

  // Import lazily to avoid module caching issues
  async function runInitClaude(dir: string): Promise<void> {
    const { initClaude } = await import('../src/init-claude');
    return initClaude(dir);
  }

  it('creates .claude/settings.json with PreToolUse hook', async () => {
    await runInitClaude(tmpDir);

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    expect(fs.existsSync(settingsPath)).to.equal(true);

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    expect(settings).to.have.nested.property('hooks.PreToolUse');
    expect(settings.hooks.PreToolUse).to.be.an('array').with.length(1);
    expect(settings.hooks.PreToolUse[0].matcher).to.equal('Edit|Write');
    expect(settings.hooks.PreToolUse[0].hooks[0].type).to.equal('command');
    expect(settings.hooks.PreToolUse[0].hooks[0].command).to.equal(
      '.claude/hooks/check-generated-file.sh'
    );
  });

  it('creates .claude/hooks/check-generated-file.sh', async () => {
    await runInitClaude(tmpDir);

    const hookPath = path.join(
      tmpDir,
      '.claude',
      'hooks',
      'check-generated-file.sh'
    );
    expect(fs.existsSync(hookPath)).to.equal(true);

    const content = fs.readFileSync(hookPath, 'utf8');
    expect(content).to.include('#!/bin/bash');
    expect(content).to.include('.clay');
    expect(content).to.include('exit 2');
  });

  it('makes the hook script executable', async () => {
    await runInitClaude(tmpDir);

    const hookPath = path.join(
      tmpDir,
      '.claude',
      'hooks',
      'check-generated-file.sh'
    );
    const stats = fs.statSync(hookPath);
    // Check owner execute bit
    expect(stats.mode & 0o100).to.be.greaterThan(0);
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
