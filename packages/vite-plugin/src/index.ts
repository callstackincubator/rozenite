import type { PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import reactNativeWeb from 'vite-plugin-react-native-web';
import { rozeniteServerPlugin } from './server-plugin.js';
import { rozeniteClientPlugin } from './client-plugin.js';
import { rozeniteReactNativePlugin } from './react-native-plugin.js';
import maybeDtsPlugin from 'vite-plugin-dts';
import requirePlugin from './require-plugin.js';

// vite-plugin-dts exports differently in CJS and ESM
const dtsPlugin =
  'default' in maybeDtsPlugin
    ? (maybeDtsPlugin.default as typeof maybeDtsPlugin)
    : maybeDtsPlugin;

export const rozenitePlugin = (): PluginOption[] => {
  const isServer = process.env.VITE_ROZENITE_TARGET === 'server';
  const isReactNative = process.env.VITE_ROZENITE_TARGET === 'react-native';

  if (isServer) {
    return [rozeniteServerPlugin()];
  } else if (isReactNative) {
    return [
      react(),
      requirePlugin(),
      rozeniteReactNativePlugin(),
      dtsPlugin({ rollupTypes: true }),
    ] as PluginOption[];
  }

  return [
    react(),
    // @ts-expect-error: TypeScript gets confused by the dual export
    reactNativeWeb(),
    rozeniteClientPlugin(),
  ];
};
