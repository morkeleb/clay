#!/usr/bin/env node
/**
 * Guards and tag for `npm publish`.
 *
 * prepublishOnly runs `precheck` before lint, build, and test. A failing
 * check uploads nothing. postpublish creates and pushes the annotated tag
 * vX.Y.Z after the registry has accepted the package. A dry run does not tag.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function run(cmd, args) {
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });
}

function tryCapture(cmd, args) {
  const options = {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  };
  try {
    return {
      ok: true,
      stdout: execFileSync(cmd, args, options).trim(),
      stderr: '',
    };
  } catch (error) {
    return {
      ok: false,
      stdout: `${error.stdout || ''}`.trim(),
      stderr: `${error.stderr || ''}`.trim(),
    };
  }
}

function capture(cmd, args) {
  const result = tryCapture(cmd, args);
  if (!result.ok) {
    throw new Error(result.stderr || result.stdout || `${cmd} ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function planRelease(state) {
  const tag = `v${state.version}`;
  if (state.nodeMajor !== 24) {
    return {
      action: 'fail',
      reason: `Node 24 is required (this process is Node ${state.nodeMajor}).`,
    };
  }
  if (!/^\d+\.\d+\.\d+$/.test(state.version)) {
    return {
      action: 'fail',
      reason: `package.json version "${state.version}" must be a plain x.y.z version.`,
    };
  }
  if (state.dirty) {
    return {
      action: 'fail',
      reason: 'Working tree is dirty. Commit or stash before releasing.',
    };
  }
  if (state.branch !== 'master') {
    return {
      action: 'fail',
      reason: `Release runs from master. Current branch is ${state.branch}.`,
    };
  }
  if (state.head !== state.originMaster) {
    return {
      action: 'fail',
      reason: 'master does not match origin/master. Push or pull before releasing.',
    };
  }
  if (state.remoteTagExists) {
    return { action: 'fail', reason: `Tag ${tag} is already on origin.` };
  }
  if (state.localTagCommit && state.localTagCommit !== state.head) {
    return {
      action: 'fail',
      reason: `Tag ${tag} already points at ${state.localTagCommit}, not HEAD.`,
    };
  }

  const onNpmFromHead = state.npmGitHead === state.head;
  if (state.npmGitHead && !onNpmFromHead) {
    return {
      action: 'fail',
      reason: `${state.packageName}@${state.version} is already published from ${state.npmGitHead}, which is not HEAD.`,
    };
  }
  if (state.onNpm && !state.npmGitHead) {
    return {
      action: 'fail',
      reason: `${state.packageName}@${state.version} is on npm without a recorded git commit. The tag was not created.`,
    };
  }
  if (state.localTagCommit === state.head && onNpmFromHead) {
    return { action: 'push-tag' };
  }
  if (state.localTagCommit === state.head) {
    return {
      action: 'fail',
      reason: `Tag ${tag} already points at HEAD, and ${state.packageName}@${state.version} is not on npm.`,
    };
  }
  if (onNpmFromHead) {
    return { action: 'tag' };
  }
  return { action: 'publish-then-tag' };
}

function readNpm(name, version) {
  const result = tryCapture('npm', [
    'view',
    `${name}@${version}`,
    'version',
    'gitHead',
    '--json',
  ]);
  const text = `${result.stdout}\n${result.stderr}`;
  if (!result.ok) {
    if (/"code": "E404"/.test(result.stdout) || /E404/.test(text)) {
      return { onNpm: false, npmGitHead: null };
    }
    throw new Error(`Could not check npm for ${name}@${version}.\n${text}`);
  }
  const parsed = JSON.parse(result.stdout);
  return {
    onNpm: parsed.version === version,
    npmGitHead: typeof parsed.gitHead === 'string' ? parsed.gitHead : null,
  };
}

function localTagCommit(tag) {
  const result = tryCapture('git', ['rev-parse', '--verify', '--quiet', `${tag}^{commit}`]);
  if (!result.ok || !result.stdout) return null;
  return result.stdout;
}

function remoteTagExists(tag) {
  const stdout = capture('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]);
  return stdout.length > 0;
}

function readState(pkg) {
  const npm = readNpm(pkg.name, pkg.version);
  return {
    nodeMajor: Number(process.versions.node.split('.')[0]),
    version: pkg.version,
    packageName: pkg.name,
    dirty: capture('git', ['status', '--porcelain']).length > 0,
    branch: capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
    head: capture('git', ['rev-parse', 'HEAD']),
    originMaster: capture('git', ['rev-parse', 'origin/master']),
    localTagCommit: localTagCommit(`v${pkg.version}`),
    remoteTagExists: remoteTagExists(`v${pkg.version}`),
    onNpm: npm.onNpm,
    npmGitHead: npm.npmGitHead,
  };
}

function tagName(pkg) {
  return `v${pkg.version}`;
}

function createTag(pkg) {
  run('git', ['tag', '-a', tagName(pkg), '-m', `${pkg.name} ${pkg.version}`]);
}

function pushTag(pkg) {
  run('git', ['push', 'origin', tagName(pkg)]);
}

function readPackage() {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
}

function isDryRun() {
  return process.env.npm_config_dry_run === 'true';
}

function fromNpmPublish() {
  return process.env.npm_command === 'publish';
}

function loadPlan() {
  const pkg = readPackage();
  run('git', ['fetch', '--quiet', 'origin', 'master']);
  const state = readState(pkg);
  return { pkg, plan: planRelease(state) };
}

function applyTag(plan, pkg) {
  if (plan.action === 'tag' || plan.action === 'publish-then-tag') {
    createTag(pkg);
    pushTag(pkg);
    return;
  }
  if (plan.action === 'push-tag') {
    pushTag(pkg);
    return;
  }
  console.error(plan.reason);
  process.exit(1);
}

function precheck() {
  if (!fromNpmPublish()) {
    console.error('Publish with npm publish.');
    process.exit(1);
  }
  const { pkg, plan } = loadPlan();
  if (plan.action === 'publish-then-tag') {
    return;
  }
  if (plan.action === 'fail') {
    console.error(plan.reason);
    process.exit(1);
  }
  applyTag(plan, pkg);
  console.log(
    `${tagName(pkg)} is on origin. ${pkg.name}@${pkg.version} was already published, so npm publish did not upload it again.`
  );
  process.exit(1);
}

function postpublish() {
  if (!fromNpmPublish()) {
    console.error('Publish with npm publish.');
    process.exit(1);
  }
  if (isDryRun()) {
    console.log('Dry run: tag was not created.');
    return;
  }
  const { pkg, plan } = loadPlan();
  applyTag(plan, pkg);
  console.log(`Released ${pkg.name}@${pkg.version} as ${tagName(pkg)}.`);
}

function main() {
  const mode = process.argv[2];
  if (mode === 'precheck') {
    precheck();
    return;
  }
  if (mode === 'postpublish') {
    postpublish();
    return;
  }
  console.error('Publish with npm publish.');
  process.exit(1);
}

module.exports = { planRelease };

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
