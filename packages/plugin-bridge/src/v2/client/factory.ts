import { getChannel, isLeader as detectLeader } from '../../channel/factory.js';
import { createClientInternal } from './client.js';
import { RozeniteClientConfig, RozeniteDevToolsClient } from './types.js';

/**
 * Creates a Rozenite DevTools client with the specified configuration.
 * 
 * This is the main entry point for creating clients.
 * It internally composes the connection layers (handshake + buffering)
 * and returns a clean, typed client API.
 * 
 * Messages are automatically buffered per-type and replayed when handlers
 * are registered, ensuring no messages are lost.
 * 
 * @example
 * ```typescript
 * type MyEvents = {
 *   'user-action': { action: string };
 *   'state-update': { state: object };
 * };
 * 
 * const client = await createClient<MyEvents>({
 *   pluginId: 'my-plugin',
 * });
 * 
 * // Messages are buffered until this handler is registered
 * // Then all buffered 'state-update' messages are replayed
 * client.onMessage('state-update', (message) => {
 *   console.log('State updated:', message.data, 'at', message.timestamp);
 * });
 * 
 * client.send('user-action', { action: 'click' });
 * ```
 */
export const createClient = async <
  TEventMap extends Record<string, unknown> = Record<string, unknown>
>(
  config: RozeniteClientConfig
): Promise<RozeniteDevToolsClient<TEventMap>> => {
  const {
    pluginId,
    channel: providedChannel,
    isLeader: providedIsLeader,
    buffer,
  } = config;

  // Use provided channel or get from factory
  const channel = providedChannel ?? (await getChannel());

  // Use provided isLeader or detect from environment
  const leader = providedIsLeader ?? detectLeader();

  return createClientInternal<TEventMap>({
    channel,
    pluginId,
    isLeader: leader,
    bufferConfig: buffer,
  });
};
