import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getAvailableBundlerTypes } from '../project-type.js';

describe('getAvailableBundlerTypes', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-type-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns an empty list when no bundler config or dependency is present', async () => {
    expect(getAvailableBundlerTypes(tempDir)).toEqual([]);
  });

  it('detects Lynx from a lynx.config.ts file', async () => {
    await fs.writeFile(path.join(tempDir, 'lynx.config.ts'), 'export default {};');

    expect(getAvailableBundlerTypes(tempDir)).toEqual(['lynx']);
  });

  it('detects Lynx from a lynx.config.js file', async () => {
    await fs.writeFile(path.join(tempDir, 'lynx.config.js'), 'module.exports = {};');

    expect(getAvailableBundlerTypes(tempDir)).toEqual(['lynx']);
  });

  it('detects Lynx from @lynx-js/rspeedy in devDependencies, even without a config file', async () => {
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'my-lynx-app',
        devDependencies: { '@lynx-js/rspeedy': '^0.16.0' },
      }),
    );

    expect(getAvailableBundlerTypes(tempDir)).toEqual(['lynx']);
  });

  it('detects Lynx from @lynx-js/rspeedy in dependencies', async () => {
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'my-lynx-app',
        dependencies: { '@lynx-js/rspeedy': '^0.16.0' },
      }),
    );

    expect(getAvailableBundlerTypes(tempDir)).toEqual(['lynx']);
  });

  it('does not detect Lynx from an unrelated package.json', async () => {
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'my-app', dependencies: { react: '^19.0.0' } }),
    );

    expect(getAvailableBundlerTypes(tempDir)).toEqual([]);
  });

  it('does not throw on a malformed package.json', async () => {
    await fs.writeFile(path.join(tempDir, 'package.json'), '{ not valid json');

    expect(getAvailableBundlerTypes(tempDir)).toEqual([]);
  });

  it('detects Metro, Re.Pack, and Lynx together in a mixed workspace', async () => {
    await fs.writeFile(path.join(tempDir, 'metro.config.js'), 'module.exports = {};');
    await fs.writeFile(path.join(tempDir, 'rspack.config.js'), 'module.exports = {};');
    await fs.writeFile(path.join(tempDir, 'lynx.config.ts'), 'export default {};');

    expect(getAvailableBundlerTypes(tempDir)).toEqual(['metro', 'repack', 'lynx']);
  });
});
