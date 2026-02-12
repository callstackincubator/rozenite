// https://docs.expo.dev/guides/using-eslint/
import baseConfig from '../../eslint.config.mjs';
import expoConfig from 'eslint-config-expo/flat.js';

export default [
  ...baseConfig,
  ...expoConfig,
  {
    ignores: ['dist/*'],
  },
];
