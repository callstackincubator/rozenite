import type { GuestFunctions, HostFunctions } from '../bridge/index.js';
import { createBirpc } from 'birpc';
import { getCreatePanelCommandHandler } from './commands/create-panel.js';

export type DevToolsPluginClient = {
  send: (message: unknown) => void;
  onMessage: (listener: (message: unknown) => void) => void;
};

export const getRpcForClient = (
  pluginId: string,
  iframe: HTMLIFrameElement
) => {
  const hostFunctions: HostFunctions = {
    createPanel: getCreatePanelCommandHandler(pluginId),
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
