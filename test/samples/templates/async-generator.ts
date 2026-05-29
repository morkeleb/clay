import { CodeGenerator, type RenderContext } from '../../../src/code-generator';

export default class extends CodeGenerator {
  async render({ data, helpers }: RenderContext): Promise<string> {
    const { pascalCase } = helpers;
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 1));
    return `export class ${pascalCase(data.name)}Service {}`;
  }
}
