import type { Plugin } from 'vite';
import process from 'node:process';
import { resolveFileWithExtensions } from './utils.js';

export const rozeniteServerPlugin = (): Plugin => {
  return {
    name: 'rozenite-server-plugin',

    config(config) {
      const projectRoot = config.root ?? process.cwd();
      const backgroundFilePath = resolveFileWithExtensions(
        projectRoot,
        'background'
      );

      if (!backgroundFilePath) {
        throw new Error('Background file not found');
      }

      config.build ??= {};
      config.build.rollupOptions ??= {};
      config.build.rollupOptions.input = backgroundFilePath;
      config.build.ssr = true;
      config.build.rollupOptions.output = {
        format: 'cjs',
      };
    },
  };
};
