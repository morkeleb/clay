import { CodeGenerator, type RenderContext } from '../../../src/code-generator';

export default class extends CodeGenerator {
  render({ fileTarget }: RenderContext): string {
    return `// ${fileTarget}`;
  }
}
