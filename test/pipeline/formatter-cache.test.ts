import { expect } from 'chai';
import { FormatterCache } from '../../src/pipeline/formatter-cache';

describe('FormatterCache', () => {
  it('loads a formatter module and caches it', () => {
    let loadCount = 0;
    const cache = new FormatterCache((_pkg: string) => {
      loadCount++;
      return {
        apply: (_file: string, content: string) => content.toUpperCase(),
      };
    });

    const f1 = cache.get('my-formatter');
    const f2 = cache.get('my-formatter');

    expect(f1).to.equal(f2); // same reference
    expect(loadCount).to.equal(1); // loaded once
  });

  it('loads different formatters independently', () => {
    const loaded: string[] = [];
    const cache = new FormatterCache((pkg: string) => {
      loaded.push(pkg);
      return { apply: (_f: string, c: string) => c };
    });

    cache.get('fmt-a');
    cache.get('fmt-b');
    cache.get('fmt-a');

    expect(loaded).to.deep.equal(['fmt-a', 'fmt-b']);
  });

  it('clear removes all cached formatters', () => {
    let loadCount = 0;
    const cache = new FormatterCache(() => {
      loadCount++;
      return { apply: (_f: string, c: string) => c };
    });

    cache.get('fmt');
    cache.clear();
    cache.get('fmt');

    expect(loadCount).to.equal(2);
  });

  it('throws descriptive error when formatter not found', () => {
    const cache = new FormatterCache((_pkg: string) => {
      throw new Error('Cannot find module');
    });

    expect(() => cache.get('nonexistent-formatter')).to.throw(
      /Failed to load formatter "nonexistent-formatter".*npm install -g/
    );
  });
});
