import { CodeGenerator, type RenderContext } from '../../../src/code-generator';

export default class extends CodeGenerator {
  render({ data, helpers }: RenderContext): string {
    const { pascalCase, camelCase } = helpers;
    const fields = (data.fields || []) as Array<{ name: string; type: string }>;
    const fieldDecls = fields
      .map(f => `  ${camelCase(f.name)}: ${f.type};`)
      .join('\n');
    return `export class ${pascalCase(data.name)} {\n${fieldDecls}\n}`;
  }
}
