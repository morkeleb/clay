import path from 'path';
import os from 'os';
import { expect } from 'chai';
import fs from 'fs-extra';
import { execSync } from 'child_process';
import {
  updateGitattributes,
  configureGitMergeDriver,
} from '../src/gitattributes';

describe('gitattributes', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-gitattr-'));
  });

  afterEach(() => {
    fs.removeSync(testDir);
  });

  it('does nothing when .clay file is missing', () => {
    updateGitattributes(testDir);
    expect(fs.existsSync(path.join(testDir, '.gitattributes'))).to.be.false;
  });

  it('does nothing when gitattributes option is not set', () => {
    fs.writeJsonSync(path.join(testDir, '.clay'), {
      models: [
        {
          path: 'model.json',
          output: '',
          generated_files: { 'src/a.ts': { md5: 'x', date: '2025-01-01' } },
        },
      ],
    });
    updateGitattributes(testDir);
    expect(fs.existsSync(path.join(testDir, '.gitattributes'))).to.be.false;
  });

  it('creates .gitattributes with generated file entries when enabled', () => {
    fs.writeJsonSync(path.join(testDir, '.clay'), {
      gitattributes: true,
      models: [
        {
          path: 'model.json',
          output: '',
          generated_files: {
            'src/a.ts': { md5: 'x', date: '2025-01-01' },
            'src/b.ts': { md5: 'y', date: '2025-01-01' },
          },
        },
      ],
    });
    updateGitattributes(testDir);

    const content = fs.readFileSync(
      path.join(testDir, '.gitattributes'),
      'utf8'
    );
    expect(content).to.include('src/a.ts linguist-generated=true');
    expect(content).to.include('src/b.ts linguist-generated=true');
    expect(content).to.include('# clay:generated:start');
    expect(content).to.include('# clay:generated:end');
  });

  it('deduplicates files across models', () => {
    fs.writeJsonSync(path.join(testDir, '.clay'), {
      gitattributes: true,
      models: [
        {
          path: 'a.json',
          output: '',
          generated_files: { 'shared.ts': { md5: 'x', date: '2025-01-01' } },
        },
        {
          path: 'b.json',
          output: '',
          generated_files: { 'shared.ts': { md5: 'x', date: '2025-01-01' } },
        },
      ],
    });
    updateGitattributes(testDir);

    const content = fs.readFileSync(
      path.join(testDir, '.gitattributes'),
      'utf8'
    );
    const matches = content.match(/shared\.ts linguist-generated=true/g);
    expect(matches).to.have.lengthOf(1);
  });

  it('preserves existing .gitattributes content', () => {
    fs.writeFileSync(
      path.join(testDir, '.gitattributes'),
      '*.png binary\n',
      'utf8'
    );
    fs.writeJsonSync(path.join(testDir, '.clay'), {
      gitattributes: true,
      models: [
        {
          path: 'model.json',
          output: '',
          generated_files: { 'out.ts': { md5: 'x', date: '2025-01-01' } },
        },
      ],
    });
    updateGitattributes(testDir);

    const content = fs.readFileSync(
      path.join(testDir, '.gitattributes'),
      'utf8'
    );
    expect(content).to.include('*.png binary');
    expect(content).to.include('out.ts linguist-generated=true');
  });

  it('replaces managed block on subsequent runs', () => {
    fs.writeJsonSync(path.join(testDir, '.clay'), {
      gitattributes: true,
      models: [
        {
          path: 'model.json',
          output: '',
          generated_files: { 'old.ts': { md5: 'x', date: '2025-01-01' } },
        },
      ],
    });
    updateGitattributes(testDir);

    // Update .clay with different files
    fs.writeJsonSync(path.join(testDir, '.clay'), {
      gitattributes: true,
      models: [
        {
          path: 'model.json',
          output: '',
          generated_files: { 'new.ts': { md5: 'y', date: '2025-01-02' } },
        },
      ],
    });
    updateGitattributes(testDir);

    const content = fs.readFileSync(
      path.join(testDir, '.gitattributes'),
      'utf8'
    );
    expect(content).to.include('new.ts linguist-generated=true');
    expect(content).to.not.include('old.ts');
  });

  it('quotes paths containing spaces', () => {
    fs.writeJsonSync(path.join(testDir, '.clay'), {
      gitattributes: true,
      models: [
        {
          path: 'model.json',
          output: '',
          generated_files: {
            'src/my file.ts': { md5: 'x', date: '2025-01-01' },
            'normal.ts': { md5: 'y', date: '2025-01-01' },
          },
        },
      ],
    });
    updateGitattributes(testDir);

    const content = fs.readFileSync(
      path.join(testDir, '.gitattributes'),
      'utf8'
    );
    expect(content).to.include('"src/my file.ts" linguist-generated=true');
    expect(content).to.include('normal.ts linguist-generated=true');
    expect(content).to.not.include('"normal.ts"');
  });

  it('adds .clay merge attribute when automerge is enabled', () => {
    fs.writeJsonSync(path.join(testDir, '.clay'), {
      automerge: true,
      models: [],
    });
    updateGitattributes(testDir);

    const content = fs.readFileSync(
      path.join(testDir, '.gitattributes'),
      'utf8'
    );
    expect(content).to.include('.clay merge=clay-generator');
  });

  it('includes both merge attribute and generated files when both enabled', () => {
    fs.writeJsonSync(path.join(testDir, '.clay'), {
      gitattributes: true,
      automerge: true,
      models: [
        {
          path: 'model.json',
          output: '',
          generated_files: { 'out.ts': { md5: 'x', date: '2025-01-01' } },
        },
      ],
    });
    updateGitattributes(testDir);

    const content = fs.readFileSync(
      path.join(testDir, '.gitattributes'),
      'utf8'
    );
    expect(content).to.include('.clay merge=clay-generator');
    expect(content).to.include('out.ts linguist-generated=true');
  });

  it('is idempotent', () => {
    fs.writeJsonSync(path.join(testDir, '.clay'), {
      gitattributes: true,
      models: [
        {
          path: 'model.json',
          output: '',
          generated_files: { 'out.ts': { md5: 'x', date: '2025-01-01' } },
        },
      ],
    });
    updateGitattributes(testDir);
    updateGitattributes(testDir);

    const content = fs.readFileSync(
      path.join(testDir, '.gitattributes'),
      'utf8'
    );
    const matches = content.match(/# clay:generated:start/g);
    expect(matches).to.have.lengthOf(1);
  });
});

describe('configureGitMergeDriver', () => {
  let gitDir: string;

  beforeEach(() => {
    gitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-git-'));
    execSync('git init', { cwd: gitDir, stdio: 'pipe' });
  });

  afterEach(() => {
    fs.removeSync(gitDir);
  });

  it('sets merge driver in git config', () => {
    configureGitMergeDriver(gitDir, true);

    const driver = execSync('git config merge.clay-generator.driver', {
      cwd: gitDir,
      encoding: 'utf8',
    }).trim();
    expect(driver).to.equal('clay merge-driver %O %A %B');
  });

  it('updateGitattributes installs the merge driver when automerge is enabled', () => {
    fs.writeJsonSync(path.join(gitDir, '.clay'), {
      automerge: true,
      models: [],
    });

    updateGitattributes(gitDir);

    const driver = execSync('git config merge.clay-generator.driver', {
      cwd: gitDir,
      encoding: 'utf8',
    }).trim();
    expect(driver).to.equal('clay merge-driver %O %A %B');
  });

  it('updateGitattributes does not install the driver when automerge is off', () => {
    fs.writeJsonSync(path.join(gitDir, '.clay'), {
      gitattributes: true,
      models: [],
    });

    updateGitattributes(gitDir);

    try {
      execSync('git config merge.clay-generator.driver', {
        cwd: gitDir,
        stdio: 'pipe',
      });
      expect.fail('should have thrown — driver should not be configured');
    } catch {
      // Expected: driver is not set when automerge is disabled
    }
  });

  it('removes merge driver from git config when disabled', () => {
    configureGitMergeDriver(gitDir, true);
    configureGitMergeDriver(gitDir, false);

    try {
      execSync('git config merge.clay-generator.driver', {
        cwd: gitDir,
        stdio: 'pipe',
      });
      expect.fail('should have thrown — section should be removed');
    } catch {
      // Expected: git config exits non-zero when key doesn't exist
    }
  });

  it('does not throw in a non-git directory', () => {
    const nonGit = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-nogit-'));
    expect(() => configureGitMergeDriver(nonGit, true)).to.not.throw();
    fs.removeSync(nonGit);
  });
});
