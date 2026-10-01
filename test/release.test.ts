import { expect } from 'chai';

const { planRelease } = require('../scripts/release') as {
  planRelease: (state: ReleaseState) => { action: string; reason?: string };
};

interface ReleaseState {
  nodeMajor: number;
  version: string;
  packageName: string;
  dirty: boolean;
  branch: string;
  head: string;
  originMaster: string;
  localTagCommit: string | null;
  remoteTagExists: boolean;
  onNpm: boolean;
  npmGitHead: string | null;
}

function ready(overrides: Partial<ReleaseState> = {}): ReleaseState {
  return {
    nodeMajor: 24,
    version: '0.3.4',
    packageName: 'clay-generator',
    dirty: false,
    branch: 'master',
    head: 'abc',
    originMaster: 'abc',
    localTagCommit: null,
    remoteTagExists: false,
    onNpm: false,
    npmGitHead: null,
    ...overrides,
  };
}

describe('planRelease', () => {
  it('publishes and then tags a new version of the current commit', () => {
    expect(planRelease(ready()).action).to.equal('publish-then-tag');
  });

  it('tags a version npm already published from this commit', () => {
    expect(planRelease(ready({ onNpm: true, npmGitHead: 'abc' })).action).to.equal('tag');
  });

  it('pushes a local tag that already points at the published commit', () => {
    expect(
      planRelease(ready({ onNpm: true, npmGitHead: 'abc', localTagCommit: 'abc' })).action
    ).to.equal('push-tag');
  });

  it('stops when the working tree, branch, or remote is not the release commit', () => {
    expect(planRelease(ready({ nodeMajor: 26 })).action).to.equal('fail');
    expect(planRelease(ready({ version: '0.3.4-beta' })).action).to.equal('fail');
    expect(planRelease(ready({ dirty: true })).action).to.equal('fail');
    expect(planRelease(ready({ branch: 'feature' })).action).to.equal('fail');
    expect(planRelease(ready({ originMaster: 'def' })).action).to.equal('fail');
  });

  it('stops when the tag or the published commit disagrees with HEAD', () => {
    expect(planRelease(ready({ remoteTagExists: true })).action).to.equal('fail');
    expect(planRelease(ready({ localTagCommit: 'def' })).action).to.equal('fail');
    expect(planRelease(ready({ onNpm: true, npmGitHead: 'def' })).action).to.equal('fail');
    expect(planRelease(ready({ onNpm: true, npmGitHead: null })).action).to.equal('fail');
    expect(planRelease(ready({ localTagCommit: 'abc' })).action).to.equal('fail');
  });
});
