import WebSocket from 'ws';
import { AGENT_PLUGIN_ID } from '@rozenite/agent-shared';
import type {
  AgentSessionInfo,
  AgentSessionReadyMessage,
  AgentSessionStatus,
  MetroTarget,
} from '@rozenite/agent-shared';
import { createAgentArtifacts } from './artifacts.js';
import { createAgentMessageHandler } from './runtime/handler.js';
import { extractConsoleMessage } from './runtime/console/extract.js';
import { parseRozeniteBindingPayload } from './runtime/bindings.js';
import type { DevToolsPluginMessage } from './runtime/types.js';
import {
  createMemoryDomainService,
  createNetworkDomainService,
  createPerformanceDomainService,
  createReactDomainService,
  type LocalAgentToolService,
} from './local-domains.js';
import { logger } from '../logger.js';

type AgentMessageHandler = ReturnType<typeof createAgentMessageHandler>;

const RUNTIME_GLOBAL = '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__';
const MAIN_EXECUTION_CONTEXT_NAME = 'main';
const BOOTSTRAP_DELAY_MS = 500;
const DISPATCHER_INIT_MAX_ATTEMPTS = 20;
const DISPATCHER_INIT_RETRY_MS = 250;
const PLUGIN_READINESS_QUIET_WINDOW_MS = 50;
const PLUGIN_READINESS_MAX_WAIT_MS = 250;
const RECOVERY_RETRY_DELAY_MS = 500;
const RECOVERY_MAX_ATTEMPTS = 16;
// A malformed outgoing frame (e.g. one containing an unpaired UTF-16 surrogate,
// see `sanitizeUnpairedSurrogates`) can come back from the device with `"id": null`,
// which cannot be correlated to the pending command that caused it. Without a
// timeout, that command's entry in `pendingCommands` would never resolve.
const COMMAND_TIMEOUT_MS = 10_000;

const RECOVERABLE_CLOSE_REASONS = new Set([
  '[RECREATING_DEVICE]',
  '[PAGE_NOT_FOUND]',
  '[CONNECTION_LOST]',
]);
const DEVTOOLS_TOOK_CONNECTION_REASON = '[NEW_DEBUGGER_OPENED]';

const getCloseReason = (reason: unknown): string =>
  Buffer.isBuffer(reason) ? reason.toString() : String(reason ?? '');

const getDebuggerWebSocketOrigin = (webSocketDebuggerUrl: string): string => {
  const url = new URL(webSocketDebuggerUrl);
  const protocol = url.protocol === 'wss:' ? 'https:' : 'http:';

  return `${protocol}//${url.host}`;
};

// Matches a `\uXXXX` escape sequence for either half of a surrogate pair
// (D800-DFFF), capturing a *pair* of such escapes (high immediately followed
// by low) before falling back to matching a single one.
const SURROGATE_ESCAPE_SEQUENCE =
  /\\u[dD][89a-fA-F][0-9a-fA-F]{2}\\u[dD][c-fC-F][0-9a-fA-F]{2}|\\u[dD][89a-fA-F][0-9a-fA-F]{2}/g;

// Replaces an unpaired UTF-16 surrogate half with U+FFFD.
//
// Verified against a real device: modern `JSON.stringify` (ES2019+
// "well-formed" `JSON.stringify`) never emits a lone surrogate as a raw code
// unit -- it always escapes it to a literal six-character `\uXXXX` sequence,
// so a real lone surrogate in `message` is already gone as a raw code unit by
// the time `JSON.stringify(message)` returns. The device's own JSON parser is
// stricter than the JSON grammar and rejects that escape sequence outright
// (`"json parse error ... expected another unicode escape for second half of
// surrogate pair"`), which comes back as an error response with `"id": null"`
// -- uncorrelatable to the request that caused it. This function operates on
// the *already-stringified* text, replacing an unpaired `\uXXXX` escape
// sequence (not a raw code unit -- there won't be one).
//
// A raw surrogate *pair* (e.g. ordinary emoji) is not affected by any of
// this: `JSON.stringify` does not escape it at all, so it survives as two
// ordinary UTF-16 code units in the string and this function never matches
// it. U+2028/U+2029 are likewise untouched (not surrogates, and
// `JSON.stringify` does not escape them either).
export const sanitizeUnpairedSurrogates = (jsonText: string): string => {
  let mutated = false;

  const sanitized = jsonText.replace(SURROGATE_ESCAPE_SEQUENCE, (match) => {
    if (match.length === 12) {
      // A high escape immediately followed by a low escape -- a valid pair.
      return match;
    }

    mutated = true;
    return '\uFFFD';
  });

  return mutated ? sanitized : jsonText;
};

type PendingCommand = {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout | null;
};

type StartReadiness = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};

type PluginReadiness = {
  quietTimer: NodeJS.Timeout | null;
  timeoutTimer: NodeJS.Timeout | null;
};

type CDPEvaluateResponse = {
  result?: {
    value?: unknown;
  };
  exceptionDetails?: {
    text?: string;
  };
};

export type AgentSession = ReturnType<typeof createAgentSession>;

const markPromiseAsHandled = <T>(promise: Promise<T>): Promise<T> => {
  void promise.catch(() => undefined);
  return promise;
};

const getToolCount = (
  target: MetroTarget,
  handler: AgentMessageHandler,
  services: LocalAgentToolService[],
): number => {
  const localToolCount = services.reduce((count, service) => count + service.getTools().length, 0);

  return handler.getTools(target.id).length + localToolCount;
};

export const createAgentSession = (options: {
  projectRoot: string;
  host: string;
  port: number;
  target: MetroTarget;
  resolveTarget?: (deviceId: string) => Promise<MetroTarget>;
  cliVersion?: string;
  metroVersion?: string;
  onTerminated?: (sessionId: string) => void;
}) => {
  let target = options.target;
  const handler = createAgentMessageHandler();
  const artifacts = createAgentArtifacts(options.projectRoot, options.target.id);
  const createdAt = Date.now();

  let lastActivityAt = createdAt;
  let connectedAt: number | undefined;
  let lastError: string | undefined;
  let status: AgentSessionStatus = 'connecting';
  let ws: WebSocket | null = null;
  let stopped = false;
  let nextCommandId = 1;
  let bootstrapTimer: NodeJS.Timeout | null = null;
  let bindingName: string | null = null;
  let mainExecutionContextId: number | null = null;
  let bootstrapped = false;
  let terminationNotified = false;
  let disconnectLogged = false;
  let startReadiness: StartReadiness | null = null;
  let pluginReadiness: PluginReadiness | null = null;
  let recoveryPromise: Promise<void> | null = null;
  let connectionGeneration = 0;
  let socketAttempt = 0;
  let activeSocketAttempt = 0;
  let expectedPluginToolNames = new Set<string>();
  let pluginReadinessSatisfied = false;
  let healing: AgentSessionInfo['healing'];
  const activeAccumulatedDomains = new Map<string, string>();
  const lostAccumulatedDomains = new Map<string, string>();

  const pendingCommands = new Map<number, PendingCommand>();
  const cdpEventListeners = new Map<
    string,
    Set<(params: Record<string, unknown>) => void | Promise<void>>
  >();

  const notifyTerminated = (): void => {
    if (terminationNotified) {
      return;
    }
    terminationNotified = true;
    options.onTerminated?.(options.target.id);
  };

  const getSessionInfoFields = () => ({
    sessionId: options.target.id,
    pageId: target.pageId,
    deviceId: options.target.id,
  });

  const subscribeToCDPEvent = (
    method: string,
    listener: (params: Record<string, unknown>) => void | Promise<void>,
  ): (() => void) => {
    const listeners = cdpEventListeners.get(method) || new Set();
    listeners.add(listener);
    cdpEventListeners.set(method, listeners);

    return () => {
      const current = cdpEventListeners.get(method);
      if (!current) {
        return;
      }

      current.delete(listener);
      if (current.size === 0) {
        cdpEventListeners.delete(method);
      }
    };
  };

  const touch = (): void => {
    lastActivityAt = Date.now();
  };

  const clearPluginReadiness = (): void => {
    if (!pluginReadiness) {
      return;
    }

    if (pluginReadiness.quietTimer) {
      clearTimeout(pluginReadiness.quietTimer);
    }

    if (pluginReadiness.timeoutTimer) {
      clearTimeout(pluginReadiness.timeoutTimer);
    }

    pluginReadiness = null;
  };

  const createStartReadiness = (): Promise<void> => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((resolvePromise, rejectPromise) => {
      resolve = () => {
        clearPluginReadiness();
        startReadiness = null;
        resolvePromise();
      };
      reject = (error: Error) => {
        clearPluginReadiness();
        startReadiness = null;
        rejectPromise(error);
      };
    });

    startReadiness = {
      promise,
      resolve,
      reject,
    };

    return promise;
  };

  const resolveStartReadiness = (): void => {
    if (!stopped && bootstrapped) {
      status = 'connected';
    }
    startReadiness?.resolve();
  };

  const rejectStartReadiness = (error: Error): void => {
    startReadiness?.reject(error);
  };

  const schedulePluginReadinessQuietTimer = (): void => {
    if (!pluginReadiness) {
      return;
    }

    if (pluginReadiness.quietTimer) {
      clearTimeout(pluginReadiness.quietTimer);
    }

    pluginReadiness.quietTimer = setTimeout(() => {
      pluginReadinessSatisfied = true;
      if (bootstrapped) {
        resolveStartReadiness();
      }
    }, PLUGIN_READINESS_QUIET_WINDOW_MS);
  };

  const beginPluginReadinessWait = (): void => {
    if (!startReadiness) {
      return;
    }

    clearPluginReadiness();
    pluginReadinessSatisfied = false;
    if (expectedPluginToolNames.size === 0) {
      pluginReadinessSatisfied = true;
      return;
    }
    pluginReadiness = {
      quietTimer: null,
      timeoutTimer: setTimeout(() => {
        rejectStartReadiness(
          new Error('Plugin tools did not re-register after the agent session became ready'),
        );
      }, PLUGIN_READINESS_MAX_WAIT_MS),
    };
  };

  const notePluginReadinessActivity = (): void => {
    if (!pluginReadiness) {
      return;
    }

    const registeredToolNames = new Set(
      handler.getRegisteredPluginTools(options.target.id).map((tool) => tool.name),
    );
    if (Array.from(expectedPluginToolNames).every((name) => registeredToolNames.has(name))) {
      schedulePluginReadinessQuietTimer();
    }
  };

  const isCurrentGeneration = (generation: number): boolean =>
    !stopped && generation === connectionGeneration;

  const emitCDPEvent = (method: string, params: Record<string, unknown>): void => {
    const listeners = cdpEventListeners.get(method);
    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      void listener(params);
    }
  };

  const sendCommand = (
    method: string,
    params?: Record<string, unknown>,
    options?: { timeoutMs?: number },
  ): Promise<Record<string, unknown>> => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return markPromiseAsHandled(Promise.reject(new Error('CDP websocket is not connected')));
    }

    const commandId = nextCommandId++;
    const payload = JSON.stringify({ id: commandId, method, params });
    touch();

    const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
      // A malformed outgoing frame can come back as an error keyed by `"id":
      // null` (see `sanitizeUnpairedSurrogates`), which `handleSocketMessage`
      // cannot match back to this command. Without a timeout, such a command
      // would stay pending forever. This is opt-in (via `options.timeoutMs`)
      // rather than applied to every command: some CDP commands (e.g.
      // `HeapProfiler.takeHeapSnapshot`, `Network.getResponseBody` for large
      // bodies) are legitimately long-running and must not be cut off.
      let timeout: NodeJS.Timeout | null = null;
      if (options?.timeoutMs !== undefined) {
        timeout = setTimeout(() => {
          if (pendingCommands.delete(commandId)) {
            reject(new Error(`CDP command "${method}" timed out after ${options.timeoutMs}ms`));
          }
        }, options.timeoutMs);
        timeout.unref?.();
      }

      pendingCommands.set(commandId, { resolve, reject, timeout });
      ws!.send(payload, (error) => {
        if (!error) {
          return;
        }

        const pending = pendingCommands.get(commandId);
        if (pending) {
          if (pending.timeout) {
            clearTimeout(pending.timeout);
          }
          pendingCommands.delete(commandId);
        }
        reject(error);
      });
    });

    // The pending command map owns the promise lifecycle. Attach a rejection
    // handler immediately so detached callers cannot surface socket teardown as
    // a process-level unhandled rejection.
    return markPromiseAsHandled(promise);
  };

  const localServices: LocalAgentToolService[] = [
    createReactDomainService({
      sessionId: options.target.id,
      sendReactDevToolsMessage: (message) => {
        void sendDomainMessage('react-devtools', message);
      },
    }),
    createPerformanceDomainService({
      getSessionInfo: getSessionInfoFields,
      sendCommand,
      subscribeToCDPEvent,
      createArtifactWriter: artifacts.createWriter,
    }),
    createMemoryDomainService({
      getSessionInfo: getSessionInfoFields,
      sendCommand,
      subscribeToCDPEvent,
      createArtifactWriter: artifacts.createWriter,
    }),
    createNetworkDomainService({
      getSessionInfo: getSessionInfoFields,
      sendCommand,
      subscribeToCDPEvent,
    }),
  ];

  const clearBootstrapTimer = (): void => {
    if (!bootstrapTimer) {
      return;
    }

    clearTimeout(bootstrapTimer);
    bootstrapTimer = null;
  };

  const scheduleBootstrap = (): void => {
    clearBootstrapTimer();
    bootstrapTimer = setTimeout(() => {
      void bootstrap();
    }, BOOTSTRAP_DELAY_MS);
  };

  const sendDomainMessage = (domain: string, message: unknown): Promise<void> => {
    // `Runtime.evaluate` requires interpolating the payload into a JS source string
    // that Hermes has to recompile. A single stringify + string-literal interpolation
    // is not reversible for arbitrary strings -- it silently drops messages
    // containing astral-plane characters, since Hermes' source parser can't accept a
    // lone UTF-16 surrogate half in source text. `Runtime.callFunctionOn` with a
    // by-value argument instead ships the string through CDP's own (correct) value
    // serialization, so it round-trips byte-for-byte.
    const serializedMessage = sanitizeUnpairedSurrogates(JSON.stringify(message));

    // Scoped to this send path, not every CDP command (see `sendCommand`'s own
    // comment): a malformed frame can come back uncorrelatably as `"id": null"`,
    // which only this path is at risk of after `sanitizeUnpairedSurrogates`.
    const commandPromise =
      mainExecutionContextId !== null
        ? sendCommand(
            'Runtime.callFunctionOn',
            {
              executionContextId: mainExecutionContextId,
              functionDeclaration: `function(m) { ${RUNTIME_GLOBAL}.sendMessage(${JSON.stringify(
                domain,
              )}, m) }`,
              arguments: [{ value: serializedMessage }],
            },
            { timeoutMs: COMMAND_TIMEOUT_MS },
          )
        : // No main execution context captured yet (e.g. sent before the first
          // `Runtime.executionContextCreated` event arrived). Fall back to the
          // legacy path rather than dropping the message outright; this is a rare
          // startup race, not the steady-state path.
          sendCommand(
            'Runtime.evaluate',
            {
              expression: `${RUNTIME_GLOBAL}.sendMessage(${JSON.stringify(domain)}, ${JSON.stringify(
                serializedMessage,
              )})`,
            },
            { timeoutMs: COMMAND_TIMEOUT_MS },
          );

    // We deliberately do not block the *caller* on the round trip -- CDP requests
    // are ordered and execute in order on the device's JS thread, so message
    // ordering is preserved regardless of whether anyone awaits this promise.
    // Fire-and-forget call sites (`void sendDomainMessage(...)`) therefore pay no
    // latency cost. But this function still returns the real promise chain (rather
    // than an already-resolved one) so that the one call site that legitimately
    // needs to know about failure -- `sendAgentSessionReady`, awaited from
    // `bootstrap()` so a failed send retries the whole bootstrap sequence -- keeps
    // working. `markPromiseAsHandled` prevents that same rejection from surfacing
    // as an unhandled rejection for the `void`-calling sites.
    const reported = commandPromise.then((response) => {
      const exceptionText = (response as CDPEvaluateResponse).exceptionDetails?.text;
      if (exceptionText) {
        // Logged uniformly with the protocol-rejection case below, rather than
        // here, so there is exactly one log line per failed send.
        throw new Error(exceptionText);
      }
    });

    return markPromiseAsHandled(
      reported.catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        // A send racing an intentional teardown (reload, recovery, session stop)
        // is expected operational churn, not an actionable failure -- downgrade it
        // so it doesn't read as a real fault. Everything else (a stale execution
        // context, a malformed-frame timeout, an actual runtime exception surfaced
        // above) is logged at error level.
        if (
          message.includes('CDP connection closed') ||
          message.includes('CDP websocket is not connected')
        ) {
          logger.warn(`Failed to send message to domain "${domain}": ${message}`);
        } else {
          logger.error(`Failed to send message to domain "${domain}": ${message}`);
        }
        throw error;
      }),
    );
  };

  const sendAgentSessionReady = async (): Promise<void> => {
    const message: AgentSessionReadyMessage = {
      type: 'agent-session-ready',
      payload: {
        sessionId: options.target.id,
      },
    };

    await sendDomainMessage('rozenite', {
      pluginId: AGENT_PLUGIN_ID,
      type: message.type,
      payload: message.payload,
    });
  };

  const logConnected = (): void => {
    logger.info(
      `Rozenite for Agents connected to device ${options.target.name} (${options.target.id}).`,
    );
    if (options.cliVersion && options.metroVersion && options.cliVersion !== options.metroVersion) {
      logger.warn(
        `Connected Rozenite agent uses version ${options.cliVersion}, but Metro is running version ${options.metroVersion}. Integration may not work correctly.`,
      );
    }
    disconnectLogged = false;
  };

  const logDisconnected = (): void => {
    if (disconnectLogged || connectedAt === undefined) {
      return;
    }

    logger.info(
      `Rozenite for Agents disconnected from device ${options.target.name} (${options.target.id}).`,
    );
    disconnectLogged = true;
  };

  const evaluateRuntime = async (
    expression: string,
    returnByValue = false,
  ): Promise<CDPEvaluateResponse> => {
    return await sendCommand('Runtime.evaluate', {
      expression,
      ...(returnByValue ? { returnByValue } : {}),
    });
  };

  const waitForFuseboxDispatcherToBeInitialized = async (attempt = 1): Promise<void> => {
    if (attempt >= DISPATCHER_INIT_MAX_ATTEMPTS) {
      throw new Error('Failed to wait for initialization: it took too long');
    }

    const response = await evaluateRuntime(`globalThis.${RUNTIME_GLOBAL} != undefined`, true);

    if (response.exceptionDetails) {
      throw new Error(
        'Failed to wait for React DevTools dispatcher initialization: ' +
          response.exceptionDetails.text,
      );
    }

    if (response.result?.value === false) {
      await new Promise((resolve) => {
        setTimeout(resolve, DISPATCHER_INIT_RETRY_MS);
      });
      return waitForFuseboxDispatcherToBeInitialized(attempt + 1);
    }
  };

  const getBindingName = async (): Promise<string> => {
    const response = await evaluateRuntime(`${RUNTIME_GLOBAL}.BINDING_NAME`);

    if (response.exceptionDetails) {
      throw new Error(
        'Failed to get binding name for Agent session on a global: ' +
          response.exceptionDetails.text,
      );
    }

    const bindingValue = response.result?.value;
    if (bindingValue === null || bindingValue === undefined) {
      throw new Error(
        'Failed to get binding name for Agent session on a global: returned value is ' +
          String(bindingValue),
      );
    }

    if (bindingValue === '') {
      throw new Error(
        'Failed to get binding name for ReactDevToolsBindingsModel on a global: returned value is an empty string',
      );
    }

    if (typeof bindingValue !== 'string') {
      throw new Error(
        'Failed to get binding name for Agent session on a global: returned value is not a string',
      );
    }

    return bindingValue;
  };

  const bootstrap = async (): Promise<void> => {
    if (stopped || !ws || ws.readyState !== WebSocket.OPEN || bootstrapped) {
      return;
    }

    try {
      await waitForFuseboxDispatcherToBeInitialized();
      const bindingValue = await getBindingName();

      if (bindingName !== bindingValue) {
        await sendCommand('Runtime.addBinding', { name: bindingValue });
        bindingName = bindingValue;
      }

      await sendCommand('Runtime.evaluate', {
        expression: `void ${RUNTIME_GLOBAL}.initializeDomain("rozenite")`,
      });
      // Arm before notifying the plugin: registration may be synchronous.
      beginPluginReadinessWait();
      await sendAgentSessionReady();
      await sendCommand('Runtime.evaluate', {
        expression: `void ${RUNTIME_GLOBAL}.initializeDomain("react-devtools")`,
      });

      bootstrapped = true;
      if (pluginReadinessSatisfied) {
        resolveStartReadiness();
      }

      lastError = undefined;
      touch();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      scheduleBootstrap();
    }
  };

  const disposeServices = async (): Promise<void> => {
    await Promise.all(localServices.map((service) => service.dispose()));
  };

  const rememberLostAccumulatedState = (): void => {
    for (const [toolName, domain] of activeAccumulatedDomains) {
      lostAccumulatedDomains.set(toolName, domain);
    }
    activeAccumulatedDomains.clear();
  };

  const waitForRecoveryTarget = async (generation: number): Promise<MetroTarget> => {
    if (!options.resolveTarget) {
      throw new Error('This session cannot resolve a fresh Metro target');
    }

    let lastRecoveryError: unknown;
    for (let attempt = 1; attempt <= RECOVERY_MAX_ATTEMPTS; attempt += 1) {
      if (!isCurrentGeneration(generation)) {
        throw new Error('Agent session recovery was cancelled');
      }
      try {
        const resolvedTarget = await options.resolveTarget(options.target.id);
        if (!isCurrentGeneration(generation)) {
          throw new Error('Agent session recovery was cancelled');
        }
        return resolvedTarget;
      } catch (error) {
        lastRecoveryError = error;
        if (attempt < RECOVERY_MAX_ATTEMPTS) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, RECOVERY_RETRY_DELAY_MS);
          });
        }
      }
    }

    throw lastRecoveryError instanceof Error
      ? lastRecoveryError
      : new Error('The app did not reconnect to Metro');
  };

  const teardownConnection = (): void => {
    bindingName = null;
    mainExecutionContextId = null;
    bootstrapped = false;
    connectedAt = undefined;
    rejectStartReadiness(new Error('CDP connection closed before bootstrap completed'));
    handler.disconnectDevice(options.target.id);
    for (const service of localServices) {
      service.onDisconnected();
    }
    for (const [commandId, pending] of pendingCommands.entries()) {
      pendingCommands.delete(commandId);
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(new Error('CDP connection closed'));
    }
    clearBootstrapTimer();
    clearPluginReadiness();
  };

  const recover = async (reason: string, generation: number): Promise<void> => {
    status = 'connecting';
    try {
      // Metro can still be publishing the replacement page when it first
      // closes the old debugger socket. Retry one fresh connection after the
      // target-resolution backoff above instead of treating that race as a
      // terminal session failure.
      let connected = false;
      let lastConnectError: unknown;
      for (let attempt = 1; attempt <= 2 && !connected; attempt += 1) {
        try {
          target = await waitForRecoveryTarget(generation);
          const readinessPromise = createStartReadiness();
          void readinessPromise.catch(() => undefined);
          await connect(generation);
          await readinessPromise;
          if (!isCurrentGeneration(generation)) {
            throw new Error('Agent session recovery was cancelled');
          }
          connected = true;
        } catch (error) {
          lastConnectError = error;
          if (!isCurrentGeneration(generation)) {
            return;
          }
          const failedSocket = ws;
          if (failedSocket && failedSocket.readyState !== WebSocket.CLOSED) {
            teardownConnection();
            activeSocketAttempt += 1;
            ws = null;
            await new Promise<void>((resolve) => {
              const timeout = setTimeout(resolve, 250);
              failedSocket.once('close', () => {
                clearTimeout(timeout);
                resolve();
              });
              failedSocket.close();
            });
          }
          if (attempt === 2) {
            throw error;
          }
          await new Promise<void>((resolve) => {
            setTimeout(resolve, RECOVERY_RETRY_DELAY_MS);
          });
        }
      }
      if (!connected) {
        throw lastConnectError;
      }
      if (!isCurrentGeneration(generation)) {
        return;
      }
      healing = {
        outcome: 'recovered',
        message:
          lostAccumulatedDomains.size > 0
            ? `Reconnected after ${reason}. Accumulated state was lost for: ${Array.from(lostAccumulatedDomains.values()).join(', ')}.`
            : `Reconnected after ${reason}.`,
        at: Date.now(),
      };
    } catch (error) {
      if (!isCurrentGeneration(generation)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      lastError = message;
      healing = { outcome: 'failed', message, at: Date.now() };
      status = 'stopped';
      stopped = true;
      await disposeServices();
      notifyTerminated();
    } finally {
      if (generation === connectionGeneration) {
        recoveryPromise = null;
      }
    }
  };

  const handleSocketClosed = (reason: string, generation: number): void => {
    if (generation !== connectionGeneration) {
      return;
    }
    logDisconnected();
    bindingName = null;
    mainExecutionContextId = null;
    bootstrapped = false;
    connectedAt = undefined;
    rejectStartReadiness(new Error('CDP connection closed before bootstrap completed'));

    const previousPluginToolNames = new Set(
      handler.getRegisteredPluginTools(options.target.id).map((tool) => tool.name),
    );
    handler.disconnectDevice(options.target.id);

    for (const service of localServices) {
      service.onDisconnected();
    }

    for (const [commandId, pending] of pendingCommands.entries()) {
      pendingCommands.delete(commandId);
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(new Error('CDP connection closed'));
    }

    clearBootstrapTimer();
    clearPluginReadiness();
    if (stopped) {
      status = 'stopped';
      notifyTerminated();
      return;
    }

    if (reason.includes(DEVTOOLS_TOOK_CONNECTION_REASON)) {
      status = 'stopped';
      stopped = true;
      const message = 'React Native DevTools took the connection — close it and retry.';
      lastError = message;
      healing = { outcome: 'blocked', message, at: Date.now() };
      void disposeServices().finally(() => {
        notifyTerminated();
      });
      return;
    }

    const recoveryReason = Array.from(RECOVERABLE_CLOSE_REASONS).find((candidate) =>
      reason.includes(candidate),
    );
    if (recoveryReason) {
      expectedPluginToolNames = previousPluginToolNames;
      rememberLostAccumulatedState();
      recoveryPromise ??= recover(recoveryReason, generation);
      return;
    }

    status = 'stopped';
    stopped = true;
    void disposeServices().finally(() => notifyTerminated());
  };

  const handleSocketMessage = (rawMessage: string): void => {
    touch();

    let message: Record<string, unknown>;
    try {
      message = JSON.parse(rawMessage) as Record<string, unknown>;
    } catch {
      return;
    }

    if (typeof message.id === 'number') {
      const pending = pendingCommands.get(message.id);
      if (!pending) {
        return;
      }

      pendingCommands.delete(message.id);
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)));
        return;
      }

      pending.resolve(
        message.result && typeof message.result === 'object' && !Array.isArray(message.result)
          ? (message.result as Record<string, unknown>)
          : {},
      );
      return;
    }

    if (typeof message.method === 'string') {
      emitCDPEvent(message.method, (message.params as Record<string, unknown> | undefined) || {});
    }

    if (message.method === 'Runtime.executionContextCreated') {
      const context = (message.params as { context?: { name?: string; id?: number } } | undefined)
        ?.context;
      if (context?.name === MAIN_EXECUTION_CONTEXT_NAME) {
        if (typeof context.id === 'number') {
          mainExecutionContextId = context.id;
        }
        bootstrapped = false;
        scheduleBootstrap();
      }
    }

    if (message.method === 'Runtime.executionContextDestroyed') {
      const destroyedId = (message.params as { executionContextId?: number } | undefined)
        ?.executionContextId;
      if (destroyedId !== undefined && destroyedId === mainExecutionContextId) {
        mainExecutionContextId = null;
      }
    }

    if (message.method === 'Runtime.executionContextsCleared') {
      mainExecutionContextId = null;
      bootstrapped = false;
      scheduleBootstrap();
    }

    const consoleMessage = extractConsoleMessage(message);
    if (consoleMessage) {
      handler.captureConsoleMessage(options.target.id, consoleMessage);
    }

    const bindingPayload = parseRozeniteBindingPayload(message);
    if (!bindingPayload) {
      return;
    }

    logger.debug('Received Rozenite binding payload.', bindingPayload);
    if (bindingPayload.domain === 'rozenite') {
      if (!bindingPayload.message || typeof bindingPayload.message !== 'object') {
        return;
      }

      const devToolsMessage = bindingPayload.message as DevToolsPluginMessage;
      handler.handleDeviceMessage(options.target.id, devToolsMessage);
      if (devToolsMessage.type === 'register-tool') {
        notePluginReadinessActivity();
      }
    } else if (bindingPayload.domain === 'react-devtools') {
      for (const service of localServices) {
        if (service.captureReactDevToolsMessage) {
          void service.captureReactDevToolsMessage(bindingPayload.message);
        }
      }
    }
  };

  const connect = async (generation = connectionGeneration): Promise<void> => {
    status = 'connecting';

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(target.webSocketDebuggerUrl, {
        headers: {
          Origin: getDebuggerWebSocketOrigin(target.webSocketDebuggerUrl),
        },
      });
      let settled = false;
      const attempt = ++socketAttempt;
      activeSocketAttempt = attempt;
      ws = socket;

      socket.once('open', () => {
        if (!isCurrentGeneration(generation) || ws !== socket || activeSocketAttempt !== attempt) {
          socket.close();
          return;
        }
        settled = true;
        status = 'connecting';
        connectedAt = Date.now();
        lastError = undefined;
        touch();
        handler.connectDevice(options.target.id, options.target.name, {
          sendMessage: (message: unknown) => {
            void sendDomainMessage('rozenite', message);
          },
        });
        logConnected();

        void (async () => {
          try {
            await sendCommand('ReactNativeApplication.enable');
            await sendCommand('Runtime.enable');
            scheduleBootstrap();
            resolve();
          } catch (error) {
            const startupError =
              socket.readyState === WebSocket.CLOSED && !bootstrapped
                ? new Error('CDP connection closed before bootstrap completed')
                : error instanceof Error
                  ? error
                  : new Error(String(error));

            lastError = startupError.message;
            clearBootstrapTimer();
            rejectStartReadiness(startupError);
            socket.close();
            reject(startupError);
          }
        })();
      });

      socket.on('message', (rawMessage: unknown) => {
        if (
          generation !== connectionGeneration ||
          ws !== socket ||
          activeSocketAttempt !== attempt
        ) {
          return;
        }
        handleSocketMessage(String(rawMessage));
      });

      socket.once('error', (error: unknown) => {
        if (
          generation !== connectionGeneration ||
          ws !== socket ||
          activeSocketAttempt !== attempt
        ) {
          return;
        }
        lastError = error instanceof Error ? error.message : String(error);
        if (!settled) {
          reject(error);
        }
      });

      socket.once('close', (_code: unknown, reason: unknown) => {
        if (ws !== socket || activeSocketAttempt !== attempt) return;
        ws = null;
        handleSocketClosed(getCloseReason(reason), generation);
        if (!settled) {
          reject(new Error('CDP websocket closed before session initialization'));
        }
      });
    });
  };

  const getInfo = (): AgentSessionInfo => ({
    id: options.target.id,
    host: options.host,
    port: options.port,
    deviceId: options.target.id,
    deviceName: target.name,
    appId: target.appId,
    pageId: target.pageId,
    status,
    createdAt,
    lastActivityAt,
    ...(connectedAt ? { connectedAt } : {}),
    ...(lastError ? { lastError } : {}),
    ...(healing ? { healing } : {}),
    toolCount: getToolCount(target, handler, localServices),
  });

  const getTools = () => {
    return [
      ...handler.getTools(options.target.id),
      ...localServices.flatMap((service) => service.getTools()),
    ];
  };

  const callTool = async (toolName: string, args: unknown): Promise<unknown> => {
    if (status !== 'connected') {
      const recovery = recoveryPromise;
      if (recovery && ['getTree', 'getMessages', 'listRequests'].includes(toolName)) {
        await recovery;
        return await callTool(toolName, args);
      }
      throw new Error(`Session "${options.target.id}" is not connected to a device`);
    }

    const lostDomain = lostAccumulatedDomains.get(toolName);
    if (lostDomain) {
      lostAccumulatedDomains.delete(toolName);
      throw new Error(
        `AGENT_SESSION_STATE_LOST: ${lostDomain} was lost while the app relaunched. Retry this operation to collect new state.`,
      );
    }

    touch();

    const trackSuccessfulToolCall = (): void => {
      const startedBy = new Map([
        ['startProfiling', ['stopProfiling', 'profiling data']],
        ['startRecording', ['stopRecording', 'network recording']],
        ['startTrace', ['stopTrace', 'performance trace']],
        ['startSampling', ['stopSampling', 'memory sampling']],
      ]);
      const started = startedBy.get(toolName);
      if (started) {
        activeAccumulatedDomains.set(started[0], started[1]);
      }
      if (['stopProfiling', 'stopRecording', 'stopTrace', 'stopSampling'].includes(toolName)) {
        activeAccumulatedDomains.delete(toolName);
      }
    };

    try {
      for (const service of localServices) {
        const result = await service.callTool(toolName, args);
        if (result !== undefined) {
          trackSuccessfulToolCall();
          return result;
        }
      }

      const result = await handler.callTool(toolName, args);
      trackSuccessfulToolCall();
      return result;
    } catch (error) {
      const recovery = recoveryPromise;
      if (recovery && ['getTree', 'getMessages', 'listRequests'].includes(toolName)) {
        await recovery;
        return await callTool(toolName, args);
      }
      throw error;
    }
  };

  const start = async (): Promise<void> => {
    const readinessPromise = createStartReadiness();
    void readinessPromise.catch(() => undefined);

    try {
      await connect();
    } catch (error) {
      // A stale page can be rejected before the websocket ever opens. The
      // close handler has already started recovery in that case, so make the
      // initial create request observe that healing attempt instead of making
      // the manager tear the session down.
      if (recoveryPromise) {
        await recoveryPromise;
        if (status === 'connected') {
          return;
        }
      }
      rejectStartReadiness(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }

    await readinessPromise;
  };

  const stop = async (): Promise<void> => {
    if (stopped && status === 'stopped') {
      notifyTerminated();
      return;
    }

    stopped = true;
    connectionGeneration += 1;
    recoveryPromise = null;
    clearBootstrapTimer();
    clearPluginReadiness();
    rejectStartReadiness(new Error('Agent session stopped before bootstrap completed'));
    await disposeServices();
    logDisconnected();

    if (ws) {
      const socket = ws;
      ws = null;
      socket.close();
    }
    handler.disconnectDevice(options.target.id);
    status = 'stopped';
    notifyTerminated();
  };

  return {
    id: options.target.id,
    start,
    stop,
    getInfo,
    getTools,
    callTool,
    isReusable: (nextTarget: MetroTarget) =>
      status === 'connected' && target.pageId === nextTarget.pageId,
  };
};
