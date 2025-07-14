import type { GuestFunctions, HostFunctions } from '../bridge/index.js';
import { createBirpc } from 'birpc';
import { getCreatePanelCommandHandler } from './commands/create-panel.js';
import { getPlugins } from './commands/get-plugins.js';
import { PluginInstance } from './types.js';

export const getRpcForClient = (
  plugin: PluginInstance,
  iframe: HTMLIFrameElement
) => {
  const hostFunctions: HostFunctions = {
    createPanel: getCreatePanelCommandHandler(plugin),
    getPlugins,
  };

  const rpc = createBirpc<GuestFunctions, HostFunctions>(hostFunctions, {
    post: (data) => iframe.contentWindow?.postMessage(data, '*'),
    on: (cb) =>
      window.addEventListener('message', (event) => {
        if (event.source !== iframe.contentWindow) {
          return;
        }

        cb(event.data);
      }),
    serialize: (data) => JSON.stringify(data),
    deserialize: (data) => JSON.parse(data),
  });

  return rpc;
};
