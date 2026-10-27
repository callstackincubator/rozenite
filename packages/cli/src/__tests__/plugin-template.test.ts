import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { TEMPLATE_DIR } from '../constants.js';

const readJson = async (filePath: string) => JSON.parse(await fs.readFile(filePath, 'utf8'));

describe('plugin template', () => {
  it('depends on the Rozenite major line the CLI belongs to', async () => {
    const { version } = await readJson(path.resolve(__dirname, '..', '..', 'package.json'));
    const { dependencies, devDependencies } = await readJson(
      path.join(TEMPLATE_DIR, 'package.json'),
    );
    const sameMajor = expect.stringMatching(new RegExp(`^\\^${version.split('.')[0]}\\.`));

    expect({
      rozenite: devDependencies.rozenite,
      '@rozenite/vite-plugin': devDependencies['@rozenite/vite-plugin'],
      '@rozenite/plugin-bridge': dependencies['@rozenite/plugin-bridge'],
    }).toEqual({
      rozenite: sameMajor,
      '@rozenite/vite-plugin': sameMajor,
      '@rozenite/plugin-bridge': sameMajor,
    });
  });
});
