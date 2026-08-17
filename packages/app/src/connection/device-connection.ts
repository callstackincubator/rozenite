/**
 * Connects to a single device over its own CDP WebSocket and exposes it as
 * an opaque channel: a status the UI can render, and a place to send and
 * receive plugin messages. This is the seam a future multiplexed hub can
 * replace without touching anything above it — nothing in `DeviceState` or
 * `DeviceConnection` names a WebSocket, a binding, or an execution context,
 * and no consumer needs to know this is CDP underneath.
 *
 * The protocol below is ported from
 * `packages/middleware/src/agent/session.ts`, which implements the same
 * handshake against Node's `ws` for the `rozenite agent` CLI. This is the
 * browser port of that: native `WebSocket`, plus a `reloading` state and
 * bounded, UI-visible recovery that the long-running Node agent doesn't
 * need.
 */
import { parseRozeniteBindingPayload } from './bindings';
import { MetroUnreachableError, resolveMetroTarget } from './metro-target-resolution';
import type { ParsedTarget } from './target-from-url';

const RUNTIME_GLOBAL = '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__';
const MAIN_EXECUTION_CONTEXT_NAME = 'main';
const DISPATCHER_INIT_MAX_ATTEMPTS = 20;
const DISPATCHER_INIT_RETRY_MS = 250;
const RECOVERY_MAX_ATTEMPTS = 16;
const RECOVERY_RETRY_DELAY_MS = 500;

const RECOVERABLE_CLOSE_REASONS = ['[RECREATING_DEVICE]', '[PAGE_NOT_FOUND]', '[CONNECTION_LOST]'];
// Something else took the device (e.g. React Native DevTools, another
// Rozenite window). We cannot tell which, and it isn't ours to fix by
// retrying, so this ends the connection rather than looping on it.
const DEVTOOLS_TOOK_CONNECTION_REASON = '[NEW_DEBUGGER_OPENED]';

export type DeviceState =
  | { status: 'connecting' }
  | { status: 'connected' }
  | { status: 'reloading' }
  | { status: 'disconnected' }
  | { status: 'rozeniteMissing' }
  | { status: 'metroUnreachable' };

/** Read-only, display-only description of the device this connection talks
 * to. Deliberately free of transport detail — see the module doc comment. */
export type DeviceTarget = {
  name: string;
  appId: string;
};

export type DeviceConnection = {
  getState: () => DeviceState;
  /** Returns an unsubscribe function. Pairs with `getState` for
   * `useSyncExternalStore`. */
  subscribe: (listener: (state: DeviceState) => void) => () => void;
  send: (message: unknown) => void;
  /** Returns an unsubscribe function. */
  onMessage: (listener: (message: unknown) => void) => () => void;
  getTarget: () => DeviceTarget;
  /** Manually retries from a terminal state (`disconnected`,
   * `rozeniteMissing`, `metroUnreachable`), or restarts a connection
   * attempt already in progress. */
  reconnect: () => void;
  close: () => void;
};

/** The dispatcher never appeared within the polling window: the app is
 * running, but Rozenite isn't installed in it (or hasn't initialized yet). */
class RozeniteMissingSignal extends Error {}

type PendingCommand = {
  resolve: (result: Record<string, unknown>) => void;
  reject: (error: Error) => void;
};

type CDPEvaluateResult = {
  result?: { value?: unknown };
  exceptionDetails?: { text?: string };
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const createDeviceConnection = (target: ParsedTarget): DeviceConnection => {
  let state: DeviceState = { status: 'connecting' };
  const stateListeners = new Set<(state: DeviceState) => void>();
  const messageListeners = new Set<(message: unknown) => void>();

  let currentTarget = target;
  let deviceName = target.deviceId;

  let ws: WebSocket | null = null;
  let epoch = 0;
  let recoveryInFlight = false;
  let bindingName: string | null = null;
  let bootstrapped = false;
  let nextCommandId = 1;
  const pendingCommands = new Map<number, PendingCommand>();
  let sendQueue: unknown[] = [];

  const isCurrentEpoch = (attemptEpoch: number): boolean => attemptEpoch === epoch;

  const setState = (next: DeviceState): void => {
    if (state.status === next.status) {
      return;
    }
    state = next;
    for (const listener of stateListeners) {
      listener(state);
    }
  };

  const rejectAllPending = (): void => {
    for (const [id, pending] of pendingCommands) {
      pendingCommands.delete(id);
      pending.reject(new Error('Device connection closed.'));
    }
  };

  const sendCommand = (
    socket: WebSocket,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    if (socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Device connection is not open.'));
    }

    const id = nextCommandId++;
    return new Promise((resolve, reject) => {
      pendingCommands.set(id, { resolve, reject });
      try {
        socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        pendingCommands.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  };

  const sendDomainMessage = (socket: WebSocket, message: unknown): Promise<void> => {
    const serializedMessage = JSON.stringify(message);
    const escapedMessage = JSON.stringify(serializedMessage);
    return sendCommand(socket, 'Runtime.evaluate', {
      expression: `${RUNTIME_GLOBAL}.sendMessage(${JSON.stringify('rozenite')}, ${escapedMessage})`,
    }).then(() => undefined);
  };

  const flushQueue = (): void => {
    const socket = ws;
    if (!socket) {
      return;
    }
    const queued = sendQueue;
    sendQueue = [];
    for (const message of queued) {
      void sendDomainMessage(socket, message);
    }
  };

  // Polls for the dispatcher global exactly as session.ts does: up to
  // DISPATCHER_INIT_MAX_ATTEMPTS (20) "attempts", of which the first 19
  // actually evaluate (the 20th only exists to make the final wait a no-op
  // and throw) — ported as-is rather than rounded off, to keep the retry
  // budget identical between the Node agent and this app.
  const waitForDispatcher = async (socket: WebSocket, attemptEpoch: number): Promise<void> => {
    for (let attempt = 1; attempt < DISPATCHER_INIT_MAX_ATTEMPTS; attempt++) {
      if (ws !== socket || !isCurrentEpoch(attemptEpoch)) {
        throw new Error('Connection attempt superseded.');
      }

      const response = (await sendCommand(socket, 'Runtime.evaluate', {
        expression: `globalThis.${RUNTIME_GLOBAL} != undefined`,
        returnByValue: true,
      })) as CDPEvaluateResult;

      if (response.result?.value === true) {
        return;
      }

      await wait(DISPATCHER_INIT_RETRY_MS);
    }

    throw new RozeniteMissingSignal();
  };

  const getBindingName = async (socket: WebSocket): Promise<string> => {
    const response = (await sendCommand(socket, 'Runtime.evaluate', {
      expression: `${RUNTIME_GLOBAL}.BINDING_NAME`,
    })) as CDPEvaluateResult;

    const value = response.result?.value;
    if (typeof value !== 'string' || value === '') {
      throw new Error('Rozenite dispatcher did not return a binding name.');
    }
    return value;
  };

  // Bootstraps (or re-bootstraps, after a JS reload) the "rozenite" domain
  // on `socket`. Deliberately does not initialize "react-devtools" — that
  // domain belongs to `rozenite agent`'s React service, not to this app.
  const runBootstrap = async (socket: WebSocket, attemptEpoch: number): Promise<void> => {
    await waitForDispatcher(socket, attemptEpoch);
    const bindingValue = await getBindingName(socket);

    if (bindingName !== bindingValue) {
      await sendCommand(socket, 'Runtime.addBinding', { name: bindingValue });
      bindingName = bindingValue;
    }

    await sendCommand(socket, 'Runtime.evaluate', {
      expression: `void ${RUNTIME_GLOBAL}.initializeDomain(${JSON.stringify('rozenite')})`,
    });
  };

  const handleMainContextRecreated = async (
    socket: WebSocket,
    attemptEpoch: number,
  ): Promise<void> => {
    if (ws !== socket || !isCurrentEpoch(attemptEpoch)) {
      return;
    }

    // A fresh execution context means the binding is gone too: force
    // `Runtime.addBinding` to run again rather than trusting the cached name.
    bindingName = null;
    bootstrapped = false;

    try {
      await runBootstrap(socket, attemptEpoch);
      if (ws !== socket || !isCurrentEpoch(attemptEpoch)) {
        return;
      }
      bootstrapped = true;
      setState({ status: 'connected' });
      flushQueue();
    } catch (error) {
      if (ws !== socket || !isCurrentEpoch(attemptEpoch)) {
        return;
      }
      if (error instanceof RozeniteMissingSignal) {
        setState({ status: 'rozeniteMissing' });
        return;
      }
      // Any other bootstrap failure here is left for the socket's own close
      // handling to resolve — the app may still send another context event.
      console.error('[rozenite] Failed to re-bootstrap after a reload.', error);
    }
  };

  const handleSocketMessage = (socket: WebSocket, raw: string, attemptEpoch: number): void => {
    if (ws !== socket || !isCurrentEpoch(attemptEpoch)) {
      return;
    }

    let message: Record<string, unknown>;
    try {
      message = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    if (typeof message.id === 'number') {
      const pending = pendingCommands.get(message.id);
      if (!pending) {
        return;
      }
      pendingCommands.delete(message.id);
      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)));
      } else {
        pending.resolve((message.result as Record<string, unknown>) ?? {});
      }
      return;
    }

    if (message.method === 'Runtime.executionContextDestroyed') {
      bootstrapped = false;
      setState({ status: 'reloading' });
      return;
    }

    if (
      message.method === 'Runtime.executionContextCreated' &&
      (message.params as { context?: { name?: string } } | undefined)?.context?.name ===
        MAIN_EXECUTION_CONTEXT_NAME
    ) {
      void handleMainContextRecreated(socket, attemptEpoch);
      return;
    }

    const bindingPayload = parseRozeniteBindingPayload(message);
    if (bindingPayload && bindingPayload.domain === 'rozenite') {
      for (const listener of messageListeners) {
        listener(bindingPayload.message);
      }
    }
    // Any other domain (e.g. "react-devtools") is not ours — drop it.
  };

  // A single connection attempt: opens `currentTarget.webSocketDebuggerUrl`
  // and bootstraps it. Resolves once bootstrapped (state is already
  // `connected` by then); rejects if the socket closes or bootstrap fails
  // first. Either way it also always runs the socket's close handling,
  // which is what decides whether an *already-connected* session recovers
  // or ends — this function only decides the outcome of a single attempt.
  const connectOnce = (attemptEpoch: number): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      if (!isCurrentEpoch(attemptEpoch)) {
        reject(new Error('Connection attempt superseded.'));
        return;
      }

      let socket: WebSocket;
      try {
        // The browser sets the `Origin` header itself, to this app's own
        // origin — unlike session.ts (Node's `ws`), there is no API to set
        // it explicitly, nor any need to.
        socket = new WebSocket(currentTarget.webSocketDebuggerUrl);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      ws = socket;

      let settled = false;
      const settleResolve = (): void => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const settleReject = (error: Error): void => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      socket.onopen = () => {
        if (ws !== socket || !isCurrentEpoch(attemptEpoch)) {
          socket.close();
          return;
        }

        void (async () => {
          try {
            await sendCommand(socket, 'ReactNativeApplication.enable');
            await sendCommand(socket, 'Runtime.enable');
            // A brand-new socket means a brand-new context: always re-add
            // the binding rather than trusting a name cached from before.
            bindingName = null;
            await runBootstrap(socket, attemptEpoch);
            if (ws !== socket || !isCurrentEpoch(attemptEpoch)) {
              return;
            }
            bootstrapped = true;
            setState({ status: 'connected' });
            flushQueue();
            settleResolve();
          } catch (error) {
            settleReject(error instanceof Error ? error : new Error(String(error)));
            socket.close();
          }
        })();
      };

      socket.onmessage = (event: MessageEvent) => {
        if (ws !== socket) return;
        handleSocketMessage(socket, String(event.data), attemptEpoch);
      };

      socket.onerror = () => {
        // Browsers give no detail on a generic `error` event. The `close`
        // event that follows carries the reason (if any) and drives every
        // state transition, so there is nothing to do here.
      };

      socket.onclose = (event: CloseEvent) => {
        if (ws === socket) {
          ws = null;
        }
        bootstrapped = false;
        rejectAllPending();
        settleReject(new Error(event.reason || 'Device connection closed.'));
        handleClose(event.reason ?? '', attemptEpoch);
      };
    });
  };

  const runConnectLoop = (loopEpoch: number, resolveBeforeFirstAttempt: boolean): void => {
    if (recoveryInFlight) {
      return;
    }
    recoveryInFlight = true;
    setState({ status: 'connecting' });

    void (async () => {
      try {
        for (let attempt = 1; attempt <= RECOVERY_MAX_ATTEMPTS; attempt++) {
          if (!isCurrentEpoch(loopEpoch)) {
            return;
          }

          try {
            if (attempt > 1 || resolveBeforeFirstAttempt) {
              const resolved = await resolveMetroTarget(currentTarget.deviceId);
              if (!isCurrentEpoch(loopEpoch)) {
                return;
              }
              currentTarget = {
                ...currentTarget,
                webSocketDebuggerUrl: resolved.webSocketDebuggerUrl,
              };
              deviceName = resolved.name;
            }

            await connectOnce(loopEpoch);
            return; // connected — state was already set inside connectOnce.
          } catch (error) {
            if (!isCurrentEpoch(loopEpoch)) {
              return;
            }
            if (error instanceof RozeniteMissingSignal) {
              setState({ status: 'rozeniteMissing' });
              return;
            }
            if (error instanceof MetroUnreachableError) {
              setState({ status: 'metroUnreachable' });
              return;
            }
            if (state.status !== 'connecting') {
              // A close handler already finalized the state for this
              // attempt (e.g. another debugger took the device).
              return;
            }
            if (attempt === RECOVERY_MAX_ATTEMPTS) {
              setState({ status: 'disconnected' });
              return;
            }
            await wait(RECOVERY_RETRY_DELAY_MS);
          }
        }
      } finally {
        recoveryInFlight = false;
      }
    })();
  };

  // The single place that decides what an already-open connection's close
  // means. Also runs for a close that happens mid-attempt (before
  // `connectOnce` resolves) — in that case `runConnectLoop`'s own retry
  // bookkeeping is what actually continues or stops the loop, using
  // `state.status` to notice when this function has already finalized it.
  const handleClose = (reason: string, closedEpoch: number): void => {
    if (!isCurrentEpoch(closedEpoch)) {
      return;
    }

    if (reason.includes(DEVTOOLS_TOOK_CONNECTION_REASON)) {
      setState({ status: 'disconnected' });
      return;
    }

    const isRecoverable = RECOVERABLE_CLOSE_REASONS.some((candidate) => reason.includes(candidate));
    if (isRecoverable) {
      // No-op if a loop for this epoch is already running (e.g. this close
      // fired for the socket that loop itself just opened).
      runConnectLoop(closedEpoch, true);
      return;
    }

    setState({ status: 'disconnected' });
  };

  const getState = (): DeviceState => state;

  const subscribe = (listener: (nextState: DeviceState) => void): (() => void) => {
    stateListeners.add(listener);
    return () => {
      stateListeners.delete(listener);
    };
  };

  const send = (message: unknown): void => {
    if (bootstrapped && ws) {
      void sendDomainMessage(ws, message);
    } else {
      sendQueue.push(message);
    }
  };

  const onMessage = (listener: (message: unknown) => void): (() => void) => {
    messageListeners.add(listener);
    return () => {
      messageListeners.delete(listener);
    };
  };

  const getTarget = (): DeviceTarget => ({
    name: deviceName,
    appId: currentTarget.appId,
  });

  const reconnect = (): void => {
    epoch += 1;
    const nextEpoch = epoch;
    if (ws) {
      const socket = ws;
      ws = null;
      socket.close();
    }
    bindingName = null;
    bootstrapped = false;
    recoveryInFlight = false;
    runConnectLoop(nextEpoch, true);
  };

  const close = (): void => {
    epoch += 1;
    if (ws) {
      const socket = ws;
      ws = null;
      socket.close();
    }
    rejectAllPending();
    bootstrapped = false;
    setState({ status: 'disconnected' });
  };

  // Kick off the initial connection. Unlike a recovery, this uses the
  // exact target the URL gave us — Metro's /json/list is only consulted
  // after a recoverable close, once the original page id may be stale.
  runConnectLoop(epoch, false);

  return {
    getState,
    subscribe,
    send,
    onMessage,
    getTarget,
    reconnect,
    close,
  };
};
