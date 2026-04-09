#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const cwd = process.cwd();
const mode = process.env.RELEASE_MODE;
const rawRefName =
  process.env.RELEASE_REF ||
  process.env.GITHUB_REF_NAME ||
  runOutput('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
const branch = normalizeRef(rawRefName);
const remote = process.env.GIT_REMOTE ?? 'origin';
const stableBranch = process.env.RELEASE_STABLE_BRANCH ?? 'main';
const versionPackagePath =
  process.env.RELEASE_VERSION_PACKAGE ?? 'packages/cli/package.json';

if (!['stable', 'rc', 'canary'].includes(mode)) {
  fail('RELEASE_MODE must be set to stable, rc, or canary');
}

function normalizeRef(ref) {
  return ref.replace(/^refs\/heads\//, '').trim();
}

function isReleaseBranch(ref) {
  return /^release\/v\d+\.\d+(?:\.\d+)?$/.test(ref);
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
}

function runOutput(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  }).trim();
}

function commandSucceeds(command, args) {
  try {
    execFileSync(command, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`Warning: ${message}`);
}

function ensureCleanWorktree() {
  const status = runOutput('git', ['status', '--porcelain']);

  if (status.length > 0) {
    fail('working tree must be clean before running release automation');
  }
}

function ensureRemoteBranch() {
  if (
    !commandSucceeds('git', [
      'ls-remote',
      '--exit-code',
      '--heads',
      remote,
      branch,
    ])
  ) {
    fail(`branch ${branch} must exist on ${remote}`);
  }
}

function hasPrereleaseState() {
  return commandSucceeds('git', [
    'ls-files',
    '--error-unmatch',
    '.changeset/pre.json',
  ]);
}

function updateLockfile() {
  run('pnpm', ['install', '--lockfile-only']);
}

function commitVersionChanges() {
  run('git', [
    'add',
    '.changeset',
    'packages',
    'package.json',
    'pnpm-lock.yaml',
    'CHANGELOG.md',
  ]);

  const staged = runOutput('git', ['diff', '--cached', '--name-only']);

  if (staged.length === 0) {
    fail('no release files were staged for commit');
  }

  run('git', ['commit', '-m', `chore: release v${readVersion()}`]);
}

function pushBranch() {
  run('git', ['push', remote, `HEAD:${branch}`]);
}

function readVersion() {
  const filePath = path.join(cwd, versionPackagePath);
  const packageJson = JSON.parse(readFileSync(filePath, 'utf8'));

  if (
    typeof packageJson.version !== 'string' ||
    packageJson.version.length === 0
  ) {
    fail(`could not read version from ${versionPackagePath}`);
  }

  return packageJson.version;
}

function createAndPushTag(version) {
  const tag = `v${version}`;

  if (commandSucceeds('git', ['rev-parse', '--verify', `refs/tags/${tag}`])) {
    fail(`tag ${tag} already exists locally`);
  }

  if (
    commandSucceeds('git', [
      'ls-remote',
      '--exit-code',
      '--tags',
      remote,
      `refs/tags/${tag}`,
    ])
  ) {
    fail(`tag ${tag} already exists on ${remote}`);
  }

  run('git', ['tag', '-a', tag, '-m', `Release ${tag}`]);
  run('git', ['push', remote, `refs/tags/${tag}`]);
}

function runStableRelease() {
  if (branch !== stableBranch) {
    fail(`stable releases must run from ${stableBranch}, received ${branch}`);
  }

  ensureRemoteBranch();
  run('git', ['fetch', remote, branch]);

  if (hasPrereleaseState()) {
    fail('stable releases must not run while .changeset/pre.json exists');
  }

  run('pnpm', ['changeset', 'version']);
  updateLockfile();
  commitVersionChanges();
  pushBranch();
  run('pnpm', ['release:check']);
  run('pnpm', ['release:build']);
  run('pnpm', ['release:publish']);
  createAndPushTag(readVersion());
}

function runRcRelease() {
  if (branch === stableBranch) {
    fail(`rc releases must not run from ${stableBranch}`);
  }

  if (!isReleaseBranch(branch)) {
    fail(
      `rc releases must run from a release/v<version> branch, received ${branch}`,
    );
  }

  ensureRemoteBranch();
  run('git', ['fetch', remote, branch]);

  if (!hasPrereleaseState()) {
    run('pnpm', ['changeset', 'pre', 'enter', 'rc']);
  }

  run('pnpm', ['changeset', 'version']);
  updateLockfile();
  commitVersionChanges();
  pushBranch();
  run('pnpm', ['release:check']);
  run('pnpm', ['release:build']);
  run('pnpm', ['release:publish']);
  createAndPushTag(readVersion());
}

function runCanaryRelease() {
  if (branch === 'HEAD') {
    warn('publishing canary from detached HEAD');
  }

  run('pnpm', ['changeset', 'version', '--snapshot', 'canary']);
  updateLockfile();
  run('pnpm', ['release:check']);
  run('pnpm', ['release:build']);
  run('pnpm', ['changeset', 'publish', '--tag', 'canary', '--no-git-tag']);
}

ensureCleanWorktree();

if (mode === 'stable') {
  runStableRelease();
  process.exit(0);
}

if (mode === 'rc') {
  runRcRelease();
  process.exit(0);
}

runCanaryRelease();
