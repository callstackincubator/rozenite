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
  formatIntegrationMismatchError,
  formatIntegrationMismatchAdvisory,
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
  // Regression: tsc cannot emit .cjs/.mjs, so the plugin build drops a bare
  // `{"type": "module"}` marker into every output directory. That marker is
  // the first package.json above a resolved plugin entry, and treating it as
  // the package root stops the walk two directories short of
  // dist/rozenite.json -- which made the guard read every plugin as "not a
  // plugin" and permit everything, in a real production bundle, silently.
  it('walks past the nameless module-type markers the build emits', () => {
    const packageRoot = createTempDir();
    writeJson(path.join(packageRoot, 'package.json'), { name: '@acme/some-plugin' });
    writeJson(path.join(packageRoot, 'dist', 'rozenite.json'), {});
    writeJson(path.join(packageRoot, 'dist', 'react-native', 'package.json'), {
      type: 'module',
    });
    writeJson(path.join(packageRoot, 'dist', 'react-native', 'cjs', 'package.json'), {
      type: 'commonjs',
    });

    const esmEntry = path.join(packageRoot, 'dist', 'react-native', 'react-native.js');
    const cjsEntry = path.join(packageRoot, 'dist', 'react-native', 'cjs', 'react-native.js');

    expect(findRozenitePluginForFile(esmEntry)?.name).toBe('@acme/some-plugin');
    expect(findRozenitePluginForFile(cjsEntry)?.name).toBe('@acme/some-plugin');
  });

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

  it('reads integrations out of the manifest', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@acme/lynx-only', {
      hasManifest: true,
      manifestContents: { integrations: ['lynx', 'lynx-web'] },
    });

    const filePath = path.join(packageRoot, 'src', 'index.ts');
    const plugin = findRozenitePluginForFile(filePath);

    expect(plugin?.integrations).toEqual(['lynx', 'lynx-web']);
  });

  it('defaults integrations to react-native when the manifest declares none', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@acme/unlabeled', { hasManifest: true });

    const filePath = path.join(packageRoot, 'src', 'index.ts');
    const plugin = findRozenitePluginForFile(filePath);

    expect(plugin?.integrations).toEqual(['react-native']);
  });

  it('drops unrecognised integration ids and falls back to react-native if none survive', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@acme/bogus-integrations', {
      hasManifest: true,
      manifestContents: { integrations: ['not-a-real-integration', 42] },
    });

    const filePath = path.join(packageRoot, 'src', 'index.ts');
    const plugin = findRozenitePluginForFile(filePath);

    expect(plugin?.integrations).toEqual(['react-native']);
  });

  it('memoizes per directory while the manifest is unchanged', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@acme/memoized', { hasManifest: true });

    const filePath = path.join(packageRoot, 'src', 'index.ts');
    const first = findRozenitePluginForFile(filePath);
    expect(first).not.toBeNull();

    // Same manifest, same mtime -- must hit the cache rather than re-reading
    // disk on every resolution (`resolveRequest` is synchronous and called
    // on every module resolution).
    const readFileSpy = vi.spyOn(fs, 'readFileSync');
    const second = findRozenitePluginForFile(filePath);

    expect(second).toEqual(first);
    expect(readFileSpy).not.toHaveBeenCalled();
  });

  // `rozenite dev` rebuilds a plugin's `dist/rozenite.json` while the
  // bundler keeps running (its Vite watcher reacts to source changes). A
  // cache that never invalidated would keep answering with whatever the
  // plugin looked like the first time it was resolved for the rest of the
  // session.
  it('invalidates the cache when the manifest is rebuilt with different content', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@acme/rebuilt', {
      hasManifest: true,
      manifestContents: { productionEntries: ['./register'] },
    });

    const filePath = path.join(packageRoot, 'src', 'index.ts');
    const first = findRozenitePluginForFile(filePath);
    expect(first?.productionEntries).toEqual(['./register']);

    // Rewriting in place can land on the same mtime tick as the original
    // write on a fast filesystem; bump it explicitly to simulate a rebuild a
    // moment later, exactly like a real filesystem would report one.
    const manifestPath = path.join(packageRoot, 'dist', 'rozenite.json');
    writeJson(manifestPath, { productionEntries: [] });
    const bumpedMtime = new Date(fs.statSync(manifestPath).mtimeMs + 1000);
    fs.utimesSync(manifestPath, bumpedMtime, bumpedMtime);

    const second = findRozenitePluginForFile(filePath);
    expect(second?.productionEntries).toEqual([]);
  });

  it('invalidates the cache when the manifest is removed', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@acme/removed', { hasManifest: true });

    const filePath = path.join(packageRoot, 'src', 'index.ts');
    const first = findRozenitePluginForFile(filePath);
    expect(first).not.toBeNull();

    fs.rmSync(path.join(packageRoot, 'dist', 'rozenite.json'));
    const second = findRozenitePluginForFile(filePath);

    expect(second).toBeNull();
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

  it('matches the dev-entry specifier requested from inside the Lynx seam package', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@rozenite/lynx');

    const originModulePath = path.join(packageRoot, 'dist', 'index.js');

    expect(isSeamDevEntryRequest(originModulePath, './dev-entry.js')).toBe(true);
    expect(isSeamDevEntryRequest(originModulePath, './dev-entry')).toBe(true);
  });

  // Regression: `@rozenite/lynx`'s Rollup-bundled seam rewrites its CJS
  // chunk's `require()` to the sibling chunk's actual extension
  // (`./dev-entry.cjs`), unlike `@rozenite/react-native`'s unbundled tsc
  // build, which keeps the literal `./dev-entry.js` from source in both its
  // ESM and CJS output. Missing this form silently drops the dev-entry
  // redirect for every CJS consumer of the Lynx seam.
  it('matches the .cjs dev-entry specifier a bundled CJS seam build emits', () => {
    const packageRoot = createTempDir();
    createPackage(packageRoot, '@rozenite/lynx');

    const originModulePath = path.join(packageRoot, 'dist', 'index.cjs');

    expect(isSeamDevEntryRequest(originModulePath, './dev-entry.cjs')).toBe(true);
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
        integrations: ['react-native'],
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
        integrations: ['react-native'],
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
        integrations: ['react-native'],
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

describe('formatIntegrationMismatchError', () => {
  it('matches the documented shape', () => {
    const message = formatIntegrationMismatchError({
      plugin: {
        name: '@acme/rn-only-plugin',
        root: '/node_modules/@acme/rn-only-plugin',
        productionEntries: [],
        integrations: ['react-native'],
      },
      importedFrom: '/project/rozenite.dev.tsx',
      projectRoot: '/project',
      targetIntegration: 'lynx',
    });

    const lines = message.split('\n');
    expect(lines[0]).toBe(
      '@acme/rn-only-plugin is a Rozenite plugin that does not declare "lynx" support.',
    );
    expect(lines[1]).toBe('Declared integrations: react-native.');
    expect(lines[2]).toBe('Imported from: rozenite.dev.tsx');
  });
});

describe('formatIntegrationMismatchAdvisory', () => {
  it('matches the documented shape', () => {
    const message = formatIntegrationMismatchAdvisory({
      plugin: {
        name: '@acme/rn-only-plugin',
        root: '/node_modules/@acme/rn-only-plugin',
        productionEntries: [],
        integrations: ['react-native'],
      },
      importedFrom: '/project/src/screens/Settings.tsx',
      projectRoot: '/project',
      targetIntegration: 'lynx',
    });

    expect(message).toBe(
      'warning: @acme/rn-only-plugin imported from src/screens/Settings.tsx, but it does not declare "lynx" support.\n' +
        '         Declared integrations: react-native. This will fail your production build.',
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
