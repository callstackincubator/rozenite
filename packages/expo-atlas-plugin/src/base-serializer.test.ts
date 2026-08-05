import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createBaseSerializer } from './base-serializer';

const modernModulePaths = {
  baseJSBundle: 'metro/private/DeltaBundler/Serializers/baseJSBundle',
  bundleToString: 'metro/private/lib/bundleToString',
};

const legacyModulePaths = {
  baseJSBundle: 'metro/src/DeltaBundler/Serializers/baseJSBundle',
  bundleToString: 'metro/src/lib/bundleToString',
};

const createResolutionError = (code: string) =>
  Object.assign(new Error('Cannot resolve Metro module'), { code });

const createModuleLoader = (
  modules: Record<string, unknown>,
  resolve: (id: string) => string,
  load: (id: string) => unknown = (id) => modules[id],
) =>
  Object.assign(vi.fn(load), {
    resolve: vi.fn(resolve),
  }) as Parameters<typeof createBaseSerializer>[0];

const baseJSBundle = vi.fn(() => 'bundle');
const bundleToString = vi.fn((bundle: string) => `serialized:${bundle}`);

describe('createBaseSerializer', () => {
  it('prefers the modern Metro paths when they are available', () => {
    const moduleLoader = createModuleLoader(
      {
        [modernModulePaths.baseJSBundle]: baseJSBundle,
        [modernModulePaths.bundleToString]: bundleToString,
      },
      (id) => id,
    );

    const serializer = createBaseSerializer(moduleLoader);

    expect(moduleLoader).toHaveBeenCalledWith(modernModulePaths.baseJSBundle);
    expect(moduleLoader).toHaveBeenCalledWith(modernModulePaths.bundleToString);
    expect(moduleLoader).not.toHaveBeenCalledWith(
      legacyModulePaths.baseJSBundle,
    );
    expect(serializer('entry', [], {} as never, {} as never)).toBe(
      'serialized:bundle',
    );
  });

  it('uses legacy Metro paths when the modern paths cannot be resolved', () => {
    const moduleLoader = createModuleLoader(
      {
        [legacyModulePaths.baseJSBundle]: baseJSBundle,
        [legacyModulePaths.bundleToString]: bundleToString,
      },
      (id) => {
        if (id.startsWith('metro/private/')) {
          throw createResolutionError('MODULE_NOT_FOUND');
        }

        return id;
      },
    );

    createBaseSerializer(moduleLoader);

    expect(moduleLoader).toHaveBeenCalledWith(legacyModulePaths.baseJSBundle);
    expect(moduleLoader).toHaveBeenCalledWith(legacyModulePaths.bundleToString);
  });

  it('accepts direct CommonJS exports', () => {
    const serializer = createBaseSerializer(
      createModuleLoader(
        {
          [modernModulePaths.baseJSBundle]: () => 'bundle',
          [modernModulePaths.bundleToString]: (bundle: string) =>
            `serialized:${bundle}`,
        },
        (id) => id,
      ),
    );

    expect(serializer('entry', [], {} as never, {} as never)).toBe(
      'serialized:bundle',
    );
  });

  it('accepts default-wrapped CommonJS exports', () => {
    const serializer = createBaseSerializer(
      createModuleLoader(
        {
          [modernModulePaths.baseJSBundle]: { default: () => 'bundle' },
          [modernModulePaths.bundleToString]: {
            default: (bundle: string) => `serialized:${bundle}`,
          },
        },
        (id) => id,
      ),
    );

    expect(serializer('entry', [], {} as never, {} as never)).toBe(
      'serialized:bundle',
    );
  });

  it('throws an actionable error when neither Metro path family is exported', () => {
    const moduleLoader = createModuleLoader({}, () => {
      throw createResolutionError('ERR_PACKAGE_PATH_NOT_EXPORTED');
    });

    expect(() => createBaseSerializer(moduleLoader)).toThrow(
      'Cannot find required internals of Metro',
    );
  });

  it('rethrows module evaluation errors without falling back', () => {
    const evaluationError = new Error('Metro module failed to evaluate');
    const moduleLoader = createModuleLoader(
      {
        [modernModulePaths.bundleToString]: bundleToString,
      },
      (id) => id,
      (id) => {
        if (id === modernModulePaths.baseJSBundle) {
          throw evaluationError;
        }

        return bundleToString;
      },
    );

    expect(() => createBaseSerializer(moduleLoader)).toThrow(evaluationError);
    expect(moduleLoader).not.toHaveBeenCalledWith(
      legacyModulePaths.baseJSBundle,
    );
  });
});

const fixtureVersions = ['0.76', '0.82', '0.83', '0.84'] as const;
const fixturesDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '../metro-fixtures',
);

const createFixtureLoader = (version: (typeof fixtureVersions)[number]) => {
  const fixtureRequire = createRequire(
    join(fixturesDirectory, `metro-${version}/package.json`),
  );
  const metroDirectory = dirname(fixtureRequire.resolve('metro/package.json'));

  return Object.assign((id: string) => fixtureRequire(id), {
    resolve: (id: string) => {
      const resolvedPath = fixtureRequire.resolve(id);

      if (!resolvedPath.startsWith(`${metroDirectory}/`)) {
        throw createResolutionError('MODULE_NOT_FOUND');
      }

      return resolvedPath;
    },
  }) as Parameters<typeof createBaseSerializer>[0];
};

const graph = { dependencies: new Map() };
const bundleOptions = {
  asyncRequireModulePath: '',
  createModuleId: () => 0,
  dev: false,
  getRunModuleStatement: () => '',
  getSourceUrl: () => '',
  includeAsyncPaths: false,
  inlineSourceMap: false,
  modulesOnly: false,
  processModuleFilter: () => true,
  projectRoot: '/',
  runBeforeMainModule: [],
  runModule: false,
  serverRoot: '/',
  shouldAddToIgnoreList: () => false,
  sourceMapUrl: undefined,
  sourceUrl: undefined,
};

describe.each(fixtureVersions)('Metro %s compatibility', (version) => {
  it('creates and invokes a serializer from the pinned fixture', () => {
    const serializer = createBaseSerializer(createFixtureLoader(version));

    expect(
      serializer('/entry.js', [], graph as never, bundleOptions as never),
    ).toEqual({
      code: '',
      metadata: { modules: [], post: 0, pre: 0 },
    });
  });
});
