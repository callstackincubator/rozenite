const { withNxMetro } = require('@nx/react-native');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withDebuggerFramework } = require('@rozenite/metro');
const { withExpoAtlasWithoutExpo } = require('expo-atlas-without-expo');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const customConfig = {
  cacheVersion: '@rozenite/playground',
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...sourceExts, 'cjs', 'mjs', 'svg'],
    unstable_enablePackageExports: true,
  },
  server: {},
};

module.exports = withDebuggerFramework(
  withNxMetro(
    withExpoAtlasWithoutExpo(mergeConfig(defaultConfig, customConfig)),
    {
      // Change this to true to see debugging info.
      // Useful if you have issues resolving modules
      debug: false,
      // all the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx', 'json'
      extensions: [],
      // Specify folders to watch, in addition to Nx defaults (workspace libraries and node_modules)
      watchFolders: [],
    }
  )
);
