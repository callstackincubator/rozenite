import type { Plugin } from 'vite';
import path from 'node:path';

export const rozeniteSdkPlugin = (): Plugin => {
  return {
    name: 'rozenite-sdk-plugin',
    config(config) {
      const projectRoot = config.root ?? process.cwd();

      config.build ??= {};
      config.build.lib = {
        entry: path.resolve(projectRoot, 'sdk.ts'),
        formats: ['es' as const, 'cjs' as const],
        fileName: (format) => `sdk/index.${format === 'es' ? 'js' : 'cjs'}`,
      };
      config.build.rollupOptions ??= {};
      config.build.rollupOptions.external = (id) => {
        if (id.startsWith('node:')) {
          return true;
        }

        return !id.startsWith('.') && !path.isAbsolute(id);
      };
      config.build.rollupOptions.output = [
        {
          format: 'es',
          exports: 'named',
          interop: 'auto',
          entryFileNames: 'sdk/index.js',
          chunkFileNames: 'sdk/chunks/[name].js',
        },
        {
          format: 'cjs',
          exports: 'named',
          interop: 'auto',
          entryFileNames: 'sdk/index.cjs',
          chunkFileNames: 'sdk/chunks/[name].cjs',
        },
      ];

      delete config.build.rollupOptions.input;
    },
  };
};
