// test/pipeline/preflight.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  validateGeneratorsPreflight,
  PreflightError,
} from '../../src/pipeline/preflight';
import type { ModelIndex } from '../../src/types/clay-file';

/**
 * Build a minimal ModelIndex-like object whose load() returns a model with
 * the given generators. modelPath is relative to cwd (as real .clay paths are).
 */
function makeModel(modelPath: string, generators: any[]): ModelIndex {
  return {
    path: modelPath,
    generated_files: {},
    setFileCheckSum: () => {},
    getFileCheckSum: () => null,
    delFileCheckSum: () => {},
    load: () => ({ generators }),
  } as unknown as ModelIndex;
}

/** Run preflight expecting failure, returning the typed error. */
function expectPreflightFailure(models: ModelIndex[]): PreflightError {
  try {
    validateGeneratorsPreflight(models);
  } catch (e) {
    expect(e).to.be.instanceOf(PreflightError);
    return e as PreflightError;
  }
  throw new Error('expected PreflightError, but none was thrown');
}

describe('pre-flight validation', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-preflight-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Create a generator under clay/generators/<name>/generator.json with steps. */
  function writeGenerator(name: string, steps: any[]): string {
    const dir = path.join(tmpDir, 'clay', 'generators', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'generator.json'),
      JSON.stringify({ partials: [], steps })
    );
    return dir;
  }

  function writeModelFile(relPath: string): void {
    const full = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify({ generators: [] }));
  }

  it('throws when a model references a non-existent generator', () => {
    writeModelFile('models/user.clay.json');
    const err = expectPreflightFailure([
      makeModel('models/user.clay.json', ['user-crud']),
    ]);
    expect(err.problems).to.have.lengthOf(1);
    expect(err.problems[0]).to.include('user-crud');
    expect(err.problems[0]).to.include('models/user.clay.json');
    expect(err.problems[0].toLowerCase()).to.include('searched');
    // searched candidate paths should be surfaced
    expect(err.problems[0]).to.include('generator.json');
  });

  it('throws when a generate step points at a missing template file', () => {
    writeGenerator('api', [{ generate: 'routes.ts.hbs', select: '$' }]);
    writeModelFile('models/user.clay.json');
    const err = expectPreflightFailure([
      makeModel('models/user.clay.json', ['api']),
    ]);
    expect(err.problems).to.have.lengthOf(1);
    expect(err.problems[0]).to.include('api');
    expect(err.problems[0]).to.include('routes.ts.hbs');
    expect(err.problems[0]).to.include('models/user.clay.json');
  });

  it('passes when a generate step points at an existing directory', () => {
    const genDir = writeGenerator('api', [
      { generate: 'templates', select: '$' },
    ]);
    fs.mkdirSync(path.join(genDir, 'templates'));
    fs.writeFileSync(path.join(genDir, 'templates', 'x.ts.hbs'), 'hi');
    writeModelFile('models/user.clay.json');
    expect(() =>
      validateGeneratorsPreflight([makeModel('models/user.clay.json', ['api'])])
    ).to.not.throw();
  });

  it('does not throw when all generators and templates are present', () => {
    const genDir = writeGenerator('api', [
      { generate: 'routes.ts.hbs', select: '$' },
      { copy: 'static/logo.png' },
      { runCommand: 'echo hi' },
    ]);
    fs.writeFileSync(path.join(genDir, 'routes.ts.hbs'), 'x');
    fs.mkdirSync(path.join(genDir, 'static'));
    fs.writeFileSync(path.join(genDir, 'static', 'logo.png'), 'x');
    writeModelFile('models/user.clay.json');
    expect(() =>
      validateGeneratorsPreflight([makeModel('models/user.clay.json', ['api'])])
    ).to.not.throw();
  });

  it('handles GeneratorReference objects (not just strings)', () => {
    writeModelFile('models/user.clay.json');
    const err = expectPreflightFailure([
      makeModel('models/user.clay.json', [{ generator: 'missing', output: 'out' }]),
    ]);
    expect(err.problems[0]).to.include('missing');
  });

  it('aggregates ALL problems across models and generators in one error', () => {
    // gen "api" exists but has a missing template
    const genDir = writeGenerator('api', [
      { generate: 'routes.ts.hbs', select: '$' },
      { copy: 'missing-dir' },
    ]);
    fs.writeFileSync(path.join(genDir, 'routes.ts.hbs'), 'x'); // present
    // copy target missing -> 1 problem
    writeModelFile('models/user.clay.json');
    writeModelFile('models/order.clay.json');

    const err = expectPreflightFailure([
      makeModel('models/user.clay.json', ['api', 'no-such-gen']),
      makeModel('models/order.clay.json', ['also-missing']),
    ]);

    // problems: api copy missing (user), no-such-gen not found (user), also-missing not found (order)
    expect(err.problems).to.have.lengthOf(3);
    const joined = err.problems.join('\n');
    expect(joined).to.include('missing-dir');
    expect(joined).to.include('no-such-gen');
    expect(joined).to.include('also-missing');
    expect(err.message).to.include('Pre-flight validation failed');
  });
});
