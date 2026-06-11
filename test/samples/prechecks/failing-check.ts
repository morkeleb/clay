import { PreCheck, type PreCheckContext } from '../../../src/code-generator';

export default class extends PreCheck {
  check({ data }: PreCheckContext): string[] {
    return [`${data.name || 'model'} violates an invariant`];
  }
}
