import type { ConfigT as MetroConfig } from 'metro-config';

type ModuleLoader = {
  (id: string): unknown;
  resolve(id: string): string;
};

type SerializerModulePaths = {
  baseJSBundle: string;
  bundleToString: string;
};

type BaseSerializer = NonNullable<
  MetroConfig['serializer']['customSerializer']
>;

const modernSerializerModulePaths: SerializerModulePaths = {
  baseJSBundle: 'metro/private/DeltaBundler/Serializers/baseJSBundle',
  bundleToString: 'metro/private/lib/bundleToString',
};

const legacySerializerModulePaths: SerializerModulePaths = {
  baseJSBundle: 'metro/src/DeltaBundler/Serializers/baseJSBundle',
  bundleToString: 'metro/src/lib/bundleToString',
};

const isModuleResolutionError = (error: unknown) =>
  error instanceof Error &&
  'code' in error &&
  (error.code === 'MODULE_NOT_FOUND' ||
    error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED');

const getUnsupportedMetroError = () =>
  new Error(
    'Cannot find required internals of Metro. Please make sure you have installed a supported version of Metro.'
  );

const unwrapDefaultExport = (module: unknown) => {
  if (
    module !== null &&
    typeof module === 'object' &&
    'default' in module
  ) {
    return module.default;
  }

  return module;
};

const resolveModulePaths = (
  moduleLoader: ModuleLoader,
  modulePaths: SerializerModulePaths
) => {
  moduleLoader.resolve(modulePaths.baseJSBundle);
  moduleLoader.resolve(modulePaths.bundleToString);

  return modulePaths;
};

const getSerializerModulePaths = (moduleLoader: ModuleLoader) => {
  try {
    return resolveModulePaths(moduleLoader, modernSerializerModulePaths);
  } catch (error) {
    if (!isModuleResolutionError(error)) {
      throw error;
    }
  }

  return resolveModulePaths(moduleLoader, legacySerializerModulePaths);
};

export const createBaseSerializer = (moduleLoader: ModuleLoader = require) => {
  let modulePaths: SerializerModulePaths;

  try {
    modulePaths = getSerializerModulePaths(moduleLoader);
  } catch (error) {
    if (isModuleResolutionError(error)) {
      throw getUnsupportedMetroError();
    }

    throw error;
  }

  const baseJSBundle = unwrapDefaultExport(
    moduleLoader(modulePaths.baseJSBundle)
  ) as (...args: Parameters<BaseSerializer>) => unknown;
  const bundleToString = unwrapDefaultExport(
    moduleLoader(modulePaths.bundleToString)
  ) as (bundle: unknown) => ReturnType<BaseSerializer>;

  return (...args: Parameters<BaseSerializer>) =>
    bundleToString(baseJSBundle(...args));
};

export const getBaseSerializer = () => createBaseSerializer();
