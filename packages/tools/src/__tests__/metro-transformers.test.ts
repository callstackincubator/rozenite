import { describe, it, expect, vi } from 'vitest';
import type { ConfigT as MetroConfig } from 'metro-config';
import {
  createMetroConfigTransformer,
  composeMetroConfigTransformers,
} from '../metro-transformers.js';

// Mock Metro config for testing
const mockMetroConfig = {
  projectRoot: '/test',
  watchFolders: [],
  cacheStores: [],
  cacheVersion: '1.0.0',
  maxWorkers: 1,
  stickyWorkers: false,
  transformerPath: '',
  reporter: {
    update: vi.fn(),
  } as any,
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
    getTransformOptions: vi.fn(),
    transformVariants: {},
    workerPath: '',
    publicPath: '',
  } as any,
  serializer: {
    createModuleIdFactory: vi.fn(() => vi.fn(() => 0)),
    customSerializer: null,
    experimentalSerializerHook: vi.fn(),
    getModulesRunBeforeMainModule: vi.fn(() => []),
    getPolyfills: vi.fn(() => []),
    getRunModuleStatement: vi.fn(() => ''),
    polyfillModuleNames: [],
    processModuleFilter: vi.fn(() => true),
    isThirdPartyModule: vi.fn(() => false),
  },
  server: {
    enhanceMiddleware: vi.fn((middleware) => middleware),
    forwardClientLogs: false,
    port: 8081,
    rewriteRequestUrl: vi.fn((url) => url),
    unstable_serverRoot: null,
    useGlobalHotkey: false,
    verifyConnections: false,
  },
  symbolicator: {
    customizeFrame: vi.fn(() => undefined),
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
} as MetroConfig;

// Helper to create a test config
const createTestConfig = (): MetroConfig => ({
  ...mockMetroConfig,
});

describe('createMetroConfigTransformer', () => {
  describe('input type handling', () => {
    it('1.1 should transform MetroConfigObject directly', () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        testProperty: 'added',
      }));

      const input = createTestConfig();
      const result = transformer(input);

      expect(result).toHaveProperty('testProperty', 'added');
      expect(result).toHaveProperty('projectRoot', '/test');
    });

    it('1.2 should await and transform Promise<MetroConfigObject>', async () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        asyncProperty: 'added',
      }));

      const input = Promise.resolve(createTestConfig());
      const result = await transformer(input);

      expect(result).toHaveProperty('asyncProperty', 'added');
    });

    it('1.3 should wrap sync MetroConfigFunction', () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        functionProperty: 'added',
      }));

      const input = (baseConfig: MetroConfig) => ({
        ...baseConfig,
        originalFunction: true,
      });

      const result = transformer(input);
      const finalConfig = result(createTestConfig());

      expect(finalConfig).toHaveProperty('originalFunction', true);
      expect(finalConfig).toHaveProperty('functionProperty', 'added');
    });

    it('1.4 should wrap async MetroConfigAsyncFunction', async () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        asyncFunctionProperty: 'added',
      }));

      const input = async (baseConfig: MetroConfig) => ({
        ...baseConfig,
        originalAsyncFunction: true,
      });

      const result = transformer(input);
      const finalConfig = await result(createTestConfig());

      expect(finalConfig).toHaveProperty('originalAsyncFunction', true);
      expect(finalConfig).toHaveProperty('asyncFunctionProperty', 'added');
    });

    it('1.5 should handle Promise<MetroConfigFunction>', async () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        promiseFunctionProperty: 'added',
      }));

      const input = Promise.resolve((baseConfig: MetroConfig) => ({
        ...baseConfig,
        originalPromiseFunction: true,
      }));

      const result = await transformer(input);
      const finalConfig = result(createTestConfig());

      expect(finalConfig).toHaveProperty('originalPromiseFunction', true);
      expect(finalConfig).toHaveProperty('promiseFunctionProperty', 'added');
    });

    it('1.6 should handle Promise<MetroConfigAsyncFunction>', async () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        promiseAsyncFunctionProperty: 'added',
      }));

      const input = Promise.resolve(async (baseConfig: MetroConfig) => ({
        ...baseConfig,
        originalPromiseAsyncFunction: true,
      }));

      const result = await transformer(input);
      const finalConfig = await result(createTestConfig());

      expect(finalConfig).toHaveProperty('originalPromiseAsyncFunction', true);
      expect(finalConfig).toHaveProperty(
        'promiseAsyncFunctionProperty',
        'added',
      );
    });
  });

  describe('mutation function variants', () => {
    it('2.1 should work with sync mutation', () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        syncMutation: true,
      }));

      const result = transformer(createTestConfig());
      expect(result).toHaveProperty('syncMutation', true);
    });

    it('2.2 should work with async mutation', async () => {
      const transformer = createMetroConfigTransformer(async (config) => ({
        ...config,
        asyncMutation: true,
      }));

      const result = await transformer(createTestConfig());
      expect(result).toHaveProperty('asyncMutation', true);
    });

    it('2.3 should pass options to mutation function', () => {
      const transformer = createMetroConfigTransformer<{ test: string }>(
        (config, options) => ({
          ...config,
          receivedOptions: options,
        }),
      );

      const result = transformer(createTestConfig(), { test: 'value' });
      expect(result).toHaveProperty('receivedOptions', { test: 'value' });
    });

    it('2.4 should work when options is undefined', () => {
      const transformer = createMetroConfigTransformer((config, options) => ({
        ...config,
        optionsWasUndefined: options === undefined,
      }));

      const result = transformer(createTestConfig());
      expect(result).toHaveProperty('optionsWasUndefined', true);
    });
  });

  describe('shape preservation', () => {
    it('3.1 object input returns object or awaitable promise', async () => {
      const syncTransformer = createMetroConfigTransformer((config) => ({
        ...config,
        sync: true,
      }));

      const asyncTransformer = createMetroConfigTransformer(async (config) => ({
        ...config,
        async: true,
      }));

      const syncResult = syncTransformer(createTestConfig());
      const asyncResult = await asyncTransformer(createTestConfig());

      expect(syncResult).toHaveProperty('sync', true);
      expect(asyncResult).toHaveProperty('async', true);
    });

    it('3.2 function input returns callable function', () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        transformed: true,
      }));

      const input = (baseConfig: MetroConfig) => baseConfig;
      const result = transformer(input);

      expect(typeof result).toBe('function');
      const finalConfig = result(createTestConfig());
      expect(finalConfig).toHaveProperty('transformed', true);
    });

    it('3.3 function input receives baseConfig parameter correctly', () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        receivedBaseConfig: true,
      }));

      const input = (baseConfig: MetroConfig) => baseConfig;
      const result = transformer(input);

      const customBaseConfig = { ...createTestConfig(), customProp: 'test' };
      const finalConfig = result(customBaseConfig);

      expect(finalConfig).toHaveProperty('customProp', 'test');
      expect(finalConfig).toHaveProperty('receivedBaseConfig', true);
    });

    it('3.4 promise input returns awaitable result', async () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        fromPromise: true,
      }));

      const input = Promise.resolve(createTestConfig());
      const result = transformer(input);

      expect(result).toBeInstanceOf(Promise);
      const finalConfig = await result;
      expect(finalConfig).toHaveProperty('fromPromise', true);
    });
  });

  describe('mutation application', () => {
    it('4.1 should add new properties', () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        newProperty: 'added',
      }));

      const result = transformer(createTestConfig());
      expect(result).toHaveProperty('newProperty', 'added');
    });

    it('4.2 should modify existing properties', () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        projectRoot: '/modified',
      }));

      const result = transformer(createTestConfig());
      expect(result).toHaveProperty('projectRoot', '/modified');
    });

    it('4.3 should handle nested property mutation', () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        serializer: {
          ...config.serializer,
          customSerializer: vi.fn(),
        },
      }));

      const result = transformer(createTestConfig());
      const config = result as MetroConfig;
      expect(config.serializer).toHaveProperty('customSerializer');
      expect(typeof config.serializer.customSerializer).toBe('function');
    });

    it('4.4 should not modify original config', () => {
      const originalConfig = createTestConfig();
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        newProperty: 'added',
      }));

      transformer(originalConfig);

      expect(originalConfig).not.toHaveProperty('newProperty');
    });
  });
});

describe('composeMetroConfigTransformers', () => {
  describe('basic composition', () => {
    it('5.1 should return identity for empty entries', () => {
      const composed = composeMetroConfigTransformers();
      const input = createTestConfig();
      const result = composed(input);

      expect(result).toEqual(input);
    });

    it('5.2 should apply single transformer', () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        single: true,
      }));

      const composed = composeMetroConfigTransformers(transformer);
      const result = composed(createTestConfig());

      expect(result).toHaveProperty('single', true);
    });

    it('5.3 should chain multiple transformers', () => {
      const transformer1 = createMetroConfigTransformer((config) => ({
        ...config,
        step1: true,
      }));

      const transformer2 = createMetroConfigTransformer((config) => ({
        ...config,
        step2: true,
      }));

      const transformer3 = createMetroConfigTransformer((config) => ({
        ...config,
        step3: true,
      }));

      const composed = composeMetroConfigTransformers(
        transformer1,
        transformer2,
        transformer3,
      );
      const result = composed(createTestConfig());

      expect(result).toHaveProperty('step1', true);
      expect(result).toHaveProperty('step2', true);
      expect(result).toHaveProperty('step3', true);
    });

    it('5.4 should apply transformers in order', () => {
      const transformer1 = createMetroConfigTransformer((config) => ({
        ...config,
        order: ['step1'],
      }));

      const transformer2 = createMetroConfigTransformer((config) => ({
        ...config,
        order: [...(config as any).order, 'step2'],
      }));

      const transformer3 = createMetroConfigTransformer((config) => ({
        ...config,
        order: [...(config as any).order, 'step3'],
      }));

      const composed = composeMetroConfigTransformers(
        transformer1,
        transformer2,
        transformer3,
      );
      const result = composed(createTestConfig());

      expect(result).toHaveProperty('order', ['step1', 'step2', 'step3']);
    });
  });

  describe('tuple syntax', () => {
    it('6.1 should work with plain function entry', () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        plain: true,
      }));

      const composed = composeMetroConfigTransformers(transformer);
      const result = composed(createTestConfig());

      expect(result).toHaveProperty('plain', true);
    });

    it('6.2 should pass options from tuple', () => {
      const transformer = createMetroConfigTransformer<{ test: string }>(
        (config, options) => ({
          ...config,
          options: options,
        }),
      );

      const composed = composeMetroConfigTransformers([
        transformer,
        { test: 'value' },
      ] as any);
      const result = composed(createTestConfig());

      expect(result).toHaveProperty('options', { test: 'value' });
    });

    it('6.3 should handle mixed entries', () => {
      const transformer1 = createMetroConfigTransformer((config) => ({
        ...config,
        plain: true,
      }));

      const transformer2 = createMetroConfigTransformer<{ mixed: string }>(
        (config, options) => ({
          ...config,
          options: options,
        }),
      );

      const transformer3 = createMetroConfigTransformer((config) => ({
        ...config,
        final: true,
      }));

      const composed = composeMetroConfigTransformers(
        transformer1,
        [transformer2, { mixed: 'test' }] as any,
        transformer3,
      );

      const result = composed(createTestConfig());

      expect(result).toHaveProperty('plain', true);
      expect(result).toHaveProperty('options', { mixed: 'test' });
      expect(result).toHaveProperty('final', true);
    });

    it('6.4 should handle different option types', () => {
      const transformer = createMetroConfigTransformer<any>(
        (config, options) => ({
          ...config,
          options,
        }),
      );

      const testCases = [
        { input: 'string', expected: 'string' },
        { input: 42, expected: 42 },
        { input: true, expected: true },
        { input: { nested: 'object' }, expected: { nested: 'object' } },
        { input: ['array'], expected: ['array'] },
      ];

      testCases.forEach(({ input, expected }) => {
        const composed = composeMetroConfigTransformers([
          transformer,
          input,
        ] as any);
        const result = composed(createTestConfig());
        expect(result).toHaveProperty('options', expected);
      });
    });
  });

  describe('input type handling with composition', () => {
    it('7.1 should work with object input', () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        objectInput: true,
      }));

      const composed = composeMetroConfigTransformers(transformer);
      const result = composed(createTestConfig());

      expect(result).toHaveProperty('objectInput', true);
    });

    it('7.2 should work with promise input', async () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        promiseInput: true,
      }));

      const composed = composeMetroConfigTransformers(transformer);
      const input = Promise.resolve(createTestConfig());
      const result = await composed(input);

      expect(result).toHaveProperty('promiseInput', true);
    });

    it('7.3 should work with function input', () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        functionInput: true,
      }));

      const composed = composeMetroConfigTransformers(transformer);
      const input = (baseConfig: MetroConfig) => baseConfig;
      const result = composed(input);

      const finalConfig = result(createTestConfig());
      expect(finalConfig).toHaveProperty('functionInput', true);
    });

    it('7.4 should work with async function input', async () => {
      const transformer = createMetroConfigTransformer((config) => ({
        ...config,
        asyncFunctionInput: true,
      }));

      const composed = composeMetroConfigTransformers(transformer);
      const input = async (baseConfig: MetroConfig) => baseConfig;
      const result = composed(input);

      const finalConfig = await result(createTestConfig());
      expect(finalConfig).toHaveProperty('asyncFunctionInput', true);
    });
  });

  describe('async handling in composition', () => {
    it('8.1 should return sync result for all sync transformers', () => {
      const transformer1 = createMetroConfigTransformer((config) => ({
        ...config,
        step1: true,
      }));

      const transformer2 = createMetroConfigTransformer((config) => ({
        ...config,
        step2: true,
      }));

      const composed = composeMetroConfigTransformers(
        transformer1,
        transformer2,
      );
      const result = composed(createTestConfig());

      expect(result).toHaveProperty('step1', true);
      expect(result).toHaveProperty('step2', true);
    });

    it('8.2 should handle single async transformer', async () => {
      const transformer = createMetroConfigTransformer(async (config) => ({
        ...config,
        asyncSingle: true,
      }));

      const composed = composeMetroConfigTransformers(transformer);
      const result = await composed(createTestConfig());

      expect(result).toHaveProperty('asyncSingle', true);
    });

    it('8.3 should chain multiple async transformers', async () => {
      const transformer1 = createMetroConfigTransformer(async (config) => ({
        ...config,
        async1: true,
      }));

      const transformer2 = createMetroConfigTransformer(async (config) => ({
        ...config,
        async2: true,
      }));

      const composed = composeMetroConfigTransformers(
        transformer1,
        transformer2,
      );
      const result = await composed(createTestConfig());

      expect(result).toHaveProperty('async1', true);
      expect(result).toHaveProperty('async2', true);
    });

    it('8.4 should handle async in middle of sync transformers', async () => {
      const sync1 = createMetroConfigTransformer((config) => ({
        ...config,
        sync1: true,
      }));

      const asyncTransformer = createMetroConfigTransformer(async (config) => ({
        ...config,
        asyncMiddle: true,
      }));

      const sync2 = createMetroConfigTransformer((config) => ({
        ...config,
        sync2: true,
      }));

      const composed = composeMetroConfigTransformers(
        sync1,
        asyncTransformer,
        sync2,
      );
      const result = await composed(createTestConfig());

      expect(result).toHaveProperty('sync1', true);
      expect(result).toHaveProperty('asyncMiddle', true);
      expect(result).toHaveProperty('sync2', true);
    });
  });

  describe('real-world scenarios', () => {
    it('9.1 should handle serializer chain', () => {
      const addPolyfills = createMetroConfigTransformer((config) => ({
        ...config,
        serializer: {
          ...config.serializer,
          getPolyfills: () => ['polyfill1', 'polyfill2'],
        },
      }));

      const addCustomSerializer = createMetroConfigTransformer((config) => ({
        ...config,
        serializer: {
          ...config.serializer,
          customSerializer: vi.fn(),
        },
      }));

      const composed = composeMetroConfigTransformers(
        addPolyfills,
        addCustomSerializer,
      );
      const result = composed(createTestConfig());
      const config = result as MetroConfig;

      expect(config.serializer).toHaveProperty('getPolyfills');
      expect(config.serializer).toHaveProperty('customSerializer');
      expect(typeof config.serializer.customSerializer).toBe('function');
    });

    it('9.2 should handle middleware composition', () => {
      const addMiddleware1 = createMetroConfigTransformer((config) => ({
        ...config,
        server: {
          ...config.server,
          middleware1: true,
        },
      }));

      const addMiddleware2 = createMetroConfigTransformer((config) => ({
        ...config,
        server: {
          ...config.server,
          middleware2: true,
        },
      }));

      const composed = composeMetroConfigTransformers(
        addMiddleware1,
        addMiddleware2,
      );
      const result = composed(createTestConfig());
      const config = result as MetroConfig;

      expect(config.server).toHaveProperty('middleware1', true);
      expect(config.server).toHaveProperty('middleware2', true);
    });

    it('9.3 should simulate full pipeline', () => {
      // Simulate withRequireProfiler
      const withRequireProfiler = createMetroConfigTransformer((config) => ({
        ...config,
        serializer: {
          ...config.serializer,
          requireProfiler: true,
        },
      }));

      // Simulate withExpoAtlas
      const withExpoAtlas = createMetroConfigTransformer((config, options) => ({
        ...config,
        server: {
          ...config.server,
          expoAtlas: options,
        },
      }));

      // Simulate withReduxDevTools
      const withReduxDevTools = createMetroConfigTransformer((config) => ({
        ...config,
        reduxDevTools: true,
      }));

      const composed = composeMetroConfigTransformers(
        withRequireProfiler,
        [withExpoAtlas, { port: 8081 }] as any,
        withReduxDevTools,
      );

      const result = composed(createTestConfig());
      const config = result as MetroConfig;

      expect(config.serializer).toHaveProperty('requireProfiler', true);
      expect(config.server).toHaveProperty('expoAtlas', { port: 8081 });
      expect(config).toHaveProperty('reduxDevTools', true);
    });
  });
});
