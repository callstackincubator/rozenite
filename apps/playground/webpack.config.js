const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { withRozeniteWeb } = require('@rozenite/web/webpack');

const appDirectory = __dirname;
const workspaceRoot = path.resolve(appDirectory, '../..');
const entryFile = path.resolve(appDirectory, 'src/main.tsx');

// `web:webpack` is plain webpack — neither @rozenite/metro nor @rozenite/repack
// covers it, so <Rozenite /> would silently resolve to the seam's shipped noop
// here and every web plugin demo would go dead. Redirect its internal dev-entry
// request to this project's rozenite.dev, the same way withRozenite() does for
// Metro and Re.Pack.
//
// The naive check is `resource.context.includes('@rozenite/react-native')`,
// on the assumption that pnpm's `nodeLinker: hoisted` puts a real directory at
// `node_modules/@rozenite/react-native`. That assumption doesn't hold here:
// even in hoisted mode, pnpm still symlinks workspace-local packages
// (`node_modules/@rozenite/react-native -> ../../../../packages/react-native`),
// and webpack's default `resolve.symlinks: true` resolves the *real* path
// before this hook ever sees it — verified empirically with a scratch webpack
// build using a symlinked workspace-style package: `resource.context` came back
// as the symlink target (`.../packages/<name>`), which does not contain the
// substring `@rozenite/react-native` at all. So instead of a substring check,
// resolve the seam package's real root once (mirroring how the Metro/Re.Pack
// guard identifies its own seam) and compare directories directly.
const seamPackageDir = (() => {
  try {
    return path.dirname(
      require.resolve('@rozenite/react-native/package.json', { paths: [appDirectory] }),
    );
  } catch {
    return null;
  }
})();
const srcDirectory = path.resolve(appDirectory, 'src');
const rozeniteDevDirectory = path.resolve(appDirectory, 'rozenite.dev');
const distDirectory = path.resolve(appDirectory, 'dist');
const reactNativeDirectory = path.resolve(workspaceRoot, 'node_modules/react-native');
const localReactNativeDirectory = path.resolve(appDirectory, 'node_modules/react-native');
const htmlTemplate = ({ htmlWebpackPlugin }) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Rozenite Playground Webpack</title>
    <style>
      html, body, #root {
        height: 100%;
      }

      body {
        margin: 0;
        background: #0b1020;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    ${htmlWebpackPlugin.tags.bodyTags}
  </body>
</html>`;

const babelLoaderConfiguration = {
  test: /\.[jt]sx?$/,
  include: [
    entryFile,
    srcDirectory,
    rozeniteDevDirectory,
    reactNativeDirectory,
    localReactNativeDirectory,
  ],
  use: {
    loader: 'babel-loader',
    options: {
      cacheDirectory: true,
      presets: ['module:@react-native/babel-preset'],
      plugins: ['react-native-web'],
    },
  },
};

const imageLoaderConfiguration = {
  test: /\.(gif|jpe?g|png|svg)$/i,
  type: 'asset/resource',
};

module.exports = (_, argv = {}) => {
  const mode = argv.mode ?? 'development';
  const isProduction = mode === 'production';

  const config = {
    mode,
    entry: entryFile,
    output: {
      clean: true,
      filename: 'bundle.web.js',
      path: distDirectory,
      publicPath: '/',
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    module: {
      rules: [babelLoaderConfiguration, imageLoaderConfiguration],
    },
    resolve: {
      alias: {
        'react-native$': 'react-native-web',
      },
      conditionNames: ['development', '...'],
      extensionAlias: {
        '.js': ['.web.ts', '.web.tsx', '.ts', '.tsx', '.web.js', '.js'],
        '.mjs': ['.mts', '.mjs'],
        '.cjs': ['.cts', '.cjs'],
      },
      extensions: [
        '.web.tsx',
        '.web.ts',
        '.web.jsx',
        '.web.js',
        '.tsx',
        '.ts',
        '.jsx',
        '.js',
        '.json',
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        templateContent: htmlTemplate,
      }),
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(!isProduction),
        'process.env.NODE_ENV': JSON.stringify(mode),
      }),
      new webpack.NormalModuleReplacementPlugin(/^\.\/dev-entry(\.js)?$/, (resource) => {
        if (
          seamPackageDir &&
          resource.context &&
          (resource.context === seamPackageDir ||
            resource.context.startsWith(seamPackageDir + path.sep))
        ) {
          resource.request = path.resolve(appDirectory, 'rozenite.dev');
        }
      }),
    ],
    devServer: {
      historyApiFallback: true,
      hot: true,
      port: 8081,
      static: {
        directory: distDirectory,
      },
    },
    performance: {
      hints: false,
    },
  };

  return withRozeniteWeb(config);
};
