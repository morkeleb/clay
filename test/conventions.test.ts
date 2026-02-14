import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadConventions,
  runConventions,
  Convention,
} from '../src/conventions';

describe('conventions', function () {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'clay-conventions-test-')
    );
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  /* ---------- loadConventions ---------- */

  describe('loadConventions', () => {
    it('loads inline conventions from generator.json', () => {
      const generator = {
        conventions: [
          {
            name: 'no-empty-entities',
            description: 'Entities must not be empty',
            function:
              '(function(model) { return []; })',
          },
        ],
      };
      fs.writeFileSync(
        path.join(testDir, 'generator.json'),
        JSON.stringify(generator)
      );

      const conventions = loadConventions(path.join(testDir, 'generator.json'));
      expect(conventions).to.have.length(1);
      expect(conventions[0].name).to.equal('no-empty-entities');
      expect(conventions[0].description).to.equal(
        'Entities must not be empty'
      );
      expect(conventions[0].function).to.be.a('string');
    });

    it('resolves includes in conventions', () => {
      const convention: Convention = {
        name: 'from-file',
        description: 'Loaded from external file',
        function: '(function(model) { return []; })',
      };
      const includeFile = path.join(testDir, 'my-convention.json');
      fs.writeFileSync(includeFile, JSON.stringify(convention));

      const generator = {
        conventions: [{ include: 'my-convention.json' }],
      };
      fs.writeFileSync(
        path.join(testDir, 'generator.json'),
        JSON.stringify(generator)
      );

      const conventions = loadConventions(path.join(testDir, 'generator.json'));
      expect(conventions).to.have.length(1);
      expect(conventions[0].name).to.equal('from-file');
      expect(conventions[0].description).to.equal(
        'Loaded from external file'
      );
    });

    it('returns empty array if no conventions defined', () => {
      const generator = { name: 'test-gen' };
      fs.writeFileSync(
        path.join(testDir, 'generator.json'),
        JSON.stringify(generator)
      );

      const conventions = loadConventions(path.join(testDir, 'generator.json'));
      expect(conventions).to.deep.equal([]);
    });
  });

  /* ---------- runConventions ---------- */

  describe('runConventions', () => {
    it('returns no violations for passing conventions', () => {
      const conventions: Convention[] = [
        {
          name: 'always-pass',
          description: 'This always passes',
          function: '(function(model) { return []; })',
        },
      ];

      const violations = runConventions(conventions, { entities: [] });
      expect(violations).to.deep.equal([]);
    });

    it('returns violations for failing conventions', () => {
      const conventions: Convention[] = [
        {
          name: 'must-have-entities',
          description: 'Model must have entities',
          function:
            '(function(model) { if (!model.entities || model.entities.length === 0) return ["No entities found"]; return []; })',
        },
      ];

      const violations = runConventions(conventions, {});
      expect(violations).to.have.length(1);
      expect(violations[0].convention).to.equal('must-have-entities');
      expect(violations[0].errors).to.deep.equal(['No entities found']);
    });

    it('collects violations from multiple conventions', () => {
      const conventions: Convention[] = [
        {
          name: 'check-a',
          description: 'Check A',
          function:
            '(function(model) { return ["error from A"]; })',
        },
        {
          name: 'check-b',
          description: 'Check B',
          function:
            '(function(model) { return ["error from B"]; })',
        },
      ];

      const violations = runConventions(conventions, {});
      expect(violations).to.have.length(2);
      expect(violations[0].convention).to.equal('check-a');
      expect(violations[0].errors).to.deep.equal(['error from A']);
      expect(violations[1].convention).to.equal('check-b');
      expect(violations[1].errors).to.deep.equal(['error from B']);
    });

    it('skips conventions whose function returns empty array', () => {
      const conventions: Convention[] = [
        {
          name: 'fails',
          description: 'This fails',
          function:
            '(function(model) { return ["bad"]; })',
        },
        {
          name: 'passes',
          description: 'This passes',
          function: '(function(model) { return []; })',
        },
      ];

      const violations = runConventions(conventions, {});
      expect(violations).to.have.length(1);
      expect(violations[0].convention).to.equal('fails');
    });

    it('handles convention function that throws', () => {
      const conventions: Convention[] = [
        {
          name: 'throws',
          description: 'This throws an error',
          function:
            '(function(model) { throw new Error("something broke"); })',
        },
      ];

      const violations = runConventions(conventions, {});
      expect(violations).to.have.length(1);
      expect(violations[0].convention).to.equal('throws');
      expect(violations[0].errors).to.deep.equal(['something broke']);
    });
  });
});
