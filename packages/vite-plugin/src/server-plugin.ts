import type { Plugin } from 'vite';
import process from 'node:process';
import path from 'node:path';

export const rozeniteServerPlugin = (): Plugin => {
  return {
    name: 'rozenite-server-plugin',

    config(config) {
      const projectRoot = config.root ?? process.cwd();

      config.build ??= {};
      config.build.lib = {
        entry: path.resolve(projectRoot, 'metro.ts'),
        formats: ['es' as const, 'cjs' as const],
        fileName: (format) => `metro/index.${format === 'es' ? 'js' : 'cjs'}`,
      };
      config.build.ssr = true;
      config.build.rollupOptions ??= {};
      config.build.rollupOptions.output = [
        {
          format: 'es',
          entryFileNames: 'metro/index.js',
          exports: 'named',
          interop: 'auto',
        },
        {
          format: 'cjs',
          entryFileNames: 'metro/index.cjs',
          exports: 'named',
          interop: 'auto',
        },
      ];
    },
  };
};
