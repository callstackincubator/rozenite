import type { GuestFunctions, HostFunctions, Plugin } from '../bridge/index.js';
import { createBirpc } from 'birpc';

const listeners = new Map<string, ((message: unknown) => void)[]>();

const guestFunctions: GuestFunctions = {
  onMessage: (message: any) => {
    const typeListeners = listeners.get(message.type) ?? [];
    typeListeners.forEach((listener) => listener(message));
  },
};

const rpc = createBirpc<HostFunctions, GuestFunctions>(guestFunctions, {
  post: (data) => window.parent.postMessage(data, '*'),
  on: (cb) => window.addEventListener('message', (event) => cb(event.data)),
  serialize: (data) => JSON.stringify(data),
  deserialize: (data) => JSON.parse(data),
});

export const callstackDevtoolsApi = {
  createPanel: rpc.createPanel.bind(rpc),
} as const;

export { Plugin };
