import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncPluginPackageJSON } from '../utils/plugin-package-json.js';

const tempDirs: string[] = [];

const createTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rozenite-plugin-'));
  tempDirs.push(dir);
  return dir;
};

const writeJson = async (filePath: string, value: unknown) => {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n');
};

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe('syncPluginPackageJSON', () => {
  it('preserves unknown exports while updating managed entries', async () => {
    const projectRoot = await createTempDir();

    await writeJson(path.join(projectRoot, 'package.json'), {
      name: 'demo-plugin',
      type: 'module',
      main: './dist/react-native.cjs',
      module: './dist/react-native.js',
      types: './dist/react-native.d.ts',
      exports: {
        '.': {
          types: './dist/react-native.d.ts',
          import: './dist/react-native.js',
          require: './dist/react-native.cjs',
        },
        './metro': {
          types: './dist/metro.d.ts',
          import: './dist/metro.js',
          require: './dist/metro.cjs',
        },
        './custom': './src/custom.ts',
      },
    });

    await fs.writeFile(
      path.join(projectRoot, 'react-native.ts'),
      'export {}\n',
    );
    await fs.writeFile(path.join(projectRoot, 'metro.ts'), 'export {}\n');

    const result = await syncPluginPackageJSON(projectRoot);
    const packageJson = JSON.parse(
      await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    );

    expect(result.updatedFields).toEqual([
      'main',
      'module',
      'types',
      'exports',
    ]);
    expect(packageJson.main).toBe('./dist/react-native/index.cjs');
    expect(packageJson.module).toBe('./dist/react-native/index.js');
    expect(packageJson.types).toBe('./dist/react-native/index.d.ts');
    expect(packageJson.exports).toEqual({
      '.': {
        types: './dist/react-native/index.d.ts',
        import: './dist/react-native/index.js',
        require: './dist/react-native/index.cjs',
      },
      './metro': {
        types: './dist/metro/index.d.ts',
        import: './dist/metro/index.js',
        require: './dist/metro/index.cjs',
      },
      './custom': './src/custom.ts',
      './package.json': './package.json',
    });
  });

  it('removes only the managed metro export when no metro target exists', async () => {
    const projectRoot = await createTempDir();

    await writeJson(path.join(projectRoot, 'package.json'), {
      name: 'demo-plugin',
      type: 'module',
      main: './dist/react-native/index.cjs',
      module: './dist/react-native/index.js',
      types: './dist/react-native/index.d.ts',
      exports: {
        '.': {
          types: './dist/react-native/index.d.ts',
          import: './dist/react-native/index.js',
          require: './dist/react-native/index.cjs',
        },
        './metro': {
          types: './dist/metro/index.d.ts',
          import: './dist/metro/index.js',
          require: './dist/metro/index.cjs',
        },
        './custom': './src/custom.ts',
      },
    });

    await fs.writeFile(
      path.join(projectRoot, 'react-native.ts'),
      'export {}\n',
    );

    const result = await syncPluginPackageJSON(projectRoot);
    const packageJson = JSON.parse(
      await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    );

    expect(result.updatedFields).toEqual(['exports']);
    expect(packageJson.exports).toEqual({
      '.': {
        types: './dist/react-native/index.d.ts',
        import: './dist/react-native/index.js',
        require: './dist/react-native/index.cjs',
      },
      './custom': './src/custom.ts',
      './package.json': './package.json',
    });
  });

  it('leaves root entry fields untouched when there is no react native target', async () => {
    const projectRoot = await createTempDir();

    await writeJson(path.join(projectRoot, 'package.json'), {
      name: 'demo-plugin',
      type: 'module',
      main: './custom-main.cjs',
      module: './custom-module.js',
      types: './custom-types.d.ts',
      exports: {
        '.': './custom-entry.js',
        './metro': {
          types: './dist/metro/index.d.ts',
          import: './dist/metro/index.js',
          require: './dist/metro/index.cjs',
        },
        './custom': './src/custom.ts',
      },
    });

    const result = await syncPluginPackageJSON(projectRoot);
    const packageJson = JSON.parse(
      await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    );

    expect(result.updatedFields).toEqual(['exports']);
    expect(packageJson.main).toBe('./custom-main.cjs');
    expect(packageJson.module).toBe('./custom-module.js');
    expect(packageJson.types).toBe('./custom-types.d.ts');
    expect(packageJson.exports).toEqual({
      '.': './custom-entry.js',
      './custom': './src/custom.ts',
    });
  });
});
