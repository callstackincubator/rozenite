import { setupDevMode } from './dev-mode.js';
import { getGlobalNamespace } from './global-namespace.js';
import { loadPlugin } from './plugin-loader.js';
import { addWelcomeView } from './rn-devtools/rozenite-welcome-view.js';

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

  const plugins = getGlobalNamespace().installedPlugins;

  console.group('🚀 Rozenite DevTools Framework');
  console.log('Devtools framework loaded');
  console.log('Found plugins: ' + plugins.join(', '));
  console.groupEnd();

  addWelcomeView();

  await Promise.all(
    plugins.map(async (plugin) => {
      await loadPlugin(plugin);
    })
  );

  await setupDevMode();
};

void main().catch((error) => {
  console.group('❌ Rozenite Error');
  console.error(
    'Initialization failed. See the following error for more details:',
    error
  );
  console.groupEnd();
});
