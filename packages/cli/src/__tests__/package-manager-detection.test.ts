import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getExecForPackageManager } from '../utils/packages.js';

describe('Package Manager Detection', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rozenite-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should detect pnpm from pnpm-lock.yaml', () => {
    fs.writeFileSync(
      path.join(testDir, 'pnpm-lock.yaml'),
      'lockfileVersion: 9.0',
    );
    const exec = getExecForPackageManager(testDir);
    expect(exec).toBe('pnpx');
  });

  it('should detect yarn from yarn.lock', () => {
    fs.writeFileSync(path.join(testDir, 'yarn.lock'), '# yarn lock file');
    const exec = getExecForPackageManager(testDir);
    expect(exec).toBe('yarn dlx');
  });

  it('should detect bun from bun.lockb', () => {
    fs.writeFileSync(path.join(testDir, 'bun.lockb'), '');
    const exec = getExecForPackageManager(testDir);
    expect(exec).toBe('bunx');
  });

  it('should detect bun from bun.lock', () => {
    fs.writeFileSync(path.join(testDir, 'bun.lock'), '');
    const exec = getExecForPackageManager(testDir);
    expect(exec).toBe('bunx');
  });

  it('should detect npm from package-lock.json', () => {
    fs.writeFileSync(path.join(testDir, 'package-lock.json'), '{}');
    const exec = getExecForPackageManager(testDir);
    expect(exec).toBe('npx');
  });

  it('should prefer pnpm over other lockfiles', () => {
    fs.writeFileSync(
      path.join(testDir, 'pnpm-lock.yaml'),
      'lockfileVersion: 9.0',
    );
    fs.writeFileSync(path.join(testDir, 'package-lock.json'), '{}');
    const exec = getExecForPackageManager(testDir);
    expect(exec).toBe('pnpx');
  });

  it('should prefer yarn over npm', () => {
    fs.writeFileSync(path.join(testDir, 'yarn.lock'), '# yarn lock file');
    fs.writeFileSync(path.join(testDir, 'package-lock.json'), '{}');
    const exec = getExecForPackageManager(testDir);
    expect(exec).toBe('yarn dlx');
  });

  it('should fallback to environment when no lockfile exists', () => {
    // Save original env
    const originalEnv = process.env.npm_config_user_agent;

    try {
      process.env.npm_config_user_agent = 'pnpm/9.0.0';
      const exec = getExecForPackageManager(testDir);
      expect(exec).toBe('pnpx');
    } finally {
      // Restore original env
      if (originalEnv) {
        process.env.npm_config_user_agent = originalEnv;
      } else {
        delete process.env.npm_config_user_agent;
      }
    }
  });

  it('should default to npm when no lockfile and no env set', () => {
    const originalEnv = process.env.npm_config_user_agent;

    try {
      delete process.env.npm_config_user_agent;
      const exec = getExecForPackageManager(testDir);
      expect(exec).toBe('npx');
    } finally {
      if (originalEnv) {
        process.env.npm_config_user_agent = originalEnv;
      }
    }
  });
});
