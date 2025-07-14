import { getRpcForClient } from './guest-rpc.js';
import { PluginInstance } from './types.js';

export const getPluginScopedUrl = (pluginId: string, path: string) => {
  return `http://localhost:8081/callstack/plugins/${pluginId.replace(
    '/',
    '_'
  )}/${path}`;
};

export const loadPlugin = async (
  pluginId: string
): Promise<HTMLIFrameElement> => {
  const devtoolsPage = getPluginScopedUrl(pluginId, 'devtools.html');
  const iframe = document.createElement('iframe');

  const plugin: PluginInstance = {
    id: pluginId,
    devtoolsIframe: iframe,
    panels: [],
  };

  getRpcForClient(plugin, iframe);

  iframe.src = devtoolsPage;
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  await new Promise((resolve) => {
    iframe.addEventListener('load', resolve);
  });

  return iframe;
};
