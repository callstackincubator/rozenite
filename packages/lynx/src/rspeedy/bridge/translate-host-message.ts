import type { LynxClient } from '../types.js';
import type { HostAction } from './types.js';

/**
 * Host -> device CDP methods this bridge MUST answer locally and MUST
 * NEVER forward to the device.
 *
 * Both are part of the mandatory Fusebox handshake
 * `packages/app/src/connection/device-connection.ts`'s `socket.onopen`
 * handler runs on every fresh socket, before anything else: it awaits
 * `ReactNativeApplication.enable` and then `Runtime.enable`
 * unconditionally, and `runBootstrap` later awaits `Runtime.addBinding`.
 * Lynx has no `ReactNativeApplication` domain at all, and its `Runtime`
 * domain (11 methods) has no `addBinding`. Forwarding either one gets an
 * `{ error: { code: -32601, ... } }` ("Method not found") response back
 * from the device, and `handleSocketMessage`
 * (device-connection.ts:393-394) rejects the *whole* pending command on
 * any `error` field — which is exactly the promise `socket.onopen` is
 * awaiting. That rejection tears down the connection and hands it to
 * `runConnectLoop`'s bounded retry loop, where every retry resends the
 * same doomed command and fails the same way: a permanent retry loop, not
 * a transient error. Answering `{ id, result: {} }` locally is therefore
 * not an optimization — it is the only way a Lynx device can ever finish
 * this handshake. Do not "simplify" this away.
 */
const LOCALLY_ANSWERED_METHODS = new Set<string>([
  'Runtime.addBinding',
  'ReactNativeApplication.enable',
]);

/**
 * What the host is told the target's framework is.
 *
 * Carried in `integrationName` rather than `platform`, because `platform`
 * means the *device OS* everywhere else in this domain (React Native
 * sends `ios`/`android` from `RCTPlatformName` and its Android
 * equivalent), and a Lynx app runs on those same two. `integrationName`
 * is the free-form "which integration is driving this target" field —
 * React Native's own values are strings like
 * "iOS Bridge (RCTBridge)" — so naming Lynx there is exactly what it is
 * for. `@rozenite/app` reads it back in `src/framework.ts`.
 */
const LYNX_INTEGRATION_NAME = 'Lynx';

/**
 * The `ReactNativeApplication.metadataUpdated` event the bridge sends
 * after answering `enable`.
 *
 * A device with the domain sends this unprompted once enabled; Lynx has
 * no such domain, so the bridge that just claimed to enable it has to
 * speak for it here too — otherwise a host that enables the domain and
 * waits learns nothing, forever. Every field is a real value DebugRouter
 * reported about this client: nothing is invented to look more like React
 * Native than it is, and fields Lynx has no answer for
 * (`reactNativeVersion`) are omitted rather than faked.
 */
const buildMetadataUpdatedEvent = (client: LynxClient): unknown => ({
  method: 'ReactNativeApplication.metadataUpdated',
  params: {
    integrationName: LYNX_INTEGRATION_NAME,
    appDisplayName: client.appName,
    deviceName: client.deviceName,
    // Lowercased to match React Native's own casing for the same field.
    platform: client.os.toLowerCase(),
    ...(client.bundleId != null ? { appIdentifier: client.bundleId } : null),
  },
});

/**
 * Translates one raw host -> device message (a JSON string straight off
 * the host's WebSocket) into what the bridge should do with it.
 *
 * Pure: never throws. A malformed frame (bad JSON, not an object, missing
 * or non-numeric `id`, missing `method`) becomes `{ kind: 'drop', ... }`
 * rather than an exception — a rogue or buggy host client must not be
 * able to crash the dev server.
 *
 * `client` is the Lynx app this socket is attached to, when one is still
 * connected. It only affects the locally-answered
 * `ReactNativeApplication.enable`, which describes that app back to the
 * host; without it the reply is sent alone, exactly as before.
 */
export const translateHostMessage = (raw: string, client?: LynxClient): HostAction => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'drop', reason: 'Host message is not valid JSON.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'drop', reason: 'Host message is not a JSON object.' };
  }

  const record = parsed as Record<string, unknown>;

  if (typeof record.id !== 'number') {
    return { kind: 'drop', reason: 'Host message has no numeric "id".' };
  }

  if (typeof record.method !== 'string') {
    return { kind: 'drop', reason: 'Host message has no "method".' };
  }

  if (LOCALLY_ANSWERED_METHODS.has(record.method)) {
    const reply: HostAction = { kind: 'reply', message: { id: record.id, result: {} } };

    return record.method === 'ReactNativeApplication.enable' && client
      ? { ...reply, events: [buildMetadataUpdatedEvent(client)] }
      : reply;
  }

  // Everything else: pass through untouched, including the host's `id` —
  // the device echoes it back in its response and the host matches on it.
  return { kind: 'forward', message: record };
};
