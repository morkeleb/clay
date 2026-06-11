// test/pipeline/prechecks.test.ts
import { expect } from 'chai';
import path from 'path';
import sinon from 'sinon';
import * as output from '../../src/output';
import { executePreChecks, PreCheckFailedError } from '../../src/pipeline/prechecks';

const generatorDir = path.resolve('test/samples');
const modelPath = 'test/samples/example-unknown-generator.json';

/** Await a precheck run that must fail, returning the typed error. */
async function expectPreCheckFailure(
  run: Promise<void>
): Promise<PreCheckFailedError> {
  try {
    await run;
  } catch (e) {
    expect(e).to.be.instanceOf(PreCheckFailedError);
    return e as PreCheckFailedError;
  }
  throw new Error('expected PreCheckFailedError, but no error was thrown');
}

describe('pre-generation checks', () => {
  let warnStub: sinon.SinonStub;

  beforeEach(() => {
    warnStub = sinon.stub(output, 'warn');
  });

  afterEach(() => {
    warnStub.restore();
  });

  describe('TypeScript checks (run)', () => {
    it('passes when the check returns no violations', async () => {
      await executePreChecks(
        [{ run: 'prechecks/passing-check.ts' }],
        { types: [{ name: 'User' }] },
        generatorDir,
        modelPath
      );
    });

    it('throws PreCheckFailedError with the violation message', async () => {
      const err = await expectPreCheckFailure(
        executePreChecks(
          [{ run: 'prechecks/failing-check.ts' }],
          { name: 'mymodel', types: [] },
          generatorDir,
          modelPath
        )
      );
      expect(err.violations).to.have.lengthOf(1);
      expect(err.violations[0]).to.include('mymodel violates an invariant');
      expect(err.message).to.include('mymodel violates an invariant');
    });

    it('treats a thrown error as a violation', async () => {
      const err = await expectPreCheckFailure(
        executePreChecks(
          [{ run: 'prechecks/throwing-check.ts' }],
          {},
          generatorDir,
          modelPath
        )
      );
      expect(err.violations[0]).to.include('check exploded');
    });

    it('fails checks that do not export a check method', async () => {
      const err = await expectPreCheckFailure(
        executePreChecks(
          [{ run: 'prechecks/bad-check.ts' }],
          {},
          generatorDir,
          modelPath
        )
      );
      expect(err.violations[0]).to.include('check');
    });

    it('runs once per selected item with clay context injected', async () => {
      const model = {
        types: [{ name: 'User' }, { name: 'Order' }],
      };
      const err = await expectPreCheckFailure(
        executePreChecks(
          [{ run: 'prechecks/context-check.ts', select: '$.types[*]' }],
          model,
          generatorDir,
          modelPath
        )
      );
      expect(err.violations).to.have.lengthOf(2);
      expect(err.violations[0]).to.include('item=User parent=yes model=yes helpers=yes');
      expect(err.violations[1]).to.include('item=Order parent=yes model=yes helpers=yes');
    });
  });

  describe('command checks (runCommand)', () => {
    it('passes when the command exits zero', async () => {
      await executePreChecks(
        [{ runCommand: 'node -e "process.exit(0)"' }],
        {},
        generatorDir,
        modelPath
      );
    });

    it('aborts on non-zero exit and surfaces stderr', async () => {
      const err = await expectPreCheckFailure(
        executePreChecks(
          [{ runCommand: 'node prechecks/check-args.mjs' }],
          {},
          generatorDir,
          modelPath
        )
      );
      expect(err.violations[0]).to.include('args:');
    });

    it('passes the model path as the last argument', async () => {
      const err = await expectPreCheckFailure(
        executePreChecks(
          [{ runCommand: 'node prechecks/check-args.mjs' }],
          {},
          generatorDir,
          modelPath
        )
      );
      expect(err.violations[0]).to.match(/args: \S*example-unknown-generator\.json/);
    });

    it('templates the command per selected item and still appends the model path', async () => {
      const model = { types: [{ name: 'User' }, { name: 'Order' }] };
      const err = await expectPreCheckFailure(
        executePreChecks(
          [{ runCommand: 'node prechecks/check-args.mjs {{name}}', select: '$.types[*]' }],
          model,
          generatorDir,
          modelPath
        )
      );
      expect(err.violations).to.have.lengthOf(2);
      expect(err.violations[0]).to.match(/args: User \S*example-unknown-generator\.json/);
      expect(err.violations[1]).to.match(/args: Order \S*example-unknown-generator\.json/);
    });
  });

  describe('aggregation', () => {
    it('runs all prechecks even when an early one fails and aggregates every violation', async () => {
      const err = await expectPreCheckFailure(
        executePreChecks(
          [
            { run: 'prechecks/failing-check.ts' },
            { run: 'prechecks/throwing-check.ts' },
            { run: 'prechecks/passing-check.ts' },
            { runCommand: 'node prechecks/check-args.mjs' },
          ],
          { name: 'mymodel' },
          generatorDir,
          modelPath
        )
      );
      expect(err.violations).to.have.lengthOf(3);
      expect(err.message).to.include('mymodel violates an invariant');
      expect(err.message).to.include('check exploded');
      expect(err.message).to.include('args:');
    });
  });
});
