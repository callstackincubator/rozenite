// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { composeMetroConfigTransformers } = require('@rozenite/tools');
const { withRozenite } = require('@rozenite/metro');
const {
  withRozeniteReduxDevTools,
} = require('@rozenite/redux-devtools-plugin/metro');
const {
  withRozeniteRequireProfiler,
} = require('@rozenite/require-profiler-plugin/metro');
const { withRozeniteWeb } = require('@rozenite/web/metro');
const path = require('node:path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

config.watchFolders = [...config.watchFolders, workspaceRoot];
config.resolver.nodeModulesPaths = [
  ...config.resolver.nodeModulesPaths,
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.assetExts.push('wasm');

const previousEnhanceMiddleware = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    const previousMiddleware =
      previousEnhanceMiddleware?.(middleware) ?? middleware;

    return (req, res, next) => {
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      previousMiddleware(req, res, next);
    };
  },
};

module.exports = composeMetroConfigTransformers([
  withRozenite,
  {
    projectType: 'expo',
    enabled: true,
    enhanceMetroConfig: composeMetroConfigTransformers(
      withRozeniteRequireProfiler,
      withRozeniteReduxDevTools,
      withRozeniteWeb,
    ),
  },
])(config);
