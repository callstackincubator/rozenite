import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { ConfigT as MetroConfig } from 'metro-config';
import type { RozeniteRequireProfilerOptions } from '../metro/index.js';

// `withRozeniteRequireProfiler` resolves the polyfill path relative to its
// own `__dirname`, which only lines up with the package root once compiled
// to `dist/metro/src/metro/` (see the comment in `src/metro/index.ts` and
// `metro-polyfill.test.ts`). So, like that test, this one runs against the
// built output rather than importing the TypeScript source directly.
const require = createRequire(import.meta.url);
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const SETUP_POLYFILL_PATH = path.join(PACKAGE_ROOT, 'src', 'metro', 'setup.js');

type MetroEntry = {
  withRozeniteRequireProfiler: <T>(config: T, options?: RozeniteRequireProfilerOptions) => T;
};

const { withRozeniteRequireProfiler } = require(
  path.join(PACKAGE_ROOT, 'dist', 'metro', 'metro.js'),
) as MetroEntry;

// Mock Metro config for testing, following the fixture conventions used in
// `packages/tools/src/__tests__/metro-transformers.test.ts`.
const createMockMetroConfig = (): MetroConfig =>
  ({
    projectRoot: '/test',
    watchFolders: [],
    cacheStores: [],
    cacheVersion: '1.0.0',
    maxWorkers: 1,
    stickyWorkers: false,
    transformerPath: '',
    reporter: {
      update: () => {},
    } as unknown,
    resetCache: false,
    resolver: {
      assetExts: [],
      assetResolutions: [],
      blockList: [],
      disableHierarchicalLookup: false,
      extraNodeModules: {},
      emptyModulePath: '',
      enableGlobalPackages: false,
      nodeModulesPaths: [],
      platforms: [],
      resolverMainFields: [],
      sourceExts: [],
      unstable_conditionNames: [],
      unstable_conditionsByPlatform: {},
      unstable_enablePackageExports: false,
      useWatchman: false,
      requireCycleIgnorePatterns: [],
    },
    transformer: {
      getTransformOptions: () => Promise.resolve({} as never),
      transformVariants: {},
      workerPath: '',
      publicPath: '',
    } as unknown,
    serializer: {
      createModuleIdFactory: () => () => 0,
      customSerializer: null,
      experimentalSerializerHook: () => {},
      getModulesRunBeforeMainModule: () => [],
      getPolyfills: () => ['existing-polyfill.js'],
      getRunModuleStatement: (moduleId: string | number) => `__r(${JSON.stringify(moduleId)});`,
      polyfillModuleNames: [],
      processModuleFilter: () => true,
      isThirdPartyModule: () => false,
    },
    server: {
      enhanceMiddleware: (middleware: unknown) => middleware,
      forwardClientLogs: false,
      port: 8081,
      rewriteRequestUrl: (url: string) => url,
      unstable_serverRoot: null,
      useGlobalHotkey: false,
      verifyConnections: false,
    },
    symbolicator: {
      customizeFrame: () => undefined,
    },
    watcher: {
      additionalExts: [],
      watchman: {
        deferStates: [],
      },
      healthCheck: {
        enabled: false,
        interval: 0,
        timeout: 0,
        filePrefix: '',
      },
      unstable_autoSaveCache: {
        enabled: false,
      },
    },
  }) as unknown as MetroConfig;

describe('withRozeniteRequireProfiler', () => {
  describe('enabled: true', () => {
    it('appends the setup.js polyfill and prepends the __patchSystrace call, while still delegating to the pre-existing implementations', () => {
      const config = createMockMetroConfig();
      const result = withRozeniteRequireProfiler(config, {
        enabled: true,
      }) as MetroConfig;

      const polyfills = result.serializer.getPolyfills({ platform: 'ios' });
      expect(polyfills).toEqual(['existing-polyfill.js', SETUP_POLYFILL_PATH]);

      const statement = result.serializer.getRunModuleStatement(0, '');
      expect(statement).toBe(
        'typeof __patchSystrace === "function" && __patchSystrace();\n__r(0);',
      );
    });
  });

  describe('enabled: false', () => {
    it('returns getPolyfills and getRunModuleStatement untouched (identity-equal to the originals), adding no polyfill', () => {
      const config = createMockMetroConfig();
      const originalGetPolyfills = config.serializer.getPolyfills;
      const originalGetRunModuleStatement = config.serializer.getRunModuleStatement;

      const result = withRozeniteRequireProfiler(config, {
        enabled: false,
      }) as MetroConfig;

      expect(result.serializer.getPolyfills).toBe(originalGetPolyfills);
      expect(result.serializer.getRunModuleStatement).toBe(originalGetRunModuleStatement);
      expect(result.serializer.getPolyfills({ platform: 'ios' })).toEqual(['existing-polyfill.js']);
    });
  });

  describe('default behaviour follows process.env.NODE_ENV', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('instruments when NODE_ENV is "development"', () => {
      process.env.NODE_ENV = 'development';

      const config = createMockMetroConfig();
      const result = withRozeniteRequireProfiler(config) as MetroConfig;

      expect(result.serializer.getPolyfills({ platform: 'ios' })).toEqual([
        'existing-polyfill.js',
        SETUP_POLYFILL_PATH,
      ]);
    });

    it('instruments when NODE_ENV is unset', () => {
      delete process.env.NODE_ENV;

      const config = createMockMetroConfig();
      const result = withRozeniteRequireProfiler(config) as MetroConfig;

      expect(result.serializer.getPolyfills({ platform: 'ios' })).toEqual([
        'existing-polyfill.js',
        SETUP_POLYFILL_PATH,
      ]);
    });

    it('does not instrument when NODE_ENV is "production"', () => {
      process.env.NODE_ENV = 'production';

      const config = createMockMetroConfig();
      const originalGetPolyfills = config.serializer.getPolyfills;
      const result = withRozeniteRequireProfiler(config) as MetroConfig;

      expect(result.serializer.getPolyfills).toBe(originalGetPolyfills);
      expect(result.serializer.getPolyfills({ platform: 'ios' })).toEqual(['existing-polyfill.js']);
    });
  });

  describe('immutability', () => {
    it('does not mutate the original config object', () => {
      const config = createMockMetroConfig();
      const originalSerializer = config.serializer;

      withRozeniteRequireProfiler(config, { enabled: true });

      expect(config.serializer).toBe(originalSerializer);
      expect(config.serializer.getPolyfills({ platform: 'ios' })).toEqual(['existing-polyfill.js']);
    });
  });
});
