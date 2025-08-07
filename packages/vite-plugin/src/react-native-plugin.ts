import { Plugin } from 'vite';
import path from 'node:path';

export const rozeniteReactNativePlugin = (): Plugin => {
  return {
    name: 'rozenite-react-native-plugin',
    config(config) {
      const projectRoot = config.root ?? process.cwd();

      config.build ??= {};
      config.build.rollupOptions ??= {};

      config.build.lib = {
        entry: path.resolve(projectRoot, 'react-native.ts'),
        fileName: (format) => `react-native.${format === 'es' ? 'js' : 'cjs'}`,
      };

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
          chunkFileNames: '[name].js',
          ...(config.build.rollupOptions.output ?? {}),
        },
        {
          format: 'cjs',
          exports: 'named',
          interop: 'auto',
          chunkFileNames: '[name].cjs',
          ...(config.build.rollupOptions.output ?? {}),
        },
      ];

      delete config.build.rollupOptions.input;
    },
  };
};
