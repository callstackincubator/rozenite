import type { ShellHost } from './host';

export type ShellPanel = {
  id: string;
  name: string;
  source: string;
};

export type ShellPlugin = {
  id: string;
  name: string;
  description: string;
  version: string;
  panels: ShellPanel[];
};

export type ShellConfiguration = {
  plugins: ShellPlugin[];
  destroyOnDetachPlugins: string[];
  runtimeVersion?: string;
};

export type ShellProps = ShellConfiguration & {
  host: ShellHost;
  /**
   * Merged onto the shell's root element (its own `PluginShell`), via
   * `cn`/`tailwind-merge` so a conflicting utility here wins over the
   * default. The default root is `h-screen` — sized to fill an entire
   * page on its own, which is right when `Shell` is the whole page (the
   * embedded React Native DevTools case) but wrong for an embedder that
   * places `Shell` alongside other chrome (e.g. `@rozenite/app`'s status
   * footer): pass e.g. `"h-full min-h-0"` there so the parent's own layout
   * controls how much space `Shell` gets instead of it always claiming the
   * full viewport.
   */
  className?: string;
};
