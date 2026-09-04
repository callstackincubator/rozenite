import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isLynxProject, isProject } from '../utils/packages.js';

const tempDirs: string[] = [];

const createTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rozenite-lynx-detect-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('isLynxProject', () => {
  it('returns false for a directory with no package.json and no lynx.config file', async () => {
    const projectRoot = await createTempDir();

    expect(isLynxProject(projectRoot)).toBe(false);
  });

  it('returns false for a React Native project', async () => {
    const projectRoot = await createTempDir();
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.76.0' } }),
      'utf8',
    );

    expect(isLynxProject(projectRoot)).toBe(false);
  });

  it('returns false when package.json declares @lynx-js/rspeedy but no lynx.config file exists', async () => {
    const projectRoot = await createTempDir();
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ devDependencies: { '@lynx-js/rspeedy': '0.9.0' } }),
      'utf8',
    );

    // A Lynx project always has a lynx.config.* file -- rspeedy loads it to
    // run at all -- so requiring it (rather than treating the package.json
    // dependency as sufficient on its own) is what guarantees
    // wrapLynxConfigFile always has a file to wrap once this is true.
    expect(isLynxProject(projectRoot)).toBe(false);
  });

  it('returns true when a lynx.config.ts file exists, even without package.json', async () => {
    const projectRoot = await createTempDir();
    await fs.writeFile(path.join(projectRoot, 'lynx.config.ts'), 'export default {};\n', 'utf8');

    expect(isLynxProject(projectRoot)).toBe(true);
  });

  it('returns true when a lynx.config.js file exists', async () => {
    const projectRoot = await createTempDir();
    await fs.writeFile(path.join(projectRoot, 'lynx.config.js'), 'module.exports = {};\n', 'utf8');

    expect(isLynxProject(projectRoot)).toBe(true);
  });

  it('does not consider a Lynx project a React Native project', async () => {
    const projectRoot = await createTempDir();
    await fs.writeFile(path.join(projectRoot, 'lynx.config.ts'), 'export default {};\n', 'utf8');

    expect(isProject(projectRoot)).toBe(false);
  });
});
