import { PluginDirectoryPage } from './types';

declare module '@rspress/shared' {
  interface PageIndexInfo {
    pluginDirectoryPage: PluginDirectoryPage;
  }
}

export {};
