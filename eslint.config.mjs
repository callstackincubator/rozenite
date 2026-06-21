import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/build',
    ],
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Ban direct hero-ui imports outside the @rozenite/ui facade.
    files: ['packages/**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@heroui/*', '@heroui'],
              message:
                'Import hero-ui from "@rozenite/ui" instead of "@heroui/*". If a component is missing, add it to packages/ui/src/index.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    // @rozenite/ui IS the facade and is allowed to import hero-ui directly.
    files: ['packages/ui/**/*.{ts,tsx,cts,mts}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
