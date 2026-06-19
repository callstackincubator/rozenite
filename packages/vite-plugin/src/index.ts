import type { PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import reactNativeWeb from 'vite-plugin-react-native-web';
import path from 'node:path';
import { rozeniteServerPlugin } from './server-plugin.js';
import { rozeniteClientPlugin } from './client-plugin.js';
import { rozeniteReactNativePlugin } from './react-native-plugin.js';
import { rozeniteSdkPlugin } from './sdk-plugin.js';
import maybeDtsPlugin from 'vite-plugin-dts';
import requirePlugin from './require-plugin.js';
import { bundleTargetDeclarations } from './bundle-dts.js';

// vite-plugin-dts exports differently in CJS and ESM
const dtsPlugin =
  'default' in maybeDtsPlugin
    ? (maybeDtsPlugin.default as typeof maybeDtsPlugin)
    : maybeDtsPlugin;

const getDtsPlugin = (
  target: 'react-native' | 'metro' | 'sdk',
): PluginOption => {
  const projectRoot = process.cwd();
  const entryRoot =
    target === 'react-native'
      ? 'react-native.ts'
      : target === 'metro'
        ? 'metro.ts'
        : 'sdk.ts';
  const distRoot = path.join(projectRoot, 'dist');
  const targetRoot = path.join(distRoot, target);
  const publicEntryPath = path.join(projectRoot, 'dist', target, 'index.d.ts');
  const sdkBundleEntryPath = path.join(targetRoot, `${target}.d.ts`);
  const rawSdkEntryPath = path.join(distRoot, `${target}.d.ts`);

  return dtsPlugin({
    entryRoot,
    include: [entryRoot, 'src/**/*.ts', 'src/**/*.tsx', 'src/**/*.d.ts'],
    outDir: `dist/${target}`,
    strictOutput: false,
    insertTypesEntry: false,
    // Preserve package specifiers in published declarations instead of
    // rewriting workspace imports to source file paths.
    pathsToAliases: false,
    tsconfigPath: path.join(projectRoot, 'tsconfig.json'),
    beforeWriteFile: (filePath, content) => {
      if (!filePath.endsWith('.d.ts')) {
        return false;
      }

      if (
        filePath === publicEntryPath ||
        (target !== 'sdk' && filePath.endsWith(`/${target}.d.ts`))
      ) {
        return {
          filePath: publicEntryPath,
          content,
        };
      }

      if (
        target === 'sdk' &&
        filePath === rawSdkEntryPath
      ) {
        return {
          // vite-plugin-dts emits the SDK root declaration at dist/sdk.d.ts.
          // Move it under dist/sdk/ before API Extractor rolls it up into the
          // published dist/sdk/index.d.ts.
          filePath: sdkBundleEntryPath,
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
  const isSdk = process.env.VITE_ROZENITE_TARGET === 'sdk';

  if (isServer) {
    return [rozeniteServerPlugin(), getDtsPlugin('metro')] as PluginOption[];
  } else if (isReactNative) {
    return [
      react(),
      requirePlugin(),
      rozeniteReactNativePlugin(),
      getDtsPlugin('react-native'),
    ] as PluginOption[];
  } else if (isSdk) {
    return [rozeniteSdkPlugin(), getDtsPlugin('sdk')] as PluginOption[];
  }

  return [
    react(),
    // @ts-expect-error: TypeScript gets confused by the dual export
    reactNativeWeb(),
    rozeniteClientPlugin(),
  ];
};
