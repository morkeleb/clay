import { PreCheck, type PreCheckContext } from '../../../src/code-generator';

export default class extends PreCheck {
  check({ data, model, parent, helpers }: PreCheckContext): string[] {
    return [
      `item=${data.name} parent=${parent ? 'yes' : 'no'} model=${
        model && Array.isArray(model.types) ? 'yes' : 'no'
      } helpers=${typeof helpers.pascalCase === 'function' ? 'yes' : 'no'}`,
    ];
  }
}
