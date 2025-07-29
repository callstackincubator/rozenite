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
        fileName: (format) => `metro.${format === 'es' ? 'js' : 'cjs'}`,
      };
      config.build.ssr = true;
      config.build.rollupOptions = {
        output: {
          exports: 'named',
          interop: 'auto',
        },
      };
    },
  };
};
