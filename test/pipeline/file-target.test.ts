// test/pipeline/file-target.test.ts
import { expect } from 'chai';
import path from 'path';
import { withClayFileTarget } from '../../src/pipeline/file-target';

describe('withClayFileTarget', () => {
  const filename = path.resolve('out', 'shop', 'components', 'index.ts');

  it('adds the path relative to the output directory, with forward slashes', () => {
    const result = withClayFileTarget(
      { name: 'Order' },
      'out',
      filename
    ) as Record<string, unknown>;
    expect(result.clay_file_target).to.equal('shop/components/index.ts');
    expect(result.name).to.equal('Order');
  });

  it('resolves the output directory against the working directory', () => {
    const result = withClayFileTarget({}, './out/', filename) as Record<
      string,
      unknown
    >;
    expect(result.clay_file_target).to.equal('shop/components/index.ts');
  });

  it('does not mutate the selected item', () => {
    const item: Record<string, unknown> = { name: 'Order' };
    withClayFileTarget(item, 'out', filename);
    expect(item).to.not.have.property('clay_file_target');
  });

  it('returns primitive and array selections as they are', () => {
    const list = [1, 2];
    expect(withClayFileTarget('Order', 'out', filename)).to.equal('Order');
    expect(withClayFileTarget(null, 'out', filename)).to.equal(null);
    expect(withClayFileTarget(list, 'out', filename)).to.equal(list);
  });
});
