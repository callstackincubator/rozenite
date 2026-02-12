import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['react-native/**/*.ts', 'react-native/**/*.js'],
    languageOptions: {
      globals: {
        __DEV__: 'readonly',
      },
    },
  },
  {
    files: ['**/*.json'],
    rules: {},
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
