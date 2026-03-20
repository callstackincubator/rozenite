import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findPackageRoot, getInstalledPlugins } from '../auto-discovery.js';
import type { RozeniteConfig } from '../config.js';

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rozenite-middleware-'));
  tempDirs.push(tempDir);
  return tempDir;
};

const writeJson = (filePath: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
};

const writeFile = (filePath: string, contents = ''): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
};

const createPackage = (
  packageRoot: string,
  packageName: string,
  options?: {
    hasPluginManifest?: boolean;
    main?: string;
  }
): void => {
  const main = options?.main ?? './dist/index.js';

  writeJson(path.join(packageRoot, 'package.json'), {
    name: packageName,
    version: '1.0.0',
    main,
  });
  writeFile(path.join(packageRoot, main.replace('./', '')), 'module.exports = {};');

  if (options?.hasPluginManifest) {
    writeJson(path.join(packageRoot, 'dist', 'rozenite.json'), {
      name: packageName,
    });
  }
};

const createProject = (
  packageJson: Record<string, unknown>
): string => {
  const projectRoot = createTempDir();
  writeJson(path.join(projectRoot, 'package.json'), packageJson);
  return projectRoot;
};

const createNodeModulesPackage = (
  projectRoot: string,
  packageName: string,
  options?: {
    hasPluginManifest?: boolean;
    main?: string;
  }
): string => {
  const packageRoot = path.join(projectRoot, 'node_modules', packageName);
  createPackage(packageRoot, packageName, options);
  return packageRoot;
};

const createConfig = (
  projectRoot: string,
  overrides?: Partial<RozeniteConfig>
): RozeniteConfig => ({
  projectRoot,
  ...overrides,
});

afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('findPackageRoot', () => {
  it('finds a package root for a classic node_modules path', () => {
    const root = createTempDir();
    const packageRoot = path.join(root, 'node_modules', '@rozenite', 'demo-plugin');

    createPackage(packageRoot, '@rozenite/demo-plugin', {
      hasPluginManifest: true,
      main: './dist/react-native.cjs',
    });

    const resolvedPath = path.join(packageRoot, 'dist', 'react-native.cjs');

    expect(findPackageRoot('@rozenite/demo-plugin', resolvedPath)).toBe(
      packageRoot
    );
  });

  it('finds a package root for a Yarn virtual or unplugged path', () => {
    const root = createTempDir();
    const packageRoot = path.join(
      root,
      '.yarn',
      '__virtual__',
      'demo-plugin-virtual-123',
      '0',
      'cache',
      'demo-plugin-npm-1.0.0.zip',
      'node_modules',
      'demo-plugin'
    );

    createPackage(packageRoot, 'demo-plugin', {
      hasPluginManifest: true,
    });

    const resolvedPath = path.join(packageRoot, 'dist', 'index.js');

    expect(findPackageRoot('demo-plugin', resolvedPath)).toBe(packageRoot);
  });

  it('finds a package root for a workspace path without node_modules', () => {
    const root = createTempDir();
    const packageRoot = path.join(root, 'packages', 'demo-plugin');

    createPackage(packageRoot, 'demo-plugin', {
      hasPluginManifest: true,
    });

    const resolvedPath = path.join(packageRoot, 'dist', 'index.js');

    expect(findPackageRoot('demo-plugin', resolvedPath)).toBe(packageRoot);
  });
});

describe('getInstalledPlugins', () => {
  it('includes declared dependencies that contain the manifest', () => {
    const projectRoot = createProject({
      name: 'demo-app',
      dependencies: {
        'demo-plugin': '1.0.0',
      },
    });

    const pluginRoot = createNodeModulesPackage(projectRoot, 'demo-plugin', {
      hasPluginManifest: true,
    });
    const resolvedPluginRoot = fs.realpathSync(pluginRoot);

    expect(getInstalledPlugins(createConfig(projectRoot))).toEqual([
      {
        name: 'demo-plugin',
        path: resolvedPluginRoot,
      },
    ]);
  });

  it('ignores declared dependencies without the manifest', () => {
    const projectRoot = createProject({
      name: 'demo-app',
      dependencies: {
        'demo-plugin': '1.0.0',
      },
    });

    createNodeModulesPackage(projectRoot, 'demo-plugin');

    expect(getInstalledPlugins(createConfig(projectRoot))).toEqual([]);
  });

  it('applies exclude before including a valid plugin', () => {
    const projectRoot = createProject({
      name: 'demo-app',
      dependencies: {
        'demo-plugin': '1.0.0',
      },
    });

    createNodeModulesPackage(projectRoot, 'demo-plugin', {
      hasPluginManifest: true,
    });

    expect(
      getInstalledPlugins(
        createConfig(projectRoot, { exclude: ['demo-plugin'] })
      )
    ).toEqual([]);
  });

  it('deduplicates names declared in dependencies and devDependencies', () => {
    const projectRoot = createProject({
      name: 'demo-app',
      dependencies: {
        'demo-plugin': '1.0.0',
      },
      devDependencies: {
        'demo-plugin': '1.0.0',
      },
    });

    const pluginRoot = createNodeModulesPackage(projectRoot, 'demo-plugin', {
      hasPluginManifest: true,
    });
    const resolvedPluginRoot = fs.realpathSync(pluginRoot);

    expect(getInstalledPlugins(createConfig(projectRoot))).toEqual([
      {
        name: 'demo-plugin',
        path: resolvedPluginRoot,
      },
    ]);
  });

  it('skips unresolved dependencies without failing discovery', () => {
    const projectRoot = createProject({
      name: 'demo-app',
      dependencies: {
        'demo-plugin': '1.0.0',
        'missing-plugin': '1.0.0',
      },
    });

    const pluginRoot = createNodeModulesPackage(projectRoot, 'demo-plugin', {
      hasPluginManifest: true,
    });
    const resolvedPluginRoot = fs.realpathSync(pluginRoot);

    expect(getInstalledPlugins(createConfig(projectRoot))).toEqual([
      {
        name: 'demo-plugin',
        path: resolvedPluginRoot,
      },
    ]);
  });

  it('throws in include mode when a plugin cannot be resolved', () => {
    const projectRoot = createProject({
      name: 'demo-app',
    });

    expect(() =>
      getInstalledPlugins(
        createConfig(projectRoot, { include: ['missing-plugin'] })
      )
    ).toThrowError('Could not resolve plugin missing-plugin.');
  });
});
