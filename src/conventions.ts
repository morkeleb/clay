import * as fs from 'fs';
import * as path from 'path';

export interface Convention {
  name: string;
  description: string;
  function: string;
}

export interface ConventionViolation {
  convention: string;
  description: string;
  errors: string[];
}

/**
 * Load conventions from a generator.json file.
 * Conventions can be defined inline or via include references to external JSON files.
 */
export function loadConventions(generatorPath: string): Convention[] {
  const generatorFile = path.join(generatorPath, 'generator.json');
  if (!fs.existsSync(generatorFile)) {
    return [];
  }

  const content = fs.readFileSync(generatorFile, 'utf-8');
  const generator = JSON.parse(content);

  if (!generator.conventions || !Array.isArray(generator.conventions)) {
    return [];
  }

  return generator.conventions.map(
    (entry: Convention | { include: string }) => {
      if ('include' in entry && typeof entry.include === 'string') {
        const includePath = path.resolve(generatorPath, entry.include);
        const includeContent = fs.readFileSync(includePath, 'utf-8');
        return JSON.parse(includeContent) as Convention;
      }
      return entry as Convention;
    }
  );
}

/**
 * Run conventions against a model and collect violations.
 * Each convention's function string is evaluated and called with the model.
 * Only conventions with non-empty errors are returned.
 */
export function runConventions(
  conventions: Convention[],
  model: unknown
): ConventionViolation[] {
  const violations: ConventionViolation[] = [];

  for (const convention of conventions) {
    try {
      // eslint-disable-next-line no-eval
      const fn = eval(convention.function);
      const errors: string[] = fn(model);

      if (errors && errors.length > 0) {
        violations.push({
          convention: convention.name,
          description: convention.description,
          errors,
        });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      violations.push({
        convention: convention.name,
        description: convention.description,
        errors: [message],
      });
    }
  }

  return violations;
}
