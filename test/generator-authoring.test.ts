/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  addGeneratorStep,
  GeneratorAuthoringError,
} from '../src/generator-authoring';
import { validateGeneratorsPreflight } from '../src/pipeline/preflight';
import type { ModelIndex } from '../src/types/clay-file';

describe('addGeneratorStep', () => {
  let tmp: string;
  let cwd: string;

  beforeEach(() => {
    cwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-authoring-'));
    process.chdir(tmp);
  });
  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  /** Create clay/generators/<name>/generator.json with the given steps. */
  function makeGenerator(name: string, steps: any[] = []): void {
    const dir = path.join(tmp, 'clay', 'generators', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'generator.json'),
      JSON.stringify({ partials: [], formatters: [], steps }, null, 2)
    );
  }

  function readGenerator(name: string): any {
    return JSON.parse(
      fs.readFileSync(
        path.join(tmp, 'clay', 'generators', name, 'generator.json'),
        'utf8'
      )
    );
  }

  it('appends a handlebars step and writes the stub', () => {
    makeGenerator('api');
    const res = addGeneratorStep({
      generatorName: 'api',
      engine: 'handlebars',
      template: 'entity.ts.hbs',
      select: '$.types[*]',
    });

    expect(res.created).to.equal(true);
    expect(fs.existsSync(res.templatePath)).to.equal(true);
    const gen = readGenerator('api');
    expect(gen.steps).to.have.length(1);
    expect(gen.steps[0]).to.deep.include({
      generate: 'entity.ts.hbs',
      select: '$.types[*]',
      engine: 'handlebars',
    });
  });

  it('defaults select to "$" and writes engine explicitly for ts', () => {
    makeGenerator('api');
    const res = addGeneratorStep({
      generatorName: 'api',
      engine: 'ts',
      template: 'dto.ts',
    });
    expect(res.step.select).to.equal('$');
    expect(res.step.engine).to.equal('ts');
    expect(fs.readFileSync(res.templatePath, 'utf8')).to.include('extends CodeGenerator');
  });

  it('produces a generator that passes pre-flight validation', () => {
    makeGenerator('api');
    addGeneratorStep({ generatorName: 'api', engine: 'ejs', template: 'x.ejs' });
    const model = {
      path: path.join('clay', 'model.clay.json'),
      load: () => ({ generators: ['api'] }),
    } as unknown as ModelIndex;
    fs.mkdirSync(path.join(tmp, 'clay'), { recursive: true });
    expect(() => validateGeneratorsPreflight([model])).to.not.throw();
  });

  it('throws when the generator does not exist', () => {
    expect(() =>
      addGeneratorStep({ generatorName: 'missing', engine: 'ts', template: 'a.ts' })
    ).to.throw(GeneratorAuthoringError, /not found/i);
  });

  it('throws when the template escapes the generator directory', () => {
    makeGenerator('api');
    expect(() =>
      addGeneratorStep({ generatorName: 'api', engine: 'handlebars', template: '../escape.hbs' })
    ).to.throw(GeneratorAuthoringError, /within the generator directory/i);
  });

  it('throws when the template already exists without overwrite', () => {
    makeGenerator('api');
    const dir = path.join(tmp, 'clay', 'generators', 'api');
    fs.writeFileSync(path.join(dir, 'dup.hbs'), 'existing');
    expect(() =>
      addGeneratorStep({ generatorName: 'api', engine: 'handlebars', template: 'dup.hbs' })
    ).to.throw(GeneratorAuthoringError, /already exists/i);
  });

  it('overwrites when overwrite is true', () => {
    makeGenerator('api');
    const dir = path.join(tmp, 'clay', 'generators', 'api');
    fs.writeFileSync(path.join(dir, 'dup.hbs'), 'existing');
    const res = addGeneratorStep({
      generatorName: 'api', engine: 'handlebars', template: 'dup.hbs', overwrite: true,
    });
    expect(res.created).to.equal(false);
    expect(fs.readFileSync(res.templatePath, 'utf8')).to.include('{{clay_key}}');
  });

  it('throws on a duplicate step (same generate)', () => {
    makeGenerator('api', [{ generate: 'a.hbs', select: '$', engine: 'handlebars' }]);
    const dir = path.join(tmp, 'clay', 'generators', 'api');
    fs.writeFileSync(path.join(dir, 'a.hbs'), 'x');
    expect(() =>
      addGeneratorStep({ generatorName: 'api', engine: 'handlebars', template: 'a.hbs', overwrite: true })
    ).to.throw(GeneratorAuthoringError, /already has a step/i);
  });

  it('throws when generator.json is unparseable', () => {
    const dir = path.join(tmp, 'clay', 'generators', 'api');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'generator.json'), '{ not valid json');
    expect(() =>
      addGeneratorStep({ generatorName: 'api', engine: 'ts', template: 'a.ts' })
    ).to.throw(GeneratorAuthoringError, /could not be parsed/i);
  });
});
