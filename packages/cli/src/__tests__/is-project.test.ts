import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isProject } from '../utils/packages.js';

describe('isProject', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rozenite-is-project-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('returns false when there is no package.json', () => {
    expect(isProject(testDir)).toBe(false);
  });

  it('returns true for a React Native project', () => {
    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '^0.76.0' } }),
    );

    expect(isProject(testDir)).toBe(true);
  });

  it('returns true for a Lynx (rspeedy) project, which has no react-native dependency', () => {
    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        dependencies: { '@lynx-js/react': '^0.124.0' },
        devDependencies: { '@lynx-js/rspeedy': '^0.16.0' },
      }),
    );

    expect(isProject(testDir)).toBe(true);
  });

  it('returns false for an unrelated project', () => {
    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({ dependencies: { react: '^19.0.0' } }),
    );

    expect(isProject(testDir)).toBe(false);
  });
});
