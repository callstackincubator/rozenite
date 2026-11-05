import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bootstrapPlugin } from '../commands/generate/bootstrap-plugin.js';
import { getPackageJSON } from '../package-json.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('plugin template', () => {
  it('depends on the Rozenite version the CLI belongs to', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rozenite-template-'));
    tempDirs.push(projectRoot);

    await bootstrapPlugin(projectRoot, { name: 'my-plugin', description: 'A plugin' });

    const { dependencies, devDependencies } = JSON.parse(
      await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    );
    const version = `^${getPackageJSON().version}`;

    expect({
      rozenite: devDependencies.rozenite,
      '@rozenite/vite-plugin': devDependencies['@rozenite/vite-plugin'],
      '@rozenite/plugin-bridge': dependencies['@rozenite/plugin-bridge'],
    }).toEqual({
      rozenite: version,
      '@rozenite/vite-plugin': version,
      '@rozenite/plugin-bridge': version,
    });
  });
});
