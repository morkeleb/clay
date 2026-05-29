import { CodeGenerator, type RenderContext } from '../../../src/code-generator';

export default class extends CodeGenerator {
  render({ data }: RenderContext): string {
    return `export class ${data.name} {}`;
  }
}
