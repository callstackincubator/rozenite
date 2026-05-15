import { createContext } from 'react';
export type RozeniteTestClientRegistry = {
  subscribe: (listener: () => void) => () => void;
  getClient: (pluginId: string) => unknown | null;
};

export const RozeniteDevToolsClientContext =
  createContext<RozeniteTestClientRegistry | null>(null);
