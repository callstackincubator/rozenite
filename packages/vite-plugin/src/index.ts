import type { PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import reactNativeWeb from 'vite-plugin-react-native-web';
import path from 'node:path';
import { rozeniteServerPlugin } from './server-plugin.js';
import { rozeniteClientPlugin } from './client-plugin.js';
import { rozeniteReactNativePlugin } from './react-native-plugin.js';
import maybeDtsPlugin from 'vite-plugin-dts';
import requirePlugin from './require-plugin.js';
import { bundleTargetDeclarations } from './bundle-dts.js';

// vite-plugin-dts exports differently in CJS and ESM
const dtsPlugin =
  'default' in maybeDtsPlugin
    ? (maybeDtsPlugin.default as typeof maybeDtsPlugin)
    : maybeDtsPlugin;

const getDtsPlugin = (target: 'react-native' | 'metro'): PluginOption => {
  const projectRoot = process.cwd();
  const entryRoot = target === 'react-native' ? 'react-native.ts' : 'metro.ts';
  const distRoot = path.join(projectRoot, 'dist');
  const targetRoot = path.join(distRoot, target);
  const publicEntryPath = path.join(projectRoot, 'dist', target, 'index.d.ts');

  return dtsPlugin({
    entryRoot,
    include: [entryRoot, 'src/**/*.ts', 'src/**/*.tsx', 'src/**/*.d.ts'],
    outDir: `dist/${target}`,
    strictOutput: false,
    insertTypesEntry: false,
    tsconfigPath: path.join(projectRoot, 'tsconfig.json'),
    beforeWriteFile: (filePath, content) => {
      if (!filePath.endsWith('.d.ts')) {
        return false;
      }

      if (
        filePath === publicEntryPath ||
        filePath.endsWith(`/${target}.d.ts`)
      ) {
        return {
          filePath: publicEntryPath,
          content,
        };
      }

      const relativeToDist = path.relative(distRoot, filePath);

      if (!relativeToDist.startsWith('src/')) {
        return false;
      }

      return {
        filePath: path.join(targetRoot, relativeToDist),
        content,
      };
    },
    afterBuild: async () => {
      await bundleTargetDeclarations(projectRoot, target);
    },
  });
};

export const rozenitePlugin = (): PluginOption[] => {
  const isServer = process.env.VITE_ROZENITE_TARGET === 'server';
  const isReactNative = process.env.VITE_ROZENITE_TARGET === 'react-native';

  if (isServer) {
    return [rozeniteServerPlugin(), getDtsPlugin('metro')] as PluginOption[];
  } else if (isReactNative) {
    return [
      react(),
      requirePlugin(),
      rozeniteReactNativePlugin(),
      getDtsPlugin('react-native'),
    ] as PluginOption[];
  }

  return [
    react(),
    // @ts-expect-error: TypeScript gets confused by the dual export
    reactNativeWeb(),
    rozeniteClientPlugin(),
  ];
};
