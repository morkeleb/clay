/**
 * Engine-idiomatic starter content for a newly added `generate` step.
 * Each stub is minimal but immediately renderable and demonstrates the
 * engine's syntax plus a Clay context variable (clay_key).
 */
export type StepEngine = 'handlebars' | 'ejs' | 'ts';

const HANDLEBARS_STUB = `{{! Handlebars template. Context vars include clay_key and clay_parent. }}
// Generated for {{clay_key}}
`;

const EJS_STUB = `<%# EJS template. Context vars include clay_key and clay_parent. %>
// Generated for <%= clay_key %>
`;

const TS_STUB = `import { CodeGenerator } from 'clay-generator/types';
import type { RenderContext } from 'clay-generator/types';

/**
 * Programmatic generator step. Return the file content as a string.
 * \`context.data\` holds the selected model node (with clay_key, clay_parent, ...).
 */
export default class extends CodeGenerator {
  render({ data }: RenderContext): string {
    return \`// Generated for \${data.clay_key}\\n\`;
  }
}
`;

export function stubForEngine(engine: StepEngine): string {
  switch (engine) {
    case 'handlebars':
      return HANDLEBARS_STUB;
    case 'ejs':
      return EJS_STUB;
    case 'ts':
      return TS_STUB;
    default: {
      const _exhaustive: never = engine;
      throw new Error(`Unknown engine: ${String(_exhaustive)}`);
    }
  }
}
