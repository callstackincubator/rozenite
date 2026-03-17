import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.js', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        global: 'readonly',
      },
    },
  },
];
