import type { DevToolsPluginClient } from './client';
import type { UseDevToolsPluginClientOptions } from './useDevToolsPluginClient';

export type { DevToolsPluginClient, Subscription } from './client';
export type { UseDevToolsPluginClientOptions } from './useDevToolsPluginClient';
export { getDevToolsPluginClient } from './client';
export const useDevToolsPluginClient = <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>(
  _: UseDevToolsPluginClientOptions<TEventMap>
): DevToolsPluginClient<TEventMap> | null => {
  throw new Error('useDevToolsPluginClient is not supported in node');
};
