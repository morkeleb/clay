// test/pipeline/progress.test.ts
import { expect } from 'chai';
import { createProgress } from '../../src/pipeline/progress';
import type { PipelineProgress } from '../../src/pipeline/progress';

describe('pipeline progress', () => {
  it('createProgress returns a PipelineProgress with all callbacks', () => {
    // Verbose mode (non-TTY safe)
    const progress: PipelineProgress = createProgress('test-generator', true);
    expect(progress).to.have.property('onSelect').that.is.a('function');
    expect(progress).to.have.property('onRender').that.is.a('function');
    expect(progress).to.have.property('onSkip').that.is.a('function');
    expect(progress).to.have.property('onFormat').that.is.a('function');
    expect(progress).to.have.property('onWrite').that.is.a('function');
    expect(progress).to.have.property('done').that.is.a('function');
  });

  it('verbose progress does not throw when called', () => {
    const progress = createProgress('test', true);
    expect(() => {
      progress.onSelect('file.ts');
      progress.onRender('file.ts');
      progress.onSkip('file.ts');
      progress.onFormat('file.ts');
      progress.onWrite('file.ts');
      progress.done();
    }).to.not.throw();
  });

  it('verbose progress returns no-op onSelect', () => {
    const progress = createProgress('test', true);
    // onSelect should not throw and is effectively a no-op
    progress.onSelect('anything');
    progress.done();
  });

  it('compact progress is returned when isCLI and TTY', () => {
    const origCLI = process.isCLI;
    const origTTY = process.stderr.isTTY;
    try {
      process.isCLI = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.stderr as any).isTTY = true;
      const progress = createProgress('test-compact', false);
      expect(progress).to.have.property('onSelect').that.is.a('function');
      expect(progress).to.have.property('done').that.is.a('function');
    } finally {
      process.isCLI = origCLI;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.stderr as any).isTTY = origTTY;
    }
  });

  it('falls back to verbose when not a TTY', () => {
    const origCLI = process.isCLI;
    const origTTY = process.stderr.isTTY;
    try {
      process.isCLI = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.stderr as any).isTTY = false;
      const progress = createProgress('test-no-tty', false);
      // Should not throw — falls back to verbose
      expect(() => {
        progress.onSelect('file.ts');
        progress.onRender('file.ts');
        progress.onWrite('file.ts');
        progress.done();
      }).to.not.throw();
    } finally {
      process.isCLI = origCLI;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.stderr as any).isTTY = origTTY;
    }
  });
});
