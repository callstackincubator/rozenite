import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CustomResolutionContext, CustomResolver, Resolution } from 'metro-resolver';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyProductionGuard, createRozeniteResolveRequest } from '../resolver.js';

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rozenite-metro-resolver-'));
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

/** Creates an on-disk Rozenite plugin package (package.json + dist/rozenite.json). */
const createPlugin = (
  pluginRoot: string,
  pluginName: string,
  productionEntries: string[] = [],
): void => {
  writeJson(path.join(pluginRoot, 'package.json'), { name: pluginName, version: '1.0.0' });
  writeJson(path.join(pluginRoot, 'dist', 'rozenite.json'), { productionEntries });
};

afterEach(() => {
  vi.restoreAllMocks();

  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

const sourceFile = (filePath: string): Resolution => ({ type: 'sourceFile', filePath });

const createContext = (options: {
  dev: boolean;
  originModulePath: string;
  resolveRequest?: CustomResolver;
}): CustomResolutionContext =>
  ({
    dev: options.dev,
    originModulePath: options.originModulePath,
    resolveRequest:
      options.resolveRequest ??
      (() => {
        throw new Error('resolveRequest should not be called in this test');
      }),
  }) as unknown as CustomResolutionContext;

describe('applyProductionGuard decision table', () => {
  it('allows when the importing file is itself inside the plugin', () => {
    const pluginRoot = createTempDir();
    createPlugin(pluginRoot, '@acme/some-plugin');

    const originModulePath = path.join(pluginRoot, 'src', 'internal.ts');
    const resolvedFilePath = path.join(pluginRoot, 'src', 'other.ts');
    const context = createContext({ dev: false, originModulePath });

    const result = applyProductionGuard(context, sourceFile(resolvedFilePath), null, {
      projectRoot: '/project',
      allowInProduction: [],
    });

    expect(result).toEqual(sourceFile(resolvedFilePath));
  });

  // A declared entry is an export subpath, so it must be resolved as the bare
  // specifier a consumer writes. Resolving './register' as a literal relative
  // path would land on the plugin's source `register.ts` at the package root,
  // while the consumer's import goes through `exports` to
  // `dist/react-native/register.js` - and a correctly declared entry would
  // then fail the guard. This test fails if that regresses: the fake resolver
  // only answers the bare specifier, and only ever returns the dist file.
  it('allows a declared productionEntry, resolved as an export subpath', () => {
    const pluginRoot = createTempDir();
    createPlugin(pluginRoot, '@acme/some-plugin', ['./register']);

    const builtRegisterPath = path.join(pluginRoot, 'dist', 'react-native', 'register.js');
    const requestedSpecifiers: string[] = [];
    const resolveRequest: CustomResolver = (_context, moduleName) => {
      requestedSpecifiers.push(moduleName);

      if (moduleName === '@acme/some-plugin/register') {
        return sourceFile(builtRegisterPath);
      }

      throw new Error(`unexpected moduleName: ${moduleName}`);
    };
    const context = createContext({
      dev: false,
      originModulePath: '/project/src/App.tsx',
      resolveRequest,
    });

    const result = applyProductionGuard(context, sourceFile(builtRegisterPath), null, {
      projectRoot: '/project',
      allowInProduction: [],
    });

    expect(result).toEqual(sourceFile(builtRegisterPath));
    expect(requestedSpecifiers).toEqual(['@acme/some-plugin/register']);
  });

  it('throws in production for an undeclared import into the plugin', () => {
    const pluginRoot = createTempDir();
    createPlugin(pluginRoot, '@acme/some-plugin');

    const resolvedFilePath = path.join(pluginRoot, 'src', 'index.ts');
    const context = createContext({
      dev: false,
      originModulePath: '/project/src/screens/Settings.tsx',
    });

    expect(() =>
      applyProductionGuard(context, sourceFile(resolvedFilePath), null, {
        projectRoot: '/project',
        allowInProduction: [],
      }),
    ).toThrowError(
      /@acme\/some-plugin is a Rozenite plugin and declares no production entry points\./,
    );
  });

  it('warns instead of throwing for the same undeclared import in development', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pluginRoot = createTempDir();
    createPlugin(pluginRoot, '@acme/some-plugin');

    const resolvedFilePath = path.join(pluginRoot, 'src', 'index.ts');
    const context = createContext({
      dev: true,
      originModulePath: '/project/src/screens/Settings.tsx',
    });

    const result = applyProductionGuard(context, sourceFile(resolvedFilePath), null, {
      projectRoot: '/project',
      allowInProduction: [],
    });

    expect(result).toEqual(sourceFile(resolvedFilePath));
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('@acme/some-plugin imported from');
  });

  it('allows an undeclared import in production when the plugin is in allowInProduction', () => {
    const pluginRoot = createTempDir();
    createPlugin(pluginRoot, '@acme/some-plugin');

    const resolvedFilePath = path.join(pluginRoot, 'src', 'index.ts');
    const context = createContext({
      dev: false,
      originModulePath: '/project/src/screens/Settings.tsx',
    });

    const result = applyProductionGuard(context, sourceFile(resolvedFilePath), null, {
      projectRoot: '/project',
      allowInProduction: ['@acme/some-plugin'],
    });

    expect(result).toEqual(sourceFile(resolvedFilePath));
  });

  // `rozenite dev` rebuilds a plugin's `dist/rozenite.json` while Metro keeps
  // running. `resolveDeclaredEntries`'s own cache must not keep answering
  // with a `productionEntries` declaration the plugin no longer has once
  // `findRozenitePluginForFile` (in `@rozenite/middleware`) picks up the
  // rebuilt manifest.
  it('re-resolves declared entries once the plugin manifest changes', () => {
    const pluginRoot = createTempDir();
    createPlugin(pluginRoot, '@acme/some-plugin', ['./register']);

    const builtRegisterPath = path.join(pluginRoot, 'dist', 'react-native', 'register.js');
    const resolveRequest: CustomResolver = (_context, moduleName) => {
      if (moduleName === '@acme/some-plugin/register') {
        return sourceFile(builtRegisterPath);
      }
      throw new Error(`unexpected moduleName: ${moduleName}`);
    };
    const context = createContext({
      dev: false,
      originModulePath: '/project/src/App.tsx',
      resolveRequest,
    });

    const firstResult = applyProductionGuard(context, sourceFile(builtRegisterPath), null, {
      projectRoot: '/project',
      allowInProduction: [],
    });
    expect(firstResult).toEqual(sourceFile(builtRegisterPath));

    // Rebuild the manifest with the declaration removed, bumping mtime past
    // the original write so a fast filesystem can't land on the same tick.
    createPlugin(pluginRoot, '@acme/some-plugin', []);
    const manifestPath = path.join(pluginRoot, 'dist', 'rozenite.json');
    const bumpedMtime = new Date(fs.statSync(manifestPath).mtimeMs + 1000);
    fs.utimesSync(manifestPath, bumpedMtime, bumpedMtime);

    expect(() =>
      applyProductionGuard(context, sourceFile(builtRegisterPath), null, {
        projectRoot: '/project',
        allowInProduction: [],
      }),
    ).toThrowError(
      /@acme\/some-plugin is a Rozenite plugin and declares no production entry points\./,
    );
  });
});

describe('createRozeniteResolveRequest', () => {
  it('still returns {type: "empty"} for the web WebSocketInterceptor special case (regression guard)', () => {
    const resolveRequest = createRozeniteResolveRequest({
      projectRoot: '/project',
      allowInProduction: [],
      installDevEntryRedirect: true,
    });
    const context = createContext({ dev: true, originModulePath: '/project/src/App.tsx' });

    const result = resolveRequest(
      context,
      'react-native/Libraries/WebSocket/WebSocketInterceptor',
      'web',
    );

    expect(result).toEqual({ type: 'empty' });
  });

  it('falls through to normal resolution when the rozenite.dev redirect target fails to resolve', () => {
    const seamRoot = createTempDir();
    writeJson(path.join(seamRoot, 'package.json'), { name: '@rozenite/react-native' });
    const noopFilePath = path.join(seamRoot, 'dist', 'cjs', 'dev-entry.js');
    writeFile(noopFilePath);
    const originModulePath = path.join(seamRoot, 'dist', 'cjs', 'index.js');
    writeFile(originModulePath);

    const projectRoot = createTempDir();
    const resolveRequest: CustomResolver = (_context, moduleName) => {
      if (moduleName === './dev-entry.js') {
        return sourceFile(noopFilePath);
      }
      // Simulates the missing rozenite.dev file: no rozenite.dev(.*) exists
      // in projectRoot, so the redirect target fails to resolve.
      throw new Error('Unable to resolve module rozenite.dev');
    };
    const context = createContext({ dev: true, originModulePath, resolveRequest });

    const guardResolveRequest = createRozeniteResolveRequest({
      projectRoot,
      allowInProduction: [],
      installDevEntryRedirect: true,
    });

    const result = guardResolveRequest(context, './dev-entry.js', null);

    expect(result).toEqual(sourceFile(noopFilePath));
  });
});
