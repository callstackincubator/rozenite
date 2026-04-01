#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

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

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`Warning: ${message}`);
}

const mode = process.env.RELEASE_MODE;

if (mode !== 'rc' && mode !== 'canary') {
  fail('RELEASE_MODE must be set to rc or canary');
}

const rawRefName =
  process.env.GITHUB_REF_NAME ||
  runOutput('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
const branch = rawRefName.replace(/^refs\/heads\//, '');
const remote = process.env.GIT_REMOTE ?? 'origin';

function ensureCleanWorktree() {
  const status = runOutput('git', ['status', '--porcelain']);

  if (status.length > 0) {
    fail('working tree must be clean before running prerelease automation');
  }
}

function ensureRemoteBranch() {
  try {
    run('git', ['ls-remote', '--exit-code', '--heads', remote, branch]);
  } catch {
    fail(`branch ${branch} must exist on ${remote} before running rc releases`);
  }
}

function commitVersionChanges(message) {
  const changedFiles = runOutput('git', ['status', '--porcelain']);

  if (changedFiles.length === 0) {
    fail('changeset version did not produce any file changes to commit');
  }

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

  run('git', ['commit', '-m', message]);
  run('git', ['push', remote, `HEAD:${branch}`]);
}

ensureCleanWorktree();

if (mode === 'rc') {
  if (branch === 'main') {
    fail('rc prereleases must not run from main');
  }

  if (!branch.startsWith('release/')) {
    fail(`rc prereleases must run from a release/* branch, received ${branch}`);
  }

  ensureRemoteBranch();
  run('git', ['fetch', remote, branch]);

  let inPrerelease = true;

  try {
    runOutput('git', ['ls-files', '--error-unmatch', '.changeset/pre.json']);
  } catch {
    inPrerelease = false;
  }

  if (!inPrerelease) {
    run('pnpm', ['changeset', 'pre', 'enter', 'rc']);
  }

  run('pnpm', ['changeset', 'version']);
  commitVersionChanges('Version packages for rc release');
  run('pnpm', ['release:check']);
  run('pnpm', ['release:build']);
  run('pnpm', ['changeset', 'publish']);
  process.exit(0);
}

if (branch === 'HEAD') {
  warn('publishing canary from detached HEAD');
}

run('pnpm', ['changeset', 'version', '--snapshot', 'canary']);
run('pnpm', ['release:check']);
run('pnpm', ['release:build']);
run('pnpm', ['changeset', 'publish', '--tag', 'canary', '--no-git-tag']);
