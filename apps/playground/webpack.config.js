const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { withRozeniteWeb } = require('@rozenite/web/webpack');

const appDirectory = __dirname;
const workspaceRoot = path.resolve(appDirectory, '../..');
const entryFile = path.resolve(appDirectory, 'src/main.tsx');
const srcDirectory = path.resolve(appDirectory, 'src');
const distDirectory = path.resolve(appDirectory, 'dist');
const reactNativeDirectory = path.resolve(
  workspaceRoot,
  'node_modules/react-native',
);
const localReactNativeDirectory = path.resolve(
  appDirectory,
  'node_modules/react-native',
);
const rozeniteWebSourceDirectory = path.resolve(
  workspaceRoot,
  'packages/web/src',
);

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
    rozeniteWebSourceDirectory,
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
