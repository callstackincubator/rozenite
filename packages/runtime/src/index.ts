import { setupDevMode } from './dev-mode.js';
import { getGlobalNamespace } from './global-namespace.js';
import { createPanel } from './create-panel.js';
import { loadPlugin } from './plugin-loader.js';
import { addWelcomeView } from './rn-devtools/rozenite-welcome-view.js';
import {
  trackPanelSelection,
  switchToSelectedPanel,
} from './rn-devtools/selected-panel-tracker.js';

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

  const { pluginDisplay = 'sidebar' } = getGlobalNamespace();

  if (pluginDisplay === 'tabs') {
    addWelcomeView();
    await Promise.all(plugins.map((plugin) => loadPlugin(plugin)));
    await setupDevMode();
  } else {
    const loadedPlugins = await Promise.all(
      plugins.map(async (plugin) => {
        return loadPlugin(plugin);
      }),
    );

    const developmentPlugin = await setupDevMode();
    if (developmentPlugin) {
      loadedPlugins.push(developmentPlugin);
    }

    const shellUrl = new URL(location.href);
    shellUrl.search = '';
    shellUrl.pathname = '/rozenite/shell/index.html';
    createPanel('@rozenite/shell', 'Rozenite', shellUrl.toString(), {
      plugins: loadedPlugins,
    });
  }

  trackPanelSelection();
  switchToSelectedPanel();
};

void main().catch((error) => {
  console.group('❌ Rozenite Error');
  console.error(
    'Initialization failed. See the following error for more details:',
    error,
  );
  console.groupEnd();
});
