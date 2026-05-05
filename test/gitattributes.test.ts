import path from 'path';
import os from 'os';
import { expect } from 'chai';
import fs from 'fs-extra';
import { updateGitattributes } from '../src/gitattributes';

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
