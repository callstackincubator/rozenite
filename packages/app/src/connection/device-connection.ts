import { IS_WEB_TARGET_EXPRESSION } from '@rozenite/tools/integration';
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
import { resolveFramework, type Framework } from '../framework';
import { MetroUnreachableError, resolveMetroTarget } from './metro-target-resolution';
import type { ParsedTarget } from './target-from-url';

const RUNTIME_GLOBAL = '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__';
const MAIN_EXECUTION_CONTEXT_NAME = 'main';
const DISPATCHER_INIT_MAX_ATTEMPTS = 20;
const DISPATCHER_INIT_RETRY_MS = 250;
const RECOVERY_MAX_ATTEMPTS = 16;
const RECOVERY_RETRY_DELAY_MS = 500;
/** Mirrors `session.ts`'s `BOOTSTRAP_DELAY_MS`: coalesces a burst of
 * `executionContextCreated("main")` events into a single re-bootstrap. */
const BOOTSTRAP_DEBOUNCE_MS = 500;
/** A command the device never answers (a wedged JS thread) must not leave
 * `waitForDispatcher`/`getBindingName` awaiting forever. */
const COMMAND_TIMEOUT_MS = 10_000;
/** Bounds `sendQueue` so a long offline stretch can't accumulate an
 * unbounded backlog; oldest queued messages are dropped first. */
const SEND_QUEUE_MAX_SIZE = 100;

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
  /**
   * Which framework this target runs, as the device itself reported it
   * (`ReactNativeApplication.metadataUpdated`). `null` until that arrives
   * — the domain is enabled during the handshake, so on a device that
   * implements it this is answered within the first round trip.
   */
  framework: Framework | null;
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
  /**
   * Whether the connected target is a browser, as reported by the device
   * itself — `null` until the probe has answered, or if it failed.
   *
   * This is half of the target's integration; the other half (which host
   * this dev server serves) comes from `RozeniteAppConfig.hostIntegration`,
   * and `resolveIntegration` combines them. `null` deliberately means
   * "unknown" rather than defaulting to `false`: a wrong answer here is
   * indistinguishable from a right one, so callers must decide what to do
   * without it rather than inherit a guess.
   */
  getTargetIsWeb: () => boolean | null;
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

/** A detached `void sendCommand(...)` (queue flushing, fire-and-forget
 * sends) has nothing else attached to observe its rejection. Ported from
 * `session.ts`'s `markPromiseAsHandled` so a socket dying mid-send surfaces
 * as a normal, already-handled rejection instead of an
 * `unhandledrejection`. */
const markPromiseAsHandled = <T>(promise: Promise<T>): Promise<T> => {
  void promise.catch(() => undefined);
  return promise;
};

export const createDeviceConnection = (target: ParsedTarget): DeviceConnection => {
  let state: DeviceState = { status: 'connecting' };
  const stateListeners = new Set<(state: DeviceState) => void>();
  const messageListeners = new Set<(message: unknown) => void>();

  let currentTarget = target;
  let deviceName = target.deviceId;
  // Sticky across reconnects on purpose: a target does not change
  // framework mid-session, and keeping the last known one means the
  // footer's label doesn't blink away while reconnecting.
  let framework: Framework | null = null;
  // The metadata half of that answer, kept raw so the framework can be
  // recomputed when the other half (the device probe) lands — the two
  // arrive in either order.
  let applicationMetadata: { integrationName?: unknown; platform?: unknown } | null = null;

  let ws: WebSocket | null = null;
  // Reset per socket, not per execution context: a JS reload cannot turn a
  // browser target into a native one, but a recovery that re-resolves the
  // target through Metro's /json/list can land on a different page.
  let targetIsWeb: boolean | null = null;
  let epoch = 0;
  // Epoch-scoped rather than a plain boolean: a superseded loop's own
  // `finally` must not be able to clear the *current* loop's in-flight
  // marker just because it happens to settle later. See finding "A" in the
  // review this hardens against — `reconnect()` no longer force-clears
  // this, and a stray clear from an old epoch can't unblock a duplicate
  // `runConnectLoop` call for the epoch that superseded it.
  let recoveryEpoch: number | null = null;
  let bindingName: string | null = null;
  let bootstrapped = false;
  // The execution context CDP has told us is "main", if any. Only its
  // destruction means the JS VM reloaded — an unrelated (e.g. worker)
  // context tearing down must not wedge the connection in `reloading`.
  let mainExecutionContextId: number | null = null;
  let bootstrapTimer: ReturnType<typeof setTimeout> | null = null;
  let nextCommandId = 1;
  const pendingCommands = new Map<number, PendingCommand>();
  let sendQueue: unknown[] = [];

  const isCurrentEpoch = (attemptEpoch: number): boolean => attemptEpoch === epoch;

  const clearBootstrapTimer = (): void => {
    if (bootstrapTimer) {
      clearTimeout(bootstrapTimer);
      bootstrapTimer = null;
    }
  };

  // `reloading` and `connected` are the only statuses under which a queued
  // send still makes sense to keep around — `reloading` because it's
  // expected to resolve back to `connected` on the same socket (the whole
  // point of this state), and `connected` because the queue is always
  // empty by the time this fires (flushed synchronously beforehand). Every
  // other status means the previous attempt's queued messages are stale.
  const QUEUE_PRESERVING_STATUSES = new Set<DeviceState['status']>(['connected', 'reloading']);

  const setState = (nextStatus: DeviceState['status']): void => {
    if (state.status === nextStatus) {
      return;
    }
    state = { status: nextStatus };
    if (!QUEUE_PRESERVING_STATUSES.has(nextStatus)) {
      sendQueue = [];
    }
    for (const listener of stateListeners) {
      listener(state);
    }
  };

  /** Notifies state subscribers without a status change — used for a
   * display-only `deviceName` update, so `useSyncExternalStore` callers
   * relying on the same `subscribe` (see `getTarget`) pick it up. */
  const notifyStateListeners = (): void => {
    for (const listener of stateListeners) {
      listener(state);
    }
  };

  const setDeviceName = (name: string): void => {
    if (deviceName === name) {
      return;
    }
    deviceName = name;
    notifyStateListeners();
  };

  /**
   * Recomputes the framework label from every signal seen so far.
   *
   * Called from both sources — the metadata event and the device probe —
   * because either can land first and the answer combines them. Deriving
   * the label and the target's integration from one function is the point:
   * `resolveFramework` and `getTargetIsWeb` must never disagree about
   * whether the target is a browser.
   *
   * Display-only, like `setDeviceName` — same notification path, so a
   * `useSyncExternalStore` reader of `getTarget()` sees it without any
   * status change.
   */
  const refreshFramework = (): void => {
    // Gated on the metadata event, which is what #449 made the label wait
    // for. The probe alone must not publish one: it can only say
    // browser-or-not, so a Lynx target would read as "React Native" until
    // the integration name arrived and corrected it — a visible flicker in
    // place of a label that simply appears once.
    if (applicationMetadata === null) {
      return;
    }

    const next = resolveFramework({
      integrationName: applicationMetadata?.integrationName,
      platform: applicationMetadata?.platform,
      isWebTarget: targetIsWeb,
    });

    if (framework === next) {
      return;
    }
    framework = next;
    notifyStateListeners();
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
      return markPromiseAsHandled(Promise.reject(new Error('Device connection is not open.')));
    }

    const id = nextCommandId++;
    return markPromiseAsHandled(
      new Promise((resolve, reject) => {
        // A wedged JS thread on the device never answers: without this, a
        // caller awaiting the response (`waitForDispatcher` in particular)
        // hangs on `connecting` forever instead of eventually failing and
        // letting the close/retry machinery take over.
        const timeoutId = setTimeout(() => {
          if (pendingCommands.delete(id)) {
            reject(new Error(`Device connection command "${method}" timed out.`));
          }
        }, COMMAND_TIMEOUT_MS);

        pendingCommands.set(id, {
          resolve: (result) => {
            clearTimeout(timeoutId);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            reject(error);
          },
        });
        try {
          socket.send(JSON.stringify({ id, method, params }));
        } catch (error) {
          clearTimeout(timeoutId);
          pendingCommands.delete(id);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }),
    );
  };

  const sendDomainMessage = (socket: WebSocket, message: unknown): Promise<void> => {
    const serializedMessage = JSON.stringify(message);
    const escapedMessage = JSON.stringify(serializedMessage);
    return markPromiseAsHandled(
      sendCommand(socket, 'Runtime.evaluate', {
        expression: `${RUNTIME_GLOBAL}.sendMessage(${JSON.stringify('rozenite')}, ${escapedMessage})`,
      }).then(() => undefined),
    );
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
  // DISPATCHER_INIT_MAX_ATTEMPTS (20) attempts, each of which evaluates
  // once and then (if not yet found) waits — so the loop performs 19
  // evaluates and 19 waits before throwing — ported as-is rather than
  // rounded off, to keep the retry budget identical between the Node agent
  // and this app.
  const waitForDispatcher = async (socket: WebSocket, attemptEpoch: number): Promise<void> => {
    for (let attempt = 1; attempt < DISPATCHER_INIT_MAX_ATTEMPTS; attempt++) {
      if (ws !== socket || !isCurrentEpoch(attemptEpoch)) {
        throw new Error('Connection attempt superseded.');
      }

      const response = (await sendCommand(socket, 'Runtime.evaluate', {
        expression: `globalThis.${RUNTIME_GLOBAL} != undefined`,
        returnByValue: true,
      })) as CDPEvaluateResult;

      if (response.exceptionDetails) {
        throw new Error(
          'Failed to wait for React DevTools dispatcher initialization: ' +
            (response.exceptionDetails.text ?? 'unknown error'),
        );
      }

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

    if (response.exceptionDetails) {
      throw new Error(
        'Failed to get binding name for the Rozenite dispatcher: ' +
          (response.exceptionDetails.text ?? 'unknown error'),
      );
    }

    const value = response.result?.value;
    if (typeof value !== 'string' || value === '') {
      throw new Error('Rozenite dispatcher did not return a binding name.');
    }
    return value;
  };

  /**
   * Asks the device whether it is a browser, by evaluating
   * `IS_WEB_TARGET_EXPRESSION` in its own runtime.
   *
   * The device is the only party that knows this for certain, and it is one
   * Rozenite controls — so it is asked rather than inferred from React
   * Native's `ReactNativeApplication.metadataUpdated`, which is an event we
   * neither emit nor can order, and which a host can easily read before it
   * arrives.
   *
   * Never throws: the answer is advisory metadata, and a connection that
   * otherwise works must not be torn down because this one command failed.
   * A failure leaves `targetIsWeb` at `null`, which callers read as
   * "unknown".
   */
  const probeTargetIsWeb = async (socket: WebSocket): Promise<void> => {
    try {
      const response = (await sendCommand(socket, 'Runtime.evaluate', {
        expression: IS_WEB_TARGET_EXPRESSION,
        returnByValue: true,
      })) as CDPEvaluateResult;

      if (response.exceptionDetails) {
        throw new Error(response.exceptionDetails.text ?? 'unknown error');
      }

      const value = response.result?.value;
      if (typeof value !== 'boolean') {
        throw new Error(`Expected a boolean, got ${typeof value}.`);
      }

      targetIsWeb = value;
      refreshFramework();
    } catch (error) {
      console.warn('[rozenite] Could not determine whether the target is a browser.', error);
    }
  };

  // Bootstraps (or re-bootstraps, after a JS reload) the "rozenite" domain
  // on `socket`. Deliberately does not initialize "react-devtools" — that
  // domain belongs to `rozenite agent`'s React service, not to this app.
  const runBootstrap = async (socket: WebSocket, attemptEpoch: number): Promise<void> => {
    await waitForDispatcher(socket, attemptEpoch);
    // After `waitForDispatcher` only because that is what establishes the
    // device has a live execution context to evaluate in; the expression
    // itself reads plain globals and depends on nothing Rozenite installs.
    //
    // Guarded on `null` so a re-bootstrap (a JS reload on the same socket)
    // does not re-ask a question whose answer cannot have changed — while a
    // probe that previously failed still gets another attempt.
    if (targetIsWeb === null) {
      await probeTargetIsWeb(socket);
    }
    const bindingValue = await getBindingName(socket);

    if (bindingName !== bindingValue) {
      await sendCommand(socket, 'Runtime.addBinding', { name: bindingValue });
      bindingName = bindingValue;
    }

    await sendCommand(socket, 'Runtime.evaluate', {
      expression: `void ${RUNTIME_GLOBAL}.initializeDomain(${JSON.stringify('rozenite')})`,
    });
  };

  // Guards against two overlapping re-bootstraps: without it, two
  // `executionContextCreated("main")` events in quick succession would each
  // start their own `runBootstrap`, both resetting `bindingName` and both
  // issuing `Runtime.addBinding`/`initializeDomain`. `bootstrapTimer`
  // (`scheduleMainContextRecreated`) already coalesces most bursts by
  // debouncing the *call*; this also guards the async work itself in case
  // a call is already in flight when another one lands.
  let bootstrapInFlight = false;

  const handleMainContextRecreated = async (
    socket: WebSocket,
    attemptEpoch: number,
  ): Promise<void> => {
    if (ws !== socket || !isCurrentEpoch(attemptEpoch) || bootstrapInFlight) {
      return;
    }
    bootstrapInFlight = true;

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
      setState('connected');
      flushQueue();
    } catch (error) {
      if (ws !== socket || !isCurrentEpoch(attemptEpoch)) {
        return;
      }
      if (error instanceof RozeniteMissingSignal) {
        setState('rozeniteMissing');
        return;
      }
      // Any other bootstrap failure here is left for the socket's own close
      // handling to resolve — the app may still send another context event.
      console.error('[rozenite] Failed to re-bootstrap after a reload.', error);
    } finally {
      bootstrapInFlight = false;
    }
  };

  /** Debounces `handleMainContextRecreated` (500ms, mirroring
   * `session.ts`'s `scheduleBootstrap`) so a burst of `main` context
   * announcements collapses into a single re-bootstrap instead of one per
   * event. */
  const scheduleMainContextRecreated = (socket: WebSocket, attemptEpoch: number): void => {
    clearBootstrapTimer();
    bootstrapTimer = setTimeout(() => {
      bootstrapTimer = null;
      void handleMainContextRecreated(socket, attemptEpoch);
    }, BOOTSTRAP_DEBOUNCE_MS);
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

    // Sent unprompted by any device implementing the domain once it is
    // enabled (React Native does; `@rozenite/lynx-dev`'s bridge answers
    // for the Lynx apps that don't). Everything in it except the
    // framework is already known from `/json/list`, so only that is read.
    if (message.method === 'ReactNativeApplication.metadataUpdated') {
      applicationMetadata = (message.params ?? {}) as Record<string, unknown>;
      refreshFramework();
      return;
    }

    // A page can have execution contexts besides "main" (e.g. workers);
    // only the destruction of the one we've identified as main means the
    // JS VM reloaded. Reacting to any destroyed context, regardless of id,
    // would wedge the connection in `reloading` forever whenever an
    // unrelated context tears down and no matching "main" ever reappears.
    if (message.method === 'Runtime.executionContextDestroyed') {
      const destroyedId = (message.params as { executionContextId?: number } | undefined)
        ?.executionContextId;
      if (destroyedId !== undefined && destroyedId === mainExecutionContextId) {
        mainExecutionContextId = null;
        bootstrapped = false;
        setState('reloading');
      }
      return;
    }

    // CDP emits this instead of individual `executionContextDestroyed`
    // events on some reloads — session.ts keys its own re-bootstrap off of
    // this event rather than the per-context one for exactly that reason.
    // Unlike a targeted destroy, this always means main is gone too.
    if (message.method === 'Runtime.executionContextsCleared') {
      mainExecutionContextId = null;
      bootstrapped = false;
      setState('reloading');
      return;
    }

    if (message.method === 'Runtime.executionContextCreated') {
      const context = (message.params as { context?: { id?: number; name?: string } } | undefined)
        ?.context;
      if (context?.name === MAIN_EXECUTION_CONTEXT_NAME) {
        mainExecutionContextId = typeof context.id === 'number' ? context.id : null;
        scheduleMainContextRecreated(socket, attemptEpoch);
      }
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
            // ...and possibly a different page, so re-ask rather than
            // trusting the previous target's answer.
            targetIsWeb = null;
            await runBootstrap(socket, attemptEpoch);
            if (ws !== socket || !isCurrentEpoch(attemptEpoch)) {
              return;
            }
            bootstrapped = true;
            setState('connected');
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
    // Guards against a duplicate loop for *this exact epoch* only — a
    // `reconnect()` call bumping to a new epoch must still be able to
    // start its own loop immediately, even while an old one is technically
    // still unwinding. See the `recoveryEpoch` declaration above.
    if (recoveryEpoch === loopEpoch) {
      return;
    }
    recoveryEpoch = loopEpoch;
    setState('connecting');

    void (async () => {
      try {
        for (let attempt = 1; attempt <= RECOVERY_MAX_ATTEMPTS; attempt++) {
          if (!isCurrentEpoch(loopEpoch)) {
            return;
          }

          try {
            if (attempt > 1 || resolveBeforeFirstAttempt) {
              const resolved = await resolveMetroTarget(
                currentTarget.deviceId,
                currentTarget.pageId,
              );
              if (!isCurrentEpoch(loopEpoch)) {
                return;
              }
              currentTarget = {
                ...currentTarget,
                webSocketDebuggerUrl: resolved.webSocketDebuggerUrl,
              };
              setDeviceName(resolved.name);
            } else {
              // The very first attempt of the very first connection uses
              // the exact target the URL gave us (see the comment at the
              // bottom of this module) — but the footer would otherwise
              // show the raw device id for that entire first session. This
              // resolves the friendly name best-effort, in the background:
              // it never blocks or delays connecting, and a failure here
              // is silently ignored (the id just stays as the fallback).
              void resolveMetroTarget(currentTarget.deviceId, currentTarget.pageId)
                .then((resolved) => {
                  if (isCurrentEpoch(loopEpoch)) {
                    setDeviceName(resolved.name);
                  }
                })
                .catch(() => undefined);
            }

            await connectOnce(loopEpoch);
            return; // connected — state was already set inside connectOnce.
          } catch (error) {
            if (!isCurrentEpoch(loopEpoch)) {
              return;
            }
            if (error instanceof RozeniteMissingSignal) {
              setState('rozeniteMissing');
              return;
            }
            if (error instanceof MetroUnreachableError) {
              setState('metroUnreachable');
              return;
            }
            if (state.status !== 'connecting') {
              // A close handler already finalized the state for this
              // attempt (e.g. another debugger took the device).
              return;
            }
            if (attempt === RECOVERY_MAX_ATTEMPTS) {
              setState('disconnected');
              return;
            }
            await wait(RECOVERY_RETRY_DELAY_MS);
          }
        }
      } finally {
        // Only clear the marker if it's still ours — a superseded loop
        // (an older epoch, or a duplicate call for the same epoch that
        // never got past the guard above) must not clear a newer loop's
        // in-flight marker just because it happens to settle later.
        if (recoveryEpoch === loopEpoch) {
          recoveryEpoch = null;
        }
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

    // This attempt already reached a definitive, non-retryable outcome
    // (rozeniteMissing / metroUnreachable) via its own catch handler,
    // which runs as a microtask *before* this close event (a later task,
    // scheduled by that same handler's own `socket.close()`) can arrive.
    // The close here is just that decision's side effect, not new
    // information — without this check it would immediately overwrite the
    // state the person is actually meant to see with `disconnected`.
    if (state.status === 'rozeniteMissing' || state.status === 'metroUnreachable') {
      return;
    }

    if (reason.includes(DEVTOOLS_TOOK_CONNECTION_REASON)) {
      setState('disconnected');
      return;
    }

    const isRecoverable = RECOVERABLE_CLOSE_REASONS.some((candidate) => reason.includes(candidate));
    if (isRecoverable) {
      // No-op if a loop for this epoch is already running (e.g. this close
      // fired for the socket that loop itself just opened).
      runConnectLoop(closedEpoch, true);
      return;
    }

    if (state.status === 'connecting') {
      // This close happened mid-attempt, before `connectOnce` ever
      // resolved (e.g. the socket never opened, or bootstrap failed for a
      // reason other than the two handled above). Don't finalize
      // `disconnected` here — `runConnectLoop`'s own catch (driven by
      // `connectOnce`'s rejection, which this same close event causes) is
      // what applies the attempt counter and `RECOVERY_MAX_ATTEMPTS`
      // budget, exactly as it does for a `resolveMetroTarget` failure.
      // Finalizing here instead would let a single failed socket end the
      // whole connection after just one attempt.
      return;
    }

    setState('disconnected');
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
      if (sendQueue.length >= SEND_QUEUE_MAX_SIZE) {
        sendQueue.shift();
      }
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
    framework,
  });

  const reconnect = (): void => {
    epoch += 1;
    const nextEpoch = epoch;
    clearBootstrapTimer();
    if (ws) {
      const socket = ws;
      ws = null;
      socket.close();
    }
    bindingName = null;
    bootstrapped = false;
    mainExecutionContextId = null;
    // No force-clear of `recoveryEpoch` here (that was the finding "A"
    // bug): the epoch bump above already means `runConnectLoop`'s guard
    // (`recoveryEpoch === loopEpoch`) can't mistake a stale in-flight
    // marker from the *old* epoch for one blocking this new one.
    runConnectLoop(nextEpoch, true);
  };

  const close = (): void => {
    epoch += 1;
    clearBootstrapTimer();
    if (ws) {
      const socket = ws;
      ws = null;
      socket.close();
    }
    rejectAllPending();
    bootstrapped = false;
    setState('disconnected');
    // Nothing in this app calls `close()` outside of `beforeunload` (see
    // `main.tsx`) and tests, but leaving subscribers and the send queue
    // behind regardless would be a real leak if that ever changes.
    sendQueue = [];
    stateListeners.clear();
    messageListeners.clear();
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
    getTargetIsWeb: () => targetIsWeb,
    reconnect,
    close,
  };
};
