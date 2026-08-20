import { createRequire } from 'node:module';
import path from 'node:path';
import type { ConfigT } from 'metro-config';
import { createFixture } from './fixture.js';
import { monorepoRoot } from './paths.js';
import { getPanelModules, getRozeniteModules } from './rozenite-modules.js';

// Metro and the bundler presets are loaded through `require`, exactly as a
// `metro.config.js` would load them.
const require = createRequire(import.meta.url);

type MetroModule = Parameters<ConfigT['serializer']['processModuleFilter']>[0];

export type MetroConfig = ConfigT;

/**
 * Any shape a Metro config transformer may return: a config, a promise of
 * one, or a function producing either (which is what `withRozenite` does).
 */
export type ConfigureMetroResult =
  | MetroConfig
  | Promise<MetroConfig>
  | ((baseConfig: MetroConfig) => MetroConfig | Promise<MetroConfig>);

export type MetroProjectType = 'react-native' | 'expo';

export type BundleForReleaseOptions = {
  /**
   * Which default Metro config to start from: `@react-native/metro-config`
   * (React Native CLI) or `expo/metro-config`.
   * @default 'react-native'
   */
  projectType?: MetroProjectType;
  /**
   * Files written into the throwaway app, keyed by path relative to its
   * root.
   * @default a single `index.js` logging a line
   */
  files?: Record<string, string>;
  /**
   * Entry file, relative to the app root.
   * @default 'index.js'
   */
  entry?: string;
  /**
   * @default 'ios'
   */
  platform?: 'ios' | 'android';
  /**
   * Applies the integration under test to the default Metro config -- this
   * is the code path the assertion is about.
   */
  configureMetro?: (baseConfig: MetroConfig) => ConfigureMetroResult;
  /**
   * Directory whose `node_modules` is added to Metro's resolution paths.
   * Pass the root of the package under test so its own `@rozenite/*`
   * dependencies resolve.
   * @default process.cwd()
   */
  resolveFrom?: string;
};

export type ReleaseBundle = {
  /** The bundled release JavaScript. */
  code: string;
  /** Absolute paths of every real module Metro put in the bundle. */
  modules: string[];
  /**
   * The subset of `modules` that belongs to Rozenite, relative to the
   * monorepository root. A release bundle must leave this empty.
   */
  rozeniteModules: string[];
  /**
   * The subset of `rozeniteModules` that belongs to a plugin's DevTools
   * panel. This must be empty even when an app deliberately imports a
   * plugin's React Native code.
   */
  panelModules: string[];
};

const DEFAULT_FILES = {
  'index.js': "console.log('rozenite release bundle fixture');\n",
};

// Metro reports synthetic entries (the prelude, the run-module statement)
// through the same hook as real files; they have no path on disk.
const isRealModulePath = (modulePath: string): boolean => path.isAbsolute(modulePath);

const getDefaultMetroConfig = (projectType: MetroProjectType, projectRoot: string): MetroConfig => {
  const modulePath = projectType === 'expo' ? 'expo/metro-config' : '@react-native/metro-config';

  return require(modulePath).getDefaultConfig(projectRoot);
};

const resolveConfig = async (result: ConfigureMetroResult, baseConfig: MetroConfig) => {
  const resolved = await result;

  return typeof resolved === 'function' ? await resolved(baseConfig) : resolved;
};

/**
 * Bundles a throwaway app in release mode (`dev: false`) through Metro's
 * JavaScript API and reports what ended up inside.
 *
 * Module paths -- not the bundled source -- are what the assertion should
 * be made on: injected code (a `getPolyfills` entry, for one) carries no
 * `@rozenite` string, so grepping the output silently passes.
 */
export const bundleForRelease = async ({
  projectType = 'react-native',
  files = DEFAULT_FILES,
  entry = 'index.js',
  platform = 'ios',
  configureMetro,
  resolveFrom = process.cwd(),
}: BundleForReleaseOptions = {}): Promise<ReleaseBundle> => {
  const fixture = createFixture(files);

  try {
    const defaults = getDefaultMetroConfig(projectType, fixture.root);
    const baseConfig = {
      ...defaults,
      watchFolders: [fixture.root, monorepoRoot],
      resolver: {
        ...defaults.resolver,
        nodeModulesPaths: [
          path.join(fixture.root, 'node_modules'),
          path.join(resolveFrom, 'node_modules'),
          path.join(monorepoRoot, 'node_modules'),
        ],
      },
      // Silence Metro's progress output and keep runs independent of each
      // other -- a warm transform cache could hide a newly leaking module.
      reporter: { update: () => {} },
      cacheStores: [],
    } as MetroConfig;

    const config = configureMetro
      ? await resolveConfig(configureMetro(baseConfig), baseConfig)
      : baseConfig;

    const modulePaths = new Set<string>();
    const previousProcessModuleFilter = config.serializer?.processModuleFilter;

    const instrumentedConfig = {
      ...config,
      serializer: {
        ...config.serializer,
        processModuleFilter: (module: MetroModule) => {
          const included = previousProcessModuleFilter?.(module) ?? true;

          if (included && isRealModulePath(module.path)) {
            modulePaths.add(module.path);
          }

          return included;
        },
      },
    } as MetroConfig;

    const { code } = await require('metro').runBuild(instrumentedConfig, {
      entry,
      platform,
      dev: false,
      minify: false,
    });

    const modules = [...modulePaths].sort();

    return {
      code,
      modules,
      rozeniteModules: getRozeniteModules(modules),
      panelModules: getPanelModules(modules),
    };
  } finally {
    fixture.cleanup();
  }
};
