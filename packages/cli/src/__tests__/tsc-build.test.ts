import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getTscEmits, prepareEmit, writeModuleTypeMarker } from '../utils/tsc-build.js';

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
      { target: 'react-native', format: 'esm', outDir: 'dist/react-native', declaration: true },
      {
        target: 'react-native',
        format: 'cjs',
        outDir: 'dist/react-native/cjs',
        declaration: false,
      },
    ]);
  });

  it.each(['metro', 'sdk'] as const)('emits CommonJS only for %s', (target) => {
    expect(getTscEmits(target)).toEqual([
      { target, format: 'cjs', outDir: `dist/${target}`, declaration: true },
    ]);
  });

  it('declares types exactly once per target', () => {
    for (const target of ['react-native', 'metro', 'sdk'] as const) {
      expect(getTscEmits(target).filter((emit) => emit.declaration)).toHaveLength(1);
    }
  });

  it('adds register.ts to both react-native emits, not a target of its own', () => {
    // `register.ts` must share the react-native target's single output tree
    // rather than emit a second copy of `dist/react-native/src/**` under a
    // separate outDir.
    expect(getTscEmits('react-native', { extraEntryFiles: ['register.ts'] })).toEqual([
      {
        target: 'react-native',
        format: 'esm',
        outDir: 'dist/react-native',
        declaration: true,
        extraEntryFiles: ['register.ts'],
      },
      {
        target: 'react-native',
        format: 'cjs',
        outDir: 'dist/react-native/cjs',
        declaration: false,
        extraEntryFiles: ['register.ts'],
      },
    ]);
  });

  it('ignores extraEntryFiles for targets other than react-native', () => {
    expect(getTscEmits('metro', { extraEntryFiles: ['register.ts'] })).toEqual([
      { target: 'metro', format: 'cjs', outDir: 'dist/metro', declaration: true },
    ]);
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

    const configPath = await prepareEmit(projectRoot, esm);
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

  it('resolves CommonJS output with node10, which tolerates extensionless imports', async () => {
    const projectRoot = await createTempDir();
    const [metro] = getTscEmits('metro');

    const config = await readJson(await prepareEmit(projectRoot, metro));

    expect(config.files).toEqual(['../metro.ts']);
    expect(config.compilerOptions).toMatchObject({
      module: 'CommonJS',
      moduleResolution: 'node10',
      outDir: '../dist/metro',
    });
  });

  it('compiles register.ts into the same react-native emit as react-native.ts', async () => {
    const projectRoot = await createTempDir();
    const [esm, cjs] = getTscEmits('react-native', { extraEntryFiles: ['register.ts'] });

    const esmConfig = await readJson(await prepareEmit(projectRoot, esm));
    const cjsConfig = await readJson(await prepareEmit(projectRoot, cjs));

    expect(esmConfig.files).toEqual(['../react-native.ts', '../register.ts']);
    expect(esmConfig.compilerOptions.outDir).toBe('../dist/react-native');
    expect(cjsConfig.files).toEqual(['../react-native.ts', '../register.ts']);
    expect(cjsConfig.compilerOptions.outDir).toBe('../dist/react-native/cjs');
  });
});
