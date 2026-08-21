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
 * Translates one raw host -> device message (a JSON string straight off
 * the host's WebSocket) into what the bridge should do with it.
 *
 * Pure: never throws. A malformed frame (bad JSON, not an object, missing
 * or non-numeric `id`, missing `method`) becomes `{ kind: 'drop', ... }`
 * rather than an exception — a rogue or buggy host client must not be
 * able to crash the dev server.
 */
export const translateHostMessage = (raw: string): HostAction => {
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
    return { kind: 'reply', message: { id: record.id, result: {} } };
  }

  // Everything else: pass through untouched, including the host's `id` —
  // the device echoes it back in its response and the host matches on it.
  return { kind: 'forward', message: record };
};
