import { getManifest } from './manifest';
import { loadPluginFromUrl } from './plugin-loader';

/** Must match `config.server.port` in `packages/vite-plugin` (`rozeniteClientPlugin`). */
const DEV_SERVER_URL = 'http://localhost:8888';

const isDevServerAvailable = async (): Promise<boolean> => {
  try {
    await getManifest(DEV_SERVER_URL);
    return true;
  } catch {
    return false;
  }
};

export const setupDevMode = async (): Promise<void> => {
  const isAvailable = await isDevServerAvailable();

  if (!isAvailable) {
    return;
  }

  console.group('🔧 Rozenite Dev Mode');
  console.log('We detected that you are developing a plugin.');
  console.log('This plugin will be automatically loaded with hot reload.');
  console.groupEnd();

  await loadPluginFromUrl(DEV_SERVER_URL);
};
