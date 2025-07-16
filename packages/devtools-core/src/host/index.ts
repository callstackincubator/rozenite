import { getGlobalNamespace } from './global-namespace.js';
import { loadPlugin } from './plugin-loader.js';

const waitForInitialization = async (): Promise<void> => {
  return new Promise((resolve) => {
    window.addEventListener('DOMContentLoaded', async () => {
      const observer = new MutationObserver(async (_, observer) => {
        const inspectorMainPane = document.querySelector('.main-tabbed-pane');
        if (inspectorMainPane) {
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });
  });
};

const main = async (): Promise<void> => {
  await waitForInitialization();

  console.log('[Rozenite] Devtools framework loaded');

  const plugins = await getGlobalNamespace().installedPlugins;
  console.log('[Rozenite] Found plugins:', plugins);

  await Promise.all(
    plugins.map(async (plugin) => {
      console.log('[Rozenite] Loading plugin:', plugin);
      await loadPlugin(plugin);
    })
  );
};

void main().catch((error) => {
  console.error(
    '[Rozenite] Initialization failed. See the following error for more details:',
    error
  );
});
