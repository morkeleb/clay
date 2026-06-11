import { PreCheck, type PreCheckContext } from '../../../src/code-generator';

export default class extends PreCheck {
  check(_context: PreCheckContext): string[] | void {
    throw new Error('check exploded');
  }
}
