import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  findRozenitePluginForFile,
  isDevEntryOrigin,
  isSeamDevEntryRequest,
  formatProductionGuardError,
  formatDevAdvisory,
  warnOnceForImport,
  getDevEntrySpecifier,
} from '../production-guard.js';

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rozenite-production-guard-'));
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
  options?: { hasManifest?: boolean; manifestContents?: unknown | string },
): void => {
  writeJson(path.join(packageRoot, 'package.json'), { name: packageName, version: '1.0.0' });

  if (options?.hasManifest) {
    const manifestPath = path.join(packageRoot, 'dist', 'rozenite.json');

    if (typeof options.manifestContents === 'string') {
      writeFile(manifestPath, options.manifestContents);
    } else {
      writeJson(manifestPath, options.manifestContents ?? {});
    }
  }
};

afterEach(() => {
  vi.restoreAllMocks();

  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('findRozenitePluginForFile', () => {
  it('detects a package with dist/rozenite.json', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@acme/some-plugin', { hasManifest: true });

    const filePath = path.join(packageRoot, 'src', 'index.ts');
    const plugin = findRozenitePluginForFile(filePath);

    expect(plugin).not.toBeNull();
    expect(plugin?.name).toBe('@acme/some-plugin');
    expect(plugin?.root).toBe(fs.realpathSync(packageRoot));
  });

  it('ignores a package without dist/rozenite.json', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@acme/not-a-plugin');

    const filePath = path.join(packageRoot, 'src', 'index.ts');

    expect(findRozenitePluginForFile(filePath)).toBeNull();
  });

  it('reads productionEntries out of the manifest', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@acme/with-entries', {
      hasManifest: true,
      manifestContents: { productionEntries: ['./register', './other'] },
    });

    const filePath = path.join(packageRoot, 'src', 'nested', 'file.ts');
    const plugin = findRozenitePluginForFile(filePath);

    expect(plugin?.productionEntries).toEqual(['./register', './other']);
  });

  it('degrades a malformed manifest to no declared entries, without crashing', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@acme/malformed', {
      hasManifest: true,
      manifestContents: '{ this is not json',
    });

    const filePath = path.join(packageRoot, 'src', 'index.ts');

    expect(() => findRozenitePluginForFile(filePath)).not.toThrow();

    // A malformed manifest still exists on disk, so the package is still a
    // plugin -- just one that has declared nothing.
    const plugin = findRozenitePluginForFile(filePath);
    expect(plugin).not.toBeNull();
    expect(plugin?.productionEntries).toEqual([]);
  });

  it('memoizes per directory, including negative results', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@acme/memoized', { hasManifest: true });

    const filePath = path.join(packageRoot, 'src', 'index.ts');
    const first = findRozenitePluginForFile(filePath);
    expect(first).not.toBeNull();

    // Remove the manifest after the first (cached) lookup -- a second
    // lookup for a file in the same directory must still hit the cache and
    // return the original (memoized) result rather than re-reading disk.
    fs.rmSync(path.join(packageRoot, 'dist', 'rozenite.json'));
    const second = findRozenitePluginForFile(filePath);

    expect(second).toEqual(first);
  });
});

describe('isDevEntryOrigin', () => {
  it('is true for rozenite.dev.tsx', () => {
    expect(isDevEntryOrigin('/project/rozenite.dev.tsx')).toBe(true);
  });

  it('is true for a platform-suffixed rozenite.dev.ios.tsx', () => {
    expect(isDevEntryOrigin('/project/rozenite.dev.ios.tsx')).toBe(true);
  });

  it('is true for a file inside a rozenite.dev/ directory', () => {
    expect(isDevEntryOrigin('/project/rozenite.dev/index.tsx')).toBe(true);
  });

  it('is false for an ordinary project file', () => {
    expect(isDevEntryOrigin('/project/src/screens/Settings.tsx')).toBe(false);
  });
});

describe('isSeamDevEntryRequest', () => {
  it('matches the dev-entry specifier requested from inside the seam package', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@rozenite/react-native');

    const originModulePath = path.join(packageRoot, 'dist', 'cjs', 'index.js');

    expect(isSeamDevEntryRequest(originModulePath, './dev-entry.js')).toBe(true);
    expect(isSeamDevEntryRequest(originModulePath, './dev-entry')).toBe(true);
  });

  it('does not match an unrelated request from inside the seam package', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@rozenite/react-native');

    const originModulePath = path.join(packageRoot, 'dist', 'cjs', 'index.js');

    expect(isSeamDevEntryRequest(originModulePath, './something-else.js')).toBe(false);
  });

  it('does not match when the seam package is not installed (origin outside it)', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@acme/some-other-package');

    const originModulePath = path.join(packageRoot, 'src', 'index.ts');

    expect(isSeamDevEntryRequest(originModulePath, './dev-entry.js')).toBe(false);
  });
});

describe('formatProductionGuardError', () => {
  it('matches the documented shape when the plugin declares no production entries', () => {
    const message = formatProductionGuardError({
      plugin: {
        name: '@acme/some-plugin',
        root: '/node_modules/@acme/some-plugin',
        productionEntries: [],
      },
      importedFrom: '/project/src/screens/Settings.tsx',
      projectRoot: '/project',
    });

    const lines = message.split('\n');
    expect(lines[0]).toBe(
      '@acme/some-plugin is a Rozenite plugin and declares no production entry points.',
    );
    expect(lines[1]).toBe('Imported from: src/screens/Settings.tsx');
    expect(lines[2]).toMatch(/rozenite\.dev\.tsx/);
    expect(lines[2]).toMatch(/allowInProduction/);
  });

  it('formats an absolute path when the importer is outside projectRoot', () => {
    const message = formatProductionGuardError({
      plugin: {
        name: '@acme/some-plugin',
        root: '/node_modules/@acme/some-plugin',
        productionEntries: [],
      },
      importedFrom: '/elsewhere/Settings.tsx',
      projectRoot: '/project',
    });

    expect(message.split('\n')[1]).toBe('Imported from: /elsewhere/Settings.tsx');
  });
});

describe('formatDevAdvisory', () => {
  it('matches the documented shape', () => {
    const message = formatDevAdvisory({
      plugin: {
        name: '@rozenite/mmkv-plugin',
        root: '/node_modules/@rozenite/mmkv-plugin',
        productionEntries: [],
      },
      importedFrom: '/project/src/screens/Settings.tsx',
      projectRoot: '/project',
    });

    expect(message).toBe(
      'warning: @rozenite/mmkv-plugin imported from src/screens/Settings.tsx.\n' +
        '         Plugin imports belong in rozenite.dev.tsx. This will fail your production build.',
    );
  });
});

describe('warnOnceForImport', () => {
  it('warns only once per key', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    warnOnceForImport('a\0b', 'first message');
    warnOnceForImport('a\0b', 'first message');
    warnOnceForImport('c\0d', 'second message');

    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});

describe('getDevEntrySpecifier', () => {
  it('joins the project root with the extensionless rozenite.dev specifier', () => {
    expect(getDevEntrySpecifier('/project')).toBe(path.join('/project', 'rozenite.dev'));
  });
});
