import type { GuestFunctions, HostFunctions, Plugin } from '../bridge/index.js';
import { createBirpc } from 'birpc';

const guestFunctions: GuestFunctions = {};

const rpc = createBirpc<HostFunctions, GuestFunctions>(guestFunctions, {
  post: (data) => window.parent.postMessage(data, '*'),
  on: (cb) => window.addEventListener('message', (event) => cb(event.data)),
  serialize: (data) => JSON.stringify(data),
  deserialize: (data) => JSON.parse(data),
});

export const callstackDevtoolsApi = {
  createPanel: rpc.createPanel.bind(rpc),
  getPlugins: rpc.getPlugins.bind(rpc),
} as const;

export { Plugin };
