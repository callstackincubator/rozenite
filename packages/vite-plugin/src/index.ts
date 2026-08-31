import type { PluginOption } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import reactNativeWeb from 'vite-plugin-react-native-web';
import { rozeniteClientPlugin } from './client-plugin.js';

// Re-exported so plugin authors can type `rozenite.config.ts` with
// `satisfies RozeniteConfig`, which is what turns a typo'd integration id
// into an editor error instead of a build failure later. `RozeniteConfig`
// is the config file's own shape; `RozeniteIntegration` comes from
// `@rozenite/tools`, re-exported here so authors need not depend on that
// package directly for one type.
export type { RozeniteConfig, PanelEntry } from './load-config.js';
export type { RozeniteIntegration } from '@rozenite/tools';

export type RozenitePluginOptions = {
  /**
   * Configure Tailwind CSS v4 for client panels.
   *
   * @default true
   */
  tailwind?: boolean;
};

/**
 * Builds the DevTools panels of a Rozenite plugin.
 *
 * Panels are the only part of a plugin that needs bundling: they ship as a
 * browser bundle rather than as a resolvable package entry point. The React
 * Native, Metro and SDK entry points are compiled with tsc by `rozenite build`.
 */
export const rozenitePlugin = ({ tailwind = true }: RozenitePluginOptions = {}): PluginOption[] => {
  return [
    ...(tailwind ? [tailwindcss()] : []),
    react(),
    // @ts-expect-error: TypeScript gets confused by the dual export
    reactNativeWeb(),
    rozeniteClientPlugin(),
  ];
};
