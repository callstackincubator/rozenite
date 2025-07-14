import { getGlobalNamespace } from './global-namespace.js';
import { loadPlugin } from './plugin-loader.js';

window.addEventListener('DOMContentLoaded', async () => {
  console.log('[Callstack] Devtools framework loaded');

  const plugins = await getGlobalNamespace().installedPlugins;
  console.log('[Callstack] Found plugins:', plugins);

  await Promise.all(
    plugins.map(async (plugin) => {
      console.log('[Callstack] Loading plugin:', plugin);
      await loadPlugin(plugin);
    })
  );
});
