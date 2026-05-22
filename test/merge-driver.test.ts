/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';
import os from 'os';
import { expect } from 'chai';
import fs from 'fs-extra';
import { mergeClayFiles, runMergeDriver } from '../src/merge-driver';

describe('merge-driver', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-merge-'));
  });

  afterEach(() => {
    fs.removeSync(testDir);
  });

  function write(name: string, data: object): string {
    const p = path.join(testDir, name);
    fs.writeJsonSync(p, data);
    return p;
  }

  describe('mergeClayFiles', () => {
    it('merges models added on both sides (union)', () => {
      const ancestor = write('ancestor.json', { models: [] });
      const ours = write('ours.json', {
        models: [{ path: 'a.json', output: '', generated_files: {} }],
      });
      const theirs = write('theirs.json', {
        models: [{ path: 'b.json', output: '', generated_files: {} }],
      });

      const result = mergeClayFiles(ancestor, ours, theirs);
      expect(result.models).to.have.lengthOf(2);
      expect(result.models.map((m: any) => m.path)).to.include.members([
        'a.json',
        'b.json',
      ]);
    });

    it('respects deletion by ours — does not resurrect', () => {
      const ancestor = write('ancestor.json', {
        models: [
          { path: 'a.json', output: '', generated_files: {} },
          { path: 'b.json', output: '', generated_files: {} },
        ],
      });
      const ours = write('ours.json', {
        models: [{ path: 'a.json', output: '', generated_files: {} }],
      });
      const theirs = write('theirs.json', {
        models: [
          { path: 'a.json', output: '', generated_files: {} },
          { path: 'b.json', output: '', generated_files: {} },
        ],
      });

      const result = mergeClayFiles(ancestor, ours, theirs);
      expect(result.models).to.have.lengthOf(1);
      expect(result.models[0].path).to.equal('a.json');
    });

    it('respects deletion by theirs — does not resurrect', () => {
      const ancestor = write('ancestor.json', {
        models: [
          { path: 'a.json', output: '', generated_files: {} },
          { path: 'b.json', output: '', generated_files: {} },
        ],
      });
      const ours = write('ours.json', {
        models: [
          { path: 'a.json', output: '', generated_files: {} },
          { path: 'b.json', output: '', generated_files: {} },
        ],
      });
      const theirs = write('theirs.json', {
        models: [{ path: 'a.json', output: '', generated_files: {} }],
      });

      const result = mergeClayFiles(ancestor, ours, theirs);
      expect(result.models).to.have.lengthOf(1);
      expect(result.models[0].path).to.equal('a.json');
    });

    it('merges generated_files for shared models', () => {
      const shared = { path: 'model.json', output: '', generated_files: {} };
      const ancestor = write('ancestor.json', { models: [shared] });
      const ours = write('ours.json', {
        models: [
          {
            path: 'model.json',
            output: '',
            generated_files: { 'a.ts': { md5: 'aaa', date: '2025-01-01' } },
          },
        ],
      });
      const theirs = write('theirs.json', {
        models: [
          {
            path: 'model.json',
            output: '',
            generated_files: { 'b.ts': { md5: 'bbb', date: '2025-01-02' } },
          },
        ],
      });

      const result = mergeClayFiles(ancestor, ours, theirs);
      expect(result.models).to.have.lengthOf(1);
      const files = result.models[0].generated_files;
      expect(files).to.have.property('a.ts');
      expect(files).to.have.property('b.ts');
    });

    it('keeps newer entry when same file in both sides', () => {
      const shared = {
        path: 'model.json',
        output: '',
        generated_files: { 'shared.ts': { md5: 'orig', date: '2024-01-01' } },
      };
      const ancestor = write('ancestor.json', { models: [shared] });
      const ours = write('ours.json', {
        models: [
          {
            path: 'model.json',
            output: '',
            generated_files: {
              'shared.ts': { md5: 'old', date: '2025-01-01' },
            },
          },
        ],
      });
      const theirs = write('theirs.json', {
        models: [
          {
            path: 'model.json',
            output: '',
            generated_files: {
              'shared.ts': { md5: 'new', date: '2025-02-01' },
            },
          },
        ],
      });

      const result = mergeClayFiles(ancestor, ours, theirs);
      expect(result.models[0].generated_files['shared.ts'].md5).to.equal(
        'new'
      );
    });

    it('merges config flags added on different sides', () => {
      const ancestor = write('ancestor.json', { models: [] });
      const ours = write('ours.json', {
        gitattributes: true,
        models: [],
      });
      const theirs = write('theirs.json', {
        automerge: true,
        models: [],
      });

      const result = mergeClayFiles(ancestor, ours, theirs);
      expect(result.gitattributes).to.equal(true);
      expect(result.automerge).to.equal(true);
    });

    it('respects config flag set to false by one side', () => {
      const ancestor = write('ancestor.json', {
        gitattributes: true,
        models: [],
      });
      const ours = write('ours.json', {
        gitattributes: false,
        models: [],
      });
      const theirs = write('theirs.json', {
        gitattributes: true,
        models: [],
      });

      const result = mergeClayFiles(ancestor, ours, theirs);
      // Ours changed it to false, theirs didn't change — ours wins
      expect(result).to.not.have.property('gitattributes');
    });

    it('keeps newer last_generated for shared models', () => {
      const shared = { path: 'model.json', output: '', generated_files: {} };
      const ancestor = write('ancestor.json', { models: [shared] });
      const ours = write('ours.json', {
        models: [
          {
            path: 'model.json',
            output: '',
            generated_files: {},
            last_generated: '2025-01-01T00:00:00Z',
          },
        ],
      });
      const theirs = write('theirs.json', {
        models: [
          {
            path: 'model.json',
            output: '',
            generated_files: {},
            last_generated: '2025-02-01T00:00:00Z',
          },
        ],
      });

      const result = mergeClayFiles(ancestor, ours, theirs);
      expect(result.models[0].last_generated).to.equal(
        '2025-02-01T00:00:00Z'
      );
    });

    it('handles models with undefined output', () => {
      const ancestor = write('ancestor.json', { models: [] });
      const ours = write('ours.json', {
        models: [{ path: 'model.json', generated_files: {} }],
      });
      const theirs = write('theirs.json', {
        models: [{ path: 'model.json', generated_files: {} }],
      });

      const result = mergeClayFiles(ancestor, ours, theirs);
      expect(result.models).to.have.lengthOf(1);
    });
  });

  describe('runMergeDriver', () => {
    it('writes merged result to ours path and returns true', () => {
      const ancestor = write('ancestor.json', { models: [] });
      const ours = write('ours.json', {
        models: [{ path: 'a.json', output: '', generated_files: {} }],
      });
      const theirs = write('theirs.json', {
        models: [{ path: 'b.json', output: '', generated_files: {} }],
      });

      const success = runMergeDriver(ancestor, ours, theirs);
      expect(success).to.be.true;

      const result = fs.readJsonSync(ours);
      expect(result.models).to.have.lengthOf(2);
    });

    it('writes output with trailing newline', () => {
      const ancestor = write('ancestor.json', { models: [] });
      const ours = write('ours.json', { models: [] });
      const theirs = write('theirs.json', { models: [] });

      runMergeDriver(ancestor, ours, theirs);
      const raw = fs.readFileSync(ours, 'utf8');
      expect(raw.endsWith('\n')).to.be.true;
    });

    it('returns false on invalid JSON', () => {
      const ancestor = write('ancestor.json', { models: [] });
      const oursPath = path.join(testDir, 'ours.json');
      fs.writeFileSync(oursPath, 'not json', 'utf8');
      const theirs = write('theirs.json', { models: [] });

      const success = runMergeDriver(ancestor, oursPath, theirs);
      expect(success).to.be.false;
    });
  });
});
