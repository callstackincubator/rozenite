import type { AgentSessionClient, TapEvent } from '@rozenite/agent-sdk';
import type { AgentTransport } from '@rozenite/agent-sdk/transport';
import {
  NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
  networkActivityTools,
  type NetworkActivityGetRealtimeConnectionDetailsResult,
  type NetworkActivityGetRequestDetailsResult,
} from '@rozenite/network-activity-plugin/sdk';
import {
  SCENARIO_HEADER,
  SCENARIO_QUERY_PARAM,
} from '../../src/app/utils/network-activity/e2e-scenario-contract';
import { collapseProgressEvents, type CapturedEvent } from './normalise';

/**
 * Two ways to see what the Network Activity plugin captured, behind one
 * interface so the tests never branch on which one is in use:
 *
 * - `tap`: the plugin's raw wire traffic through the agent session's tap
 *   stream (ADR 0002, decision 5). This is the contract the rewrite in ADR
 *   0001 has to reproduce.
 * - `agent-tools`: the plugin's own agent tools, used when the tap carries no
 *   plugin traffic in an agent session. Its snapshots follow those tools'
 *   result shapes instead.
 */

export type ObserverMode = 'tap' | 'agent-tools';
export type CaptureKind = 'http' | 'sse' | 'websocket';

export type ScenarioRun<T> = {
  scenario: string;
  kind: CaptureKind;
  invoke: () => Promise<T>;
};

export type ScenarioCapture<T> = {
  mode: ObserverMode;
  result: T;
  /** Not yet normalised; pass it through `createNormaliser`. */
  capture: unknown;
};

export interface NetworkObserver {
  readonly mode: ObserverMode | 'auto';
  run<T>(run: ScenarioRun<T>): Promise<ScenarioCapture<T>>;
  close(): Promise<void>;
}

export type ObserverTimeouts = {
  /** How long to wait for a scenario's requests to finish in the plugin. */
  captureMs: number;
  /** How long to wait for the tap stream to open. */
  tapOpenMs: number;
};

const POLL_INTERVAL_MS = 200;
/** After the last awaited event, how long to keep listening for stragglers. */
const QUIET_PERIOD_MS = 300;
const RESPONSE_BODY_TIMEOUT_MS = 5000;
const LIST_LIMIT = 100;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/** Reads the scenario header regardless of how a transport cased it. */
export const getScenarioHeader = (headers: unknown): string | undefined => {
  const wanted = SCENARIO_HEADER.toLowerCase();
  for (const [key, value] of Object.entries(asRecord(headers))) {
    if (key.toLowerCase() !== wanted) {
      continue;
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? String(value[0]) : undefined;
    }
    return value === undefined || value === null ? undefined : String(value);
  }
  return undefined;
};

export const getScenarioFromUrl = (url: unknown): string | undefined => {
  if (typeof url !== 'string') {
    return undefined;
  }
  try {
    return new URL(url).searchParams.get(SCENARIO_QUERY_PARAM) ?? undefined;
  } catch {
    return undefined;
  }
};

// ---------------------------------------------------------------------------
// Tap observer
// ---------------------------------------------------------------------------

class TapSilentError extends Error {
  constructor() {
    super('The tap stream carried no Network Activity plugin messages.');
  }
}

type TapState = {
  events: TapEvent[];
  error: Error | null;
  ended: boolean;
  listeners: Set<() => void>;
};

const TERMINAL_HTTP_EVENTS = new Set(['request-completed', 'request-failed']);

const createTapObserver = async (input: {
  transport: AgentTransport;
  sessionId: string;
  timeouts: ObserverTimeouts;
}) => {
  const { transport, sessionId, timeouts } = input;
  const state: TapState = { events: [], error: null, ended: false, listeners: new Set() };
  const notify = () => state.listeners.forEach((listener) => listener());

  let resolveOpen: () => void = () => undefined;
  let rejectOpen: (error: Error) => void = () => undefined;
  const opened = new Promise<void>((resolve, reject) => {
    resolveOpen = resolve;
    rejectOpen = reject;
  });

  const handle = transport.openSessionTap(
    sessionId,
    { pluginId: NETWORK_ACTIVITY_AGENT_PLUGIN_ID },
    {
      onOpen: () => resolveOpen(),
      onEvent: (event) => {
        // `out` events are our own injected messages echoed back.
        if (event.direction === 'in') {
          state.events.push(event);
          notify();
        }
      },
      onError: (error) => {
        state.error = error;
        rejectOpen(error);
        notify();
      },
      onEnd: () => {
        state.ended = true;
        rejectOpen(new Error('The tap stream ended before it opened.'));
        notify();
      },
    },
  );

  try {
    await withTimeout(
      opened,
      timeouts.tapOpenMs,
      `The agent tap stream did not open within ${timeouts.tapOpenMs} ms.`,
    );
  } catch (error) {
    handle.close();
    throw error;
  }

  const send = (type: string, payload: unknown) =>
    transport.sendSessionTapMessage(sessionId, {
      pluginId: NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
      type,
      payload,
    });

  // Same message the DevTools panel sends when it starts recording.
  await send('network-enable', {});

  /** Resolves once `predicate` holds; resolves `false` on timeout. */
  const waitUntil = (predicate: () => boolean, timeoutMs: number): Promise<boolean> =>
    new Promise<boolean>((resolve, reject) => {
      const check = () => {
        if (state.error) {
          cleanup();
          reject(state.error);
        } else if (predicate()) {
          cleanup();
          resolve(true);
        } else if (state.ended) {
          cleanup();
          reject(new Error('The tap stream ended (was the agent session stopped?).'));
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        state.listeners.delete(check);
      };
      state.listeners.add(check);
      check();
    });

  const correlate = (events: TapEvent[], scenario: string, kind: CaptureKind) => {
    const ids = new Set<string>();
    for (const event of events) {
      const payload = asRecord(event.payload);
      if (kind === 'websocket') {
        if (
          event.type === 'websocket-connect' &&
          getScenarioFromUrl(payload.url) === scenario &&
          typeof payload.socketId === 'string'
        ) {
          ids.add(payload.socketId);
        }
      } else if (
        event.type === 'request-sent' &&
        getScenarioHeader(asRecord(payload.request).headers) === scenario &&
        typeof payload.requestId === 'string'
      ) {
        ids.add(payload.requestId);
      }
    }
    return ids;
  };

  const idOf = (event: TapEvent): string | undefined => {
    const payload = asRecord(event.payload);
    if (typeof payload.requestId === 'string') {
      return payload.requestId;
    }
    return typeof payload.socketId === 'string' ? payload.socketId : undefined;
  };

  const hasEvent = (events: TapEvent[], id: string, types: Set<string>) =>
    events.some((event) => types.has(event.type) && idOf(event) === id);

  const isSettled = (events: TapEvent[], ids: Set<string>, kind: CaptureKind): boolean => {
    if (ids.size === 0) {
      return false;
    }
    return [...ids].every((id) => {
      if (kind === 'websocket') {
        return hasEvent(events, id, new Set(['websocket-close', 'websocket-error']));
      }
      const httpDone = hasEvent(events, id, TERMINAL_HTTP_EVENTS);
      return kind === 'sse'
        ? httpDone && hasEvent(events, id, new Set(['sse-close', 'sse-error']))
        : httpDone;
    });
  };

  return {
    mode: 'tap' as const,
    run: async <T>({ scenario, kind, invoke }: ScenarioRun<T>): Promise<ScenarioCapture<T>> => {
      const start = state.events.length;
      const since = () => state.events.slice(start);

      const result = await invoke();

      const complete = await waitUntil(
        () => isSettled(since(), correlate(since(), scenario, kind), kind),
        timeouts.captureMs,
      );

      if (!complete && state.events.length === 0) {
        throw new TapSilentError();
      }

      await sleep(QUIET_PERIOD_MS);

      const ids = correlate(since(), scenario, kind);
      const completedRequests = [...ids].filter((id) =>
        hasEvent(since(), id, new Set(['request-completed'])),
      );

      let bodiesComplete = true;
      for (const requestId of completedRequests) {
        const bodyStart = state.events.length;
        await send('get-response-body', { requestId });
        const received = await waitUntil(
          () =>
            state.events
              .slice(bodyStart)
              .some((event) => event.type === 'response-body' && idOf(event) === requestId),
          RESPONSE_BODY_TIMEOUT_MS,
        );
        bodiesComplete &&= received;
      }

      const events: CapturedEvent[] = since()
        .filter((event) => {
          const id = idOf(event);
          return id !== undefined && ids.has(id);
        })
        .map((event) => ({ type: event.type, payload: event.payload }));

      return {
        mode: 'tap',
        result,
        capture: {
          complete: complete && bodiesComplete,
          events: collapseProgressEvents(events),
        },
      };
    },
    close: async () => {
      handle.close();
    },
  };
};

// ---------------------------------------------------------------------------
// Agent tools observer (fallback)
// ---------------------------------------------------------------------------

type RequestDetails = NetworkActivityGetRequestDetailsResult['request'];
type RealtimeDetails = NetworkActivityGetRealtimeConnectionDetailsResult['connection'];

const createAgentToolsObserver = async (input: {
  session: AgentSessionClient;
  timeouts: ObserverTimeouts;
}) => {
  const { session, timeouts } = input;
  const call = session.tools.call;

  // Clears the plugin's buffer and starts capturing.
  await call(networkActivityTools.startRecording);

  const isRequestDone = (request: RequestDetails) =>
    request.loadingFinished || request.loadingFailed;
  const isRealtimeDone = (connection: RealtimeDetails) =>
    connection.status === 'closed' || connection.status === 'error';

  const findRequests = async (scenario: string, cache: Map<string, RequestDetails>) => {
    const listing = await call(networkActivityTools.listRequests, { limit: LIST_LIMIT });
    const matches: RequestDetails[] = [];
    // Listings are newest first; keep capture order.
    for (const item of [...listing.items].reverse()) {
      const cached = cache.get(item.requestId);
      const details =
        cached && isRequestDone(cached)
          ? cached
          : (await call(networkActivityTools.getRequestDetails, { requestId: item.requestId }))
              .request;
      cache.set(item.requestId, details);
      if (getScenarioHeader(details.request.headers) === scenario) {
        matches.push(details);
      }
    }
    return matches;
  };

  const findRealtime = async (
    scenario: string,
    kind: CaptureKind,
    requestIds: Set<string>,
  ): Promise<RealtimeDetails[]> => {
    const listing = await call(networkActivityTools.listRealtimeConnections, {
      limit: LIST_LIMIT,
    });
    const matches: RealtimeDetails[] = [];
    for (const item of [...listing.items].reverse()) {
      const relevant =
        kind === 'websocket'
          ? item.kind === 'websocket' && getScenarioFromUrl(item.url) === scenario
          : item.kind === 'sse' && requestIds.has(item.requestId);
      if (relevant) {
        matches.push(
          (
            await call(networkActivityTools.getRealtimeConnectionDetails, {
              requestId: item.requestId,
            })
          ).connection,
        );
      }
    }
    return matches;
  };

  return {
    run: async <T>({ scenario, kind, invoke }: ScenarioRun<T>): Promise<ScenarioCapture<T>> => {
      const result = await invoke();
      const cache = new Map<string, RequestDetails>();
      const deadline = Date.now() + timeouts.captureMs;

      let requests: RequestDetails[] = [];
      let realtime: RealtimeDetails[] = [];
      let complete = false;

      while (Date.now() < deadline) {
        requests = kind === 'websocket' ? [] : await findRequests(scenario, cache);
        realtime =
          kind === 'http'
            ? []
            : await findRealtime(scenario, kind, new Set(requests.map((r) => r.requestId)));

        const httpDone =
          kind === 'websocket' || (requests.length > 0 && requests.every(isRequestDone));
        const realtimeDone =
          kind === 'http' || (realtime.length > 0 && realtime.every(isRealtimeDone));
        if (httpDone && realtimeDone) {
          complete = true;
          break;
        }
        await sleep(POLL_INTERVAL_MS);
      }

      await sleep(QUIET_PERIOD_MS);

      const capturedRequests = [];
      for (const details of requests) {
        const requestId = details.requestId;
        const fresh = (await call(networkActivityTools.getRequestDetails, { requestId })).request;
        capturedRequests.push({
          request: fresh,
          requestBody: await call(networkActivityTools.getRequestBody, { requestId }),
          responseBody: fresh.loadingFinished
            ? await call(networkActivityTools.getResponseBody, { requestId })
            : null,
        });
      }

      if (kind !== 'http') {
        realtime = await findRealtime(
          scenario,
          kind,
          new Set(requests.map((request) => request.requestId)),
        );
      }

      return {
        mode: 'agent-tools',
        result,
        capture: { complete, requests: capturedRequests, realtime },
      };
    },
    close: async () => {
      try {
        await call(networkActivityTools.stopRecording);
      } catch {
        // Already stopped or the session is gone; nothing to clean up.
      }
    },
  };
};

// ---------------------------------------------------------------------------
// Auto-selecting observer
// ---------------------------------------------------------------------------

export type CreateObserverInput = {
  transport: AgentTransport;
  session: AgentSessionClient;
  /** `auto` tries the tap first and falls back to the agent tools. */
  preferred: ObserverMode | 'auto';
  timeouts: ObserverTimeouts;
  log?: (message: string) => void;
};

export const createNetworkObserver = async (
  input: CreateObserverInput,
): Promise<NetworkObserver> => {
  const { transport, session, preferred, timeouts } = input;
  const log = input.log ?? (() => undefined);

  if (preferred === 'agent-tools') {
    const tools = await createAgentToolsObserver({ session, timeouts });
    return { mode: 'agent-tools', run: tools.run, close: tools.close };
  }

  let active: {
    mode: ObserverMode;
    run: <T>(run: ScenarioRun<T>) => Promise<ScenarioCapture<T>>;
    close: () => Promise<void>;
  } = await createTapObserver({ transport, sessionId: session.id, timeouts });
  let decided = preferred === 'tap';
  const observer: NetworkObserver = {
    get mode() {
      return decided ? active.mode : 'auto';
    },
    run: async <T>(run: ScenarioRun<T>): Promise<ScenarioCapture<T>> => {
      if (decided) {
        return active.run(run);
      }

      try {
        const captured = await active.run(run);
        decided = true;
        log('Network Activity e2e: observing plugin traffic through the agent tap stream.');
        return captured;
      } catch (error) {
        if (!(error instanceof TapSilentError)) {
          throw error;
        }
        log(
          'Network Activity e2e: the tap carried no plugin traffic; falling back to the plugin agent tools and re-running the scenario.',
        );
        await active.close();
        active = {
          mode: 'agent-tools',
          ...(await createAgentToolsObserver({ session, timeouts })),
        };
        decided = true;
        return active.run(run);
      }
    },
    close: () => active.close(),
  };

  return observer;
};
