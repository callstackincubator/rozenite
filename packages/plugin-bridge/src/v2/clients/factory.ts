import { getChannel, isLeader as detectLeader } from '../../channel/factory.js';
import { createAutoReadyClient } from './auto-ready-client.js';
import { createManualReadyClient } from './manual-ready-client.js';
import { RozeniteClientConfig, RozeniteDevToolsClient } from './types.js';

export const createClient = async <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>(
  config: RozeniteClientConfig
): Promise<RozeniteDevToolsClient<TEventMap>> => {
  const { pluginId, readyMode, channel: providedChannel, isLeader: providedIsLeader } = config;

  // Use provided channel or get from factory
  const channel = providedChannel ?? await getChannel();

  // Use provided isLeader or detect from environment
  const leader = providedIsLeader ?? detectLeader();

  if (readyMode === 'manual') {
    const client = createManualReadyClient<TEventMap>(channel, pluginId, leader);
    await client.initialize();
    return client;
  } else {
    const client = createAutoReadyClient<TEventMap>(channel, pluginId, leader);
    await client.initialize();
    return client;
  }
};
