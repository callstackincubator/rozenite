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
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('syncPluginPackageJSON', () => {
  it('preserves unknown exports, and drops the legacy managed development condition, while updating managed entries', async () => {
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
        './sdk': {
          development: './sdk.ts',
          types: './dist/sdk.d.ts',
          import: './dist/sdk.js',
          require: './dist/sdk.cjs',
        },
        './custom': './src/custom.ts',
      },
    });

    await fs.writeFile(path.join(projectRoot, 'react-native.ts'), 'export {}\n');
    await fs.writeFile(path.join(projectRoot, 'metro.ts'), 'export {}\n');
    await fs.writeFile(path.join(projectRoot, 'sdk.ts'), 'export {}\n');

    const result = await syncPluginPackageJSON(projectRoot);
    const packageJson = JSON.parse(
      await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    );

    expect(result.updatedFields).toEqual(['main', 'module', 'types', 'exports']);
    expect(packageJson.main).toBe('./dist/react-native/cjs/react-native.js');
    expect(packageJson.module).toBe('./dist/react-native/react-native.js');
    expect(packageJson.types).toBe('./dist/react-native/react-native.d.ts');
    expect(packageJson.exports).toEqual({
      '.': {
        types: './dist/react-native/react-native.d.ts',
        import: './dist/react-native/react-native.js',
        require: './dist/react-native/cjs/react-native.js',
      },
      './metro': {
        types: './dist/metro/metro.d.ts',
        default: './dist/metro/metro.js',
      },
      './sdk': {
        types: './dist/sdk/sdk.d.ts',
        default: './dist/sdk/sdk.js',
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
      main: './dist/react-native/cjs/react-native.js',
      module: './dist/react-native/react-native.js',
      types: './dist/react-native/react-native.d.ts',
      exports: {
        '.': {
          types: './dist/react-native/react-native.d.ts',
          import: './dist/react-native/react-native.js',
          require: './dist/react-native/cjs/react-native.js',
        },
        './metro': {
          types: './dist/metro/metro.d.ts',
          default: './dist/metro/metro.js',
        },
        './sdk': {
          development: './sdk.ts',
          types: './dist/sdk/sdk.d.ts',
          default: './dist/sdk/sdk.js',
        },
        './custom': './src/custom.ts',
      },
    });

    await fs.writeFile(path.join(projectRoot, 'react-native.ts'), 'export {}\n');

    const result = await syncPluginPackageJSON(projectRoot);
    const packageJson = JSON.parse(
      await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    );

    expect(result.updatedFields).toEqual(['exports']);
    expect(packageJson.exports).toEqual({
      '.': {
        types: './dist/react-native/react-native.d.ts',
        import: './dist/react-native/react-native.js',
        require: './dist/react-native/cjs/react-native.js',
      },
      './custom': './src/custom.ts',
      './package.json': './package.json',
    });
  });

  it('adds the managed sdk export without a development condition when sdk.ts exists', async () => {
    const projectRoot = await createTempDir();

    await writeJson(path.join(projectRoot, 'package.json'), {
      name: 'demo-plugin',
      type: 'module',
      exports: {
        './custom': './src/custom.ts',
      },
    });

    await fs.writeFile(path.join(projectRoot, 'react-native.ts'), 'export {}\n');
    await fs.writeFile(path.join(projectRoot, 'sdk.ts'), 'export {}\n');

    const result = await syncPluginPackageJSON(projectRoot);
    const packageJson = JSON.parse(
      await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    );

    expect(result.updatedFields).toEqual(['main', 'module', 'types', 'exports']);
    expect(packageJson.exports).toEqual({
      '.': {
        types: './dist/react-native/react-native.d.ts',
        import: './dist/react-native/react-native.js',
        require: './dist/react-native/cjs/react-native.js',
      },
      './sdk': {
        types: './dist/sdk/sdk.d.ts',
        default: './dist/sdk/sdk.js',
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

  describe('development condition', () => {
    const rootExports = {
      types: './dist/react-native/react-native.d.ts',
      import: './dist/react-native/react-native.js',
      require: './dist/react-native/cjs/react-native.js',
    };
    const sdkExport = {
      types: './dist/sdk/sdk.d.ts',
      default: './dist/sdk/sdk.js',
    };

    const createPlugin = async (packageJson: Record<string, unknown>) => {
      const projectRoot = await createTempDir();

      await writeJson(path.join(projectRoot, 'package.json'), {
        name: 'demo-plugin',
        type: 'module',
        ...packageJson,
      });
      await fs.writeFile(path.join(projectRoot, 'react-native.ts'), 'export {}\n');
      await fs.writeFile(path.join(projectRoot, 'sdk.ts'), 'export {}\n');

      return projectRoot;
    };

    const readPackageJson = async (projectRoot: string) =>
      JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));

    it('keeps a development condition the author wrote', async () => {
      const projectRoot = await createPlugin({
        exports: { './sdk': { development: './src/sdk-source.ts', ...sdkExport } },
      });

      await syncPluginPackageJSON(projectRoot);

      expect((await readPackageJson(projectRoot)).exports['./sdk']).toEqual({
        development: './src/sdk-source.ts',
        ...sdkExport,
      });
    });

    it('drops the development condition rozenite build used to write', async () => {
      const projectRoot = await createPlugin({
        exports: { './sdk': { development: './sdk.ts', ...sdkExport } },
      });

      await syncPluginPackageJSON(projectRoot);

      expect((await readPackageJson(projectRoot)).exports['./sdk']).toEqual(sdkExport);
    });

    it('does not touch a package without publishConfig.exports', async () => {
      const projectRoot = await createPlugin({ publishConfig: { access: 'public' } });

      await syncPluginPackageJSON(projectRoot);

      expect((await readPackageJson(projectRoot)).publishConfig).toEqual({ access: 'public' });
    });

    it('keeps publishConfig.exports in step with the managed entries, without development', async () => {
      const projectRoot = await createPlugin({
        exports: { './sdk': { development: './src/sdk-source.ts', ...sdkExport } },
        publishConfig: {
          access: 'public',
          exports: { './custom': './dist/custom.js' },
        },
      });
      await fs.writeFile(path.join(projectRoot, 'metro.ts'), 'export {}\n');

      const result = await syncPluginPackageJSON(projectRoot);
      const packageJson = await readPackageJson(projectRoot);

      expect(result.updatedFields).toContain('publishConfig.exports');
      expect(packageJson.publishConfig).toEqual({
        access: 'public',
        exports: {
          './custom': './dist/custom.js',
          '.': rootExports,
          './package.json': './package.json',
          './metro': { types: './dist/metro/metro.d.ts', default: './dist/metro/metro.js' },
          './sdk': sdkExport,
        },
      });
      expect(packageJson.exports['./sdk'].development).toBe('./src/sdk-source.ts');
    });

    it('removes managed entries from publishConfig.exports when their target is gone', async () => {
      const projectRoot = await createPlugin({
        exports: {},
        publishConfig: {
          exports: {
            '.': rootExports,
            './package.json': './package.json',
            './metro': { types: './dist/metro/metro.d.ts', default: './dist/metro/metro.js' },
            './sdk': sdkExport,
            './custom': './dist/custom.js',
          },
        },
      });
      await fs.rm(path.join(projectRoot, 'sdk.ts'));

      await syncPluginPackageJSON(projectRoot);

      expect((await readPackageJson(projectRoot)).publishConfig.exports).toEqual({
        '.': rootExports,
        './package.json': './package.json',
        './custom': './dist/custom.js',
      });
    });

    it('leaves a matching publishConfig.exports alone', async () => {
      const projectRoot = await createPlugin({ exports: {}, publishConfig: { exports: {} } });

      await syncPluginPackageJSON(projectRoot);
      const result = await syncPluginPackageJSON(projectRoot);

      expect(result.updatedFields).toEqual([]);
    });
  });
});
