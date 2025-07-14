import type { PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { viteRequire } from 'vite-require';
import reactNativeWeb from 'vite-plugin-react-native-web';
import { rozeniteServerPlugin } from './server-plugin.js';
import { rozeniteClientPlugin } from './client-plugin.js';
import { rozeniteReactNativePlugin } from './react-native-plugin.js';

export const rozenitePlugin = (): PluginOption[] => {
  const isServer = process.env.VITE_ROZENITE_TARGET === 'server';
  const isReactNative = process.env.VITE_ROZENITE_TARGET === 'react-native';

  if (isServer) {
    return [rozeniteServerPlugin()];
  } else if (isReactNative) {
    return [react(), viteRequire(), rozeniteReactNativePlugin()];
  }

  return [
    react(),
    // @ts-expect-error: TypeScript gets confused by the dual export
    reactNativeWeb(),
    rozeniteClientPlugin(),
  ];
};
