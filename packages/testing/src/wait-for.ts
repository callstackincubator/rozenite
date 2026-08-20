import type { Channel, RozeniteDevToolsClient, Subscription } from '@rozenite/plugin-bridge';
import { ROZENITE_RPC_MESSAGE_TYPE } from '@rozenite/plugin-bridge';

/**
 * Thrown by every `waitFor*` helper here when its timeout elapses before a
 * matching message arrived. Distinct from a generic `Error` so callers (and
 * their runner's assertion library) can tell "nothing showed up in time"
 * apart from any other failure.
 */
export class WaitForTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WaitForTimeoutError';
  }
}

export type WaitForOptions = {
  /**
   * Milliseconds to wait before rejecting with `WaitForTimeoutError`.
   * Required on purpose: a `waitFor` with no deadline is a hung test rather
   * than a failing one.
   */
  timeoutMs: number;
};

/**
 * Subscribes via `subscribe`, resolving with whatever value it passes to
 * `settle`, or rejecting with a `WaitForTimeoutError` built from `describe`
 * if `timeoutMs` elapses first. Shared by every `waitFor*` helper below.
 */
const raceTimeout = <TValue>(
  subscribe: (settle: (value: TValue) => void) => Subscription,
  timeoutMs: number,
  describe: () => string,
): Promise<TValue> => {
  return new Promise((resolve, reject) => {
    let settled = false;
    // A holder object rather than a bare `let` so `finish` can safely read
    // it even if `subscribe` were to call `settle` synchronously (before
    // its own return value is assigned below) — real `Channel`s never do,
    // but nothing here should assume it.
    const subscriptionRef: { current?: Subscription } = {};

    const finish = (run: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      subscriptionRef.current?.remove();
      run();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new WaitForTimeoutError(describe())));
    }, timeoutMs);

    subscriptionRef.current = subscribe((value) => finish(() => resolve(value)));
  });
};

/**
 * Waits for the next message of `type` on a `RozeniteDevToolsClient` — the
 * client-level counterpart of `client.onMessage(type, listener)`, as a
 * promise instead of a subscription.
 *
 * ```ts
 * const response = await waitForMessage(panelClient, 'storage:list-response', {
 *   timeoutMs: 1000,
 * });
 * ```
 *
 * `predicate` is a separate, trailing parameter rather than nested inside
 * `options` on purpose: `client` is typically a
 * `RozeniteDevToolsRequestClient` (an intersection type — see
 * `RozeniteDevToolsRequestClient` in `@rozenite/plugin-bridge`), and
 * TypeScript's contextual typing of a callback nested inside an object
 * literal argument does not reliably resolve against an intersection-typed
 * earlier argument. Keeping it a direct argument sidesteps that.
 */
export const waitForMessage = <
  TEventMap extends Record<string, unknown>,
  TType extends keyof TEventMap,
>(
  client: RozeniteDevToolsClient<TEventMap>,
  type: TType,
  options: WaitForOptions,
  predicate?: (payload: TEventMap[TType]) => boolean,
): Promise<TEventMap[TType]> => {
  const { timeoutMs } = options;

  return raceTimeout<TEventMap[TType]>(
    (settle) =>
      client.onMessage(type, (payload) => {
        if (predicate && !predicate(payload)) {
          return;
        }
        settle(payload);
      }),
    timeoutMs,
    () =>
      `waitForMessage timed out after ${timeoutMs}ms waiting for message type "${String(type)}"` +
      (predicate ? ' matching the given predicate' : '') +
      '. No matching message arrived on the client before the timeout.',
  );
};

/**
 * Waits for the next raw message on a `Channel` that satisfies `predicate`
 * — the lower-level counterpart of `waitForMessage`, useful below the
 * `pluginId`/`type` demultiplexing a `RozeniteDevToolsClient` does (e.g. to
 * assert on the envelope itself, or before any client wraps the channel).
 */
export const waitForChannelMessage = (
  channel: Channel,
  predicate: (message: unknown) => boolean,
  options: WaitForOptions,
): Promise<unknown> => {
  const { timeoutMs } = options;

  return raceTimeout<unknown>(
    (settle) =>
      channel.onMessage((message) => {
        if (!predicate(message)) {
          return;
        }
        settle(message);
      }),
    timeoutMs,
    () =>
      `waitForChannelMessage timed out after ${timeoutMs}ms waiting for a message matching the given predicate. No matching message arrived on the channel before the timeout.`,
  );
};

/**
 * RPC-aware helper: waits for the next frame of the reserved
 * `'rozenite:rpc'` message type (see `createRozeniteRpc` in
 * `@rozenite/plugin-bridge`) that satisfies `predicate`.
 *
 * Useful for asserting on the wire protocol directly — e.g. that a call for
 * a given method was actually sent — rather than only on its eventual
 * settled result, which `RozeniteRpc['method']().invoke()` already awaits
 * (with its own timeout) on its own.
 *
 * `TFrame` is left to the caller to narrow (e.g. to `{ kind: 'request'; id:
 * string; method: string }`) since the frame shape is `createRozeniteRpc`'s
 * internal wire format, not part of `@rozenite/plugin-bridge`'s public API.
 *
 * `client` is typed the same way `createRozeniteRpc`'s own `RpcTransport`
 * is internally (`RozeniteDevToolsClient<any>`, see
 * `packages/plugin-bridge/src/rpc/create-rozenite-rpc.ts`): the reserved
 * `'rozenite:rpc'` type is deliberately absent from a plugin's own event
 * map, so no concrete `RozeniteDevToolsClient<TEventMap>` a caller actually
 * has can name it in `TEventMap`. `any` at this one boundary — not a wider
 * escape hatch — is how the client that owns this reserved type already
 * expresses that.
 */
export const waitForRpcFrame = <TFrame = unknown>(
  client: RozeniteDevToolsClient<any>,
  predicate: (frame: TFrame) => boolean,
  options: WaitForOptions,
): Promise<TFrame> => {
  const { timeoutMs } = options;

  return raceTimeout<TFrame>(
    (settle) =>
      client.onMessage(ROZENITE_RPC_MESSAGE_TYPE, (frame: unknown) => {
        if (!predicate(frame as TFrame)) {
          return;
        }
        settle(frame as TFrame);
      }),
    timeoutMs,
    () =>
      `waitForRpcFrame timed out after ${timeoutMs}ms waiting for a matching RPC frame on the reserved "${ROZENITE_RPC_MESSAGE_TYPE}" message type. No matching frame arrived before the timeout.`,
  );
};
