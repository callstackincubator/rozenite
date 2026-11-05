import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {
  buildTarget,
  getTscEmits,
  prepareEmit,
  writeModuleTypeMarker,
} from '../utils/tsc-build.js';

const require = createRequire(import.meta.url);

const tempDirs: string[] = [];

const createTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rozenite-tsc-'));
  tempDirs.push(dir);
  return dir;
};

const readJson = async (filePath: string) => {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('getTscEmits', () => {
  it('emits both module formats for React Native', () => {
    // React Native 0.76-0.78 ship Metro 0.81, which resolves the root entry
    // through `main` because package exports are off by default.
    expect(getTscEmits('react-native')).toEqual([
      {
        target: 'react-native',
        format: 'esm',
        outDir: 'dist/react-native',
        declaration: true,
        js: true,
      },
      {
        target: 'react-native',
        format: 'cjs',
        outDir: 'dist/react-native/cjs',
        declaration: false,
        js: true,
      },
    ]);
  });

  it.each(['metro', 'sdk'] as const)('emits CommonJS JavaScript only for %s', (target) => {
    expect(getTscEmits(target)).toEqual([
      { target, format: 'esm', outDir: `dist/${target}`, declaration: true, js: false },
      { target, format: 'cjs', outDir: `dist/${target}`, declaration: false, js: true },
    ]);
  });

  it('declares types exactly once per target, in the first emit', () => {
    for (const target of ['react-native', 'metro', 'sdk'] as const) {
      const emits = getTscEmits(target);
      expect(emits.filter((emit) => emit.declaration)).toHaveLength(1);
      expect(emits[0]).toMatchObject({ format: 'esm', declaration: true });
    }
  });
});

describe('writeModuleTypeMarker', () => {
  it('marks output directories so Node reads the plain .js files correctly', async () => {
    const projectRoot = await createTempDir();
    const [esm, cjs] = getTscEmits('react-native');

    await writeModuleTypeMarker(projectRoot, esm);
    await writeModuleTypeMarker(projectRoot, cjs);

    expect(await readJson(path.join(projectRoot, esm.outDir, 'package.json'))).toEqual({
      type: 'module',
    });
    expect(await readJson(path.join(projectRoot, cjs.outDir, 'package.json'))).toEqual({
      type: 'commonjs',
    });
  });
});

describe('prepareEmit', () => {
  it('generates an emitting config that extends the plugin tsconfig', async () => {
    const projectRoot = await createTempDir();
    const [esm] = getTscEmits('react-native');

    const configPath = await prepareEmit(projectRoot, esm, 5);
    const config = await readJson(configPath);

    expect(path.relative(projectRoot, configPath)).toBe(
      path.join('.rozenite', 'tsconfig.react-native.esm.json'),
    );
    expect(config.extends).toBe('../tsconfig.json');
    expect(config.files).toEqual(['../react-native.ts']);
    expect(config.compilerOptions).toMatchObject({
      noEmit: false,
      noEmitOnError: true,
      declaration: true,
      module: 'ESNext',
      moduleResolution: 'bundler',
      rootDir: '..',
      outDir: '../dist/react-native',
    });
    // The `development` condition plugin tsconfigs enable for editor support
    // would otherwise pull workspace sources into the published build.
    expect(config.compilerOptions.customConditions).toBeNull();
    // Ambient declarations are never imported, so `files` alone would drop them.
    expect(config.include).toContain('../src/**/*.d.ts');
  });

  it('declares Metro types from a type checking emit that resolves through exports', async () => {
    const projectRoot = await createTempDir();
    const [types] = getTscEmits('metro');

    const configPath = await prepareEmit(projectRoot, types, 5);
    const config = await readJson(configPath);

    expect(config.compilerOptions).toMatchObject({
      emitDeclarationOnly: true,
      declaration: true,
      moduleResolution: 'bundler',
      outDir: '../dist/metro',
    });
    expect(config.compilerOptions).not.toHaveProperty('noCheck');
    // The CommonJS emit sharing the directory writes the module type marker.
    await expect(fs.access(path.join(projectRoot, 'dist/metro/package.json'))).rejects.toThrow();
  });

  it('emits CommonJS with node10 and without checks before TypeScript 6', async () => {
    const projectRoot = await createTempDir();
    const [, cjs] = getTscEmits('metro');

    const config = await readJson(await prepareEmit(projectRoot, cjs, 5));

    expect(config.files).toEqual(['../metro.ts']);
    expect(config.compilerOptions).toMatchObject({
      emitDeclarationOnly: false,
      declaration: false,
      module: 'CommonJS',
      moduleResolution: 'node10',
      outDir: '../dist/metro',
      // `node10` ignores `exports`, so checking here would fail on packages
      // that publish their types only there, like React Native 0.87+.
      noCheck: true,
    });
  });

  it('type checks CommonJS output through exports from TypeScript 6', async () => {
    const projectRoot = await createTempDir();
    const [, cjs] = getTscEmits('react-native');

    const config = await readJson(await prepareEmit(projectRoot, cjs, 6));

    expect(config.compilerOptions).toMatchObject({
      module: 'CommonJS',
      moduleResolution: 'bundler',
    });
    expect(config.compilerOptions).not.toHaveProperty('noCheck');
  });
});

describe('buildTarget', () => {
  const TYPESCRIPT_PACKAGES = {
    'TypeScript 5': path.dirname(require.resolve('typescript/package.json')),
    'TypeScript 6': path.dirname(require.resolve('typescript-6/package.json')),
  };

  const ENTRY_FILES = ['react-native.ts', 'metro.ts', 'sdk.ts'];

  // The plugin depends on a package that publishes its types only through `exports`, like React Native 0.87+.
  const createPlugin = async (typescriptDir: string, source: string) => {
    const projectRoot = await createTempDir();
    const nodeModules = path.join(projectRoot, 'node_modules');
    const exportsOnly = path.join(nodeModules, 'exports-only');

    await fs.mkdir(path.join(exportsOnly, 'types'), { recursive: true });
    await fs.mkdir(path.join(nodeModules, '.bin'), { recursive: true });
    await fs.symlink(typescriptDir, path.join(nodeModules, 'typescript'), 'dir');
    await fs.symlink(path.join(typescriptDir, 'bin', 'tsc'), path.join(nodeModules, '.bin', 'tsc'));

    await fs.writeFile(
      path.join(exportsOnly, 'package.json'),
      JSON.stringify({
        name: 'exports-only',
        main: './index.js',
        exports: { '.': { types: './types/index.d.ts', default: './index.js' } },
      }),
    );
    await fs.writeFile(path.join(exportsOnly, 'index.js'), 'module.exports = {};\n');
    await fs.writeFile(
      path.join(exportsOnly, 'types', 'index.d.ts'),
      'export type Message = { text: string };\n',
    );

    await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({ name: 'plugin' }));
    await fs.writeFile(
      path.join(projectRoot, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          strict: true,
          skipLibCheck: true,
          module: 'ESNext',
          moduleResolution: 'bundler',
          noEmit: true,
          types: [],
        },
      }),
    );

    await Promise.all(
      ENTRY_FILES.map((file) => fs.writeFile(path.join(projectRoot, file), source)),
    );

    return projectRoot;
  };

  const exists = async (filePath: string) =>
    fs.access(filePath).then(
      () => true,
      () => false,
    );

  it.each(Object.entries(TYPESCRIPT_PACKAGES))(
    'builds every target against types published only through exports with %s',
    async (_, typescriptDir) => {
      const projectRoot = await createPlugin(
        typescriptDir,
        "import type { Message } from 'exports-only';\n" +
          'export const format = (message: Message): string => message.text;\n',
      );

      for (const target of ['react-native', 'metro', 'sdk'] as const) {
        await buildTarget(projectRoot, target);
      }

      const dist = path.join(projectRoot, 'dist');
      expect(await exists(path.join(dist, 'react-native/react-native.js'))).toBe(true);
      expect(await exists(path.join(dist, 'react-native/react-native.d.ts'))).toBe(true);
      expect(
        await fs.readFile(path.join(dist, 'react-native/cjs/react-native.js'), 'utf8'),
      ).toContain('exports.format');
      for (const target of ['metro', 'sdk']) {
        expect(await fs.readFile(path.join(dist, target, `${target}.js`), 'utf8')).toContain(
          'exports.format',
        );
        expect(await exists(path.join(dist, target, `${target}.d.ts`))).toBe(true);
      }
    },
    60_000,
  );

  it.each(['react-native', 'metro'] as const)(
    'writes no %s JavaScript when the sources fail to type check',
    async (target) => {
      const projectRoot = await createPlugin(
        TYPESCRIPT_PACKAGES['TypeScript 5'],
        'export const value: number = "not a number";\n',
      );

      await expect(buildTarget(projectRoot, target)).rejects.toThrow('TS2322');

      const dist = path.join(projectRoot, 'dist');
      expect(await exists(path.join(dist, 'react-native/react-native.js'))).toBe(false);
      expect(await exists(path.join(dist, 'react-native/cjs/react-native.js'))).toBe(false);
      expect(await exists(path.join(dist, 'metro/metro.js'))).toBe(false);
    },
    60_000,
  );

  it('rejects code that only CommonJS cannot express from TypeScript 6', async () => {
    const projectRoot = await createPlugin(
      TYPESCRIPT_PACKAGES['TypeScript 6'],
      'export const url = import.meta.url;\n',
    );

    await expect(buildTarget(projectRoot, 'react-native')).rejects.toThrow('TS1343');
    expect(await exists(path.join(projectRoot, 'dist/react-native/cjs/react-native.js'))).toBe(
      false,
    );
  }, 60_000);
});
