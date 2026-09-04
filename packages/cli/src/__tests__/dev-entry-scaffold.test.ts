import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  DEV_ENTRY_TEMPLATE,
  getMountInstructions,
  scaffoldDevEntryFile,
} from '../utils/dev-entry-scaffold.js';

const tempDirs: string[] = [];

const createTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rozenite-dev-entry-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('scaffoldDevEntryFile', () => {
  it('creates rozenite.dev.tsx with the expected default export when nothing exists', async () => {
    const projectRoot = await createTempDir();

    const result = await scaffoldDevEntryFile(projectRoot);

    const expectedPath = path.join(projectRoot, 'rozenite.dev.tsx');
    expect(result).toEqual({ status: 'created', filePath: expectedPath });

    const contents = await fs.readFile(expectedPath, 'utf8');
    expect(contents).toBe(DEV_ENTRY_TEMPLATE);
    expect(contents).toContain('export default function RozeniteDevTools()');
  });

  it('leaves an existing rozenite.dev.tsx byte-for-byte untouched', async () => {
    const projectRoot = await createTempDir();
    const existingPath = path.join(projectRoot, 'rozenite.dev.tsx');
    const existingContents =
      '// custom dev entry\nexport default function RozeniteDevTools() {\n  return null;\n}\n';
    await fs.writeFile(existingPath, existingContents, 'utf8');

    const result = await scaffoldDevEntryFile(projectRoot);

    expect(result).toEqual({ status: 'skipped', filePath: existingPath });
    const contentsAfter = await fs.readFile(existingPath, 'utf8');
    expect(contentsAfter).toBe(existingContents);
  });

  it('skips when only rozenite.dev.js exists', async () => {
    const projectRoot = await createTempDir();
    const existingPath = path.join(projectRoot, 'rozenite.dev.js');
    const existingContents = 'module.exports = function RozeniteDevTools() { return null; };\n';
    await fs.writeFile(existingPath, existingContents, 'utf8');

    const result = await scaffoldDevEntryFile(projectRoot);

    expect(result).toEqual({ status: 'skipped', filePath: existingPath });
    expect(await fs.readdir(projectRoot)).toEqual(['rozenite.dev.js']);
  });

  it('skips when only a platform-suffixed rozenite.dev.ios.tsx exists', async () => {
    const projectRoot = await createTempDir();
    const existingPath = path.join(projectRoot, 'rozenite.dev.ios.tsx');
    const existingContents = 'export default function RozeniteDevTools() {\n  return null;\n}\n';
    await fs.writeFile(existingPath, existingContents, 'utf8');

    const result = await scaffoldDevEntryFile(projectRoot);

    expect(result).toEqual({ status: 'skipped', filePath: existingPath });
    expect(await fs.readdir(projectRoot)).toEqual(['rozenite.dev.ios.tsx']);
  });
});

describe('getMountInstructions', () => {
  it('defaults to the React Native mount snippet', () => {
    const instructions = getMountInstructions();

    expect(instructions).toContain("import Rozenite from '@rozenite/react-native';");
    expect(instructions).toContain('<Rozenite />');
    expect(instructions).toContain('rozenite.dev.tsx');
    expect(instructions).not.toContain('@rozenite/lynx');
  });

  it('prints the React Native mount snippet explicitly', () => {
    const instructions = getMountInstructions('react-native');

    expect(instructions).toContain("import Rozenite from '@rozenite/react-native';");
    expect(instructions).toContain('<>');
  });

  it('prints the Lynx mount snippet', () => {
    const instructions = getMountInstructions('lynx');

    expect(instructions).toContain("import Rozenite from '@rozenite/lynx';");
    expect(instructions).toContain('<Rozenite />');
    expect(instructions).toContain('<view>');
    expect(instructions).toContain('rozenite.dev.tsx');
    expect(instructions).not.toContain('@rozenite/react-native');
  });
});
