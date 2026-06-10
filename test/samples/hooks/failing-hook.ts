import { PostGenerateHook, type HookContext } from '../../../src/code-generator';

export default class extends PostGenerateHook {
  async run(_context: HookContext): Promise<void> {
    throw new Error('Intentional hook failure');
  }
}
