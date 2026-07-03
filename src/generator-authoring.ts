/**
 * Generator authoring: append a `generate` step to an existing generator and
 * write an engine-idiomatic template stub. Single source of truth for
 * generator.json mutation (used by the MCP tool, and reusable by a CLI later).
 */
import fs from 'fs';
import path from 'path';
import { stubForEngine, type StepEngine } from './generator-stubs';
import type { GeneratorStepGenerate } from './types/generator';

/** Thrown for all add-step failures so callers can present a clean message. */
export class GeneratorAuthoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeneratorAuthoringError';
  }
}

export interface AddStepOptions {
  generatorName: string;
  cwd?: string;
  engine: StepEngine;
  template: string;
  select?: string;
  target?: string;
  touch?: boolean;
  content?: string;
  overwrite?: boolean;
}

/**
 * Candidate locations for a generator named `name`, anchored to `cwd`. This
 * resolves generators by name for authoring (create/extend), using the
 * conventional project locations. It intentionally does NOT perform the
 * model-relative resolution that src/generator-resolver.ts does during
 * generation, because add-step has no model context — it is invoked with a
 * generator name and a working directory only.
 */
function candidatePaths(name: string, cwd: string): string[] {
  return [
    path.join(cwd, `${name}.json`),
    path.join(cwd, name, 'generator.json'),
    path.join(cwd, 'clay', 'generators', name, 'generator.json'),
    path.join(cwd, name), // directory containing generator.json
  ];
}

/** Resolve to the generator.json path, or null if none exists. */
function resolveGeneratorJson(name: string, cwd: string): string | null {
  for (const candidate of candidatePaths(name, cwd)) {
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) {
      const inner = path.join(candidate, 'generator.json');
      if (fs.existsSync(inner)) return inner;
      continue;
    }
    return candidate;
  }
  return null;
}

export function addGeneratorStep(opts: AddStepOptions): {
  generatorJsonPath: string;
  templatePath: string;
  step: GeneratorStepGenerate;
  created: boolean;
} {
  const cwd = opts.cwd ?? process.cwd();
  const select = opts.select ?? '$';

  const generatorJsonPath = resolveGeneratorJson(opts.generatorName, cwd);
  if (!generatorJsonPath) {
    const searched = candidatePaths(opts.generatorName, cwd).join(', ');
    throw new GeneratorAuthoringError(
      `Generator "${opts.generatorName}" not found. Searched: ${searched}. ` +
        `Create it first with clay_init({ type: 'generator', name: '${opts.generatorName}' }).`
    );
  }

  let config: { steps?: unknown };
  try {
    config = JSON.parse(fs.readFileSync(generatorJsonPath, 'utf8'));
  } catch (e) {
    throw new GeneratorAuthoringError(
      `Generator config could not be parsed (${generatorJsonPath}): ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }

  const steps: any[] = Array.isArray(config.steps) ? config.steps : [];
  if (steps.some((s) => s && s.generate === opts.template)) {
    throw new GeneratorAuthoringError(
      `Generator "${opts.generatorName}" already has a step generating "${opts.template}".`
    );
  }

  const generatorDir = path.dirname(generatorJsonPath);
  const templatePath = path.join(generatorDir, opts.template);
  const rel = path.relative(generatorDir, templatePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new GeneratorAuthoringError(
      `Template "${opts.template}" must stay within the generator directory.`
    );
  }
  if (fs.existsSync(templatePath) && !opts.overwrite) {
    throw new GeneratorAuthoringError(
      `Template "${opts.template}" already exists at ${templatePath}. ` +
        `Pass overwrite: true to replace it.`
    );
  }

  const created = !fs.existsSync(templatePath);
  const body = opts.content ?? stubForEngine(opts.engine);
  fs.mkdirSync(path.dirname(templatePath), { recursive: true });
  fs.writeFileSync(templatePath, body);

  const step: GeneratorStepGenerate = {
    generate: opts.template,
    select,
    engine: opts.engine,
    ...(opts.target !== undefined ? { target: opts.target } : {}),
    ...(opts.touch !== undefined ? { touch: opts.touch } : {}),
  };

  const updated = { ...config, steps: [...steps, step] };
  fs.writeFileSync(generatorJsonPath, `${JSON.stringify(updated, null, 2)}\n`);

  return { generatorJsonPath, templatePath, step, created };
}
