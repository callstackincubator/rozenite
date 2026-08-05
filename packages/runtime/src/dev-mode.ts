import { loadPluginFromUrl, type LoadedPlugin } from './plugin-loader';

/** Must match `config.server.port` in `packages/vite-plugin` (`rozeniteClientPlugin`). */
const DEV_SERVER_URL = 'http://localhost:8888';

export const setupDevMode = async (): Promise<LoadedPlugin | null> => {
  try {
    const plugin = await loadPluginFromUrl(DEV_SERVER_URL);

    console.group('🔧 Rozenite Dev Mode');
    console.log('We detected that you are developing a plugin.');
    console.log('This plugin will be automatically loaded with hot reload.');
    console.groupEnd();

    return plugin;
  } catch {
    return null;
  }
};
