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

type PendingCommand = {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
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
  const localToolCount = services.reduce(
    (count, service) => count + service.getTools().length,
    0,
  );

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
  const artifacts = createAgentArtifacts(
    options.projectRoot,
    options.target.id,
  );
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
          new Error(
            'Plugin tools did not re-register after the agent session became ready',
          ),
        );
      }, PLUGIN_READINESS_MAX_WAIT_MS),
    };
  };

  const notePluginReadinessActivity = (): void => {
    if (!pluginReadiness) {
      return;
    }

    const registeredToolNames = new Set(
      handler
        .getRegisteredPluginTools(options.target.id)
        .map((tool) => tool.name),
    );
    if (
      Array.from(expectedPluginToolNames).every((name) =>
        registeredToolNames.has(name),
      )
    ) {
      schedulePluginReadinessQuietTimer();
    }
  };

  const isCurrentGeneration = (generation: number): boolean =>
    !stopped && generation === connectionGeneration;

  const emitCDPEvent = (
    method: string,
    params: Record<string, unknown>,
  ): void => {
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
  ): Promise<Record<string, unknown>> => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return markPromiseAsHandled(
        Promise.reject(new Error('CDP websocket is not connected')),
      );
    }

    const commandId = nextCommandId++;
    const payload = JSON.stringify({ id: commandId, method, params });
    touch();

    const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
      pendingCommands.set(commandId, { resolve, reject });
      ws!.send(payload, (error) => {
        if (!error) {
          return;
        }

        pendingCommands.delete(commandId);
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

  const sendDomainMessage = (
    domain: string,
    message: unknown,
  ): Promise<void> => {
    const serializedMessage = JSON.stringify(message);
    const escapedMessage = JSON.stringify(serializedMessage);
    return markPromiseAsHandled(
      sendCommand('Runtime.evaluate', {
        expression: `${RUNTIME_GLOBAL}.sendMessage(${JSON.stringify(domain)}, ${escapedMessage})`,
      }).then(() => undefined),
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
    if (
      options.cliVersion &&
      options.metroVersion &&
      options.cliVersion !== options.metroVersion
    ) {
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

  const waitForFuseboxDispatcherToBeInitialized = async (
    attempt = 1,
  ): Promise<void> => {
    if (attempt >= DISPATCHER_INIT_MAX_ATTEMPTS) {
      throw new Error('Failed to wait for initialization: it took too long');
    }

    const response = await evaluateRuntime(
      `globalThis.${RUNTIME_GLOBAL} != undefined`,
      true,
    );

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

  const waitForRecoveryTarget = async (
    generation: number,
  ): Promise<MetroTarget> => {
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
    bootstrapped = false;
    connectedAt = undefined;
    rejectStartReadiness(
      new Error('CDP connection closed before bootstrap completed'),
    );
    handler.disconnectDevice(options.target.id);
    for (const service of localServices) {
      service.onDisconnected();
    }
    for (const [commandId, pending] of pendingCommands.entries()) {
      pendingCommands.delete(commandId);
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
    bootstrapped = false;
    connectedAt = undefined;
    rejectStartReadiness(
      new Error('CDP connection closed before bootstrap completed'),
    );

    const previousPluginToolNames = new Set(
      handler
        .getRegisteredPluginTools(options.target.id)
        .map((tool) => tool.name),
    );
    handler.disconnectDevice(options.target.id);

    for (const service of localServices) {
      service.onDisconnected();
    }

    for (const [commandId, pending] of pendingCommands.entries()) {
      pendingCommands.delete(commandId);
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
      const message =
        'React Native DevTools took the connection — close it and retry.';
      lastError = message;
      healing = { outcome: 'blocked', message, at: Date.now() };
      void disposeServices().finally(() => {
        notifyTerminated();
      });
      return;
    }

    const recoveryReason = Array.from(RECOVERABLE_CLOSE_REASONS).find(
      (candidate) => reason.includes(candidate),
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
      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)));
        return;
      }

      pending.resolve(
        message.result &&
          typeof message.result === 'object' &&
          !Array.isArray(message.result)
          ? (message.result as Record<string, unknown>)
          : {},
      );
      return;
    }

    if (typeof message.method === 'string') {
      emitCDPEvent(
        message.method,
        (message.params as Record<string, unknown> | undefined) || {},
      );
    }

    if (
      message.method === 'Runtime.executionContextCreated' &&
      (message.params as { context?: { name?: string } } | undefined)?.context
        ?.name === MAIN_EXECUTION_CONTEXT_NAME
    ) {
      bootstrapped = false;
      scheduleBootstrap();
    }

    if (message.method === 'Runtime.executionContextsCleared') {
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
      if (
        !bindingPayload.message ||
        typeof bindingPayload.message !== 'object'
      ) {
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
        if (
          !isCurrentGeneration(generation) ||
          ws !== socket ||
          activeSocketAttempt !== attempt
        ) {
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
          reject(
            new Error('CDP websocket closed before session initialization'),
          );
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

  const callTool = async (
    toolName: string,
    args: unknown,
  ): Promise<unknown> => {
    if (status !== 'connected') {
      const recovery = recoveryPromise;
      if (
        recovery &&
        ['getTree', 'getMessages', 'listRequests'].includes(toolName)
      ) {
        await recovery;
        return await callTool(toolName, args);
      }
      throw new Error(
        `Session "${options.target.id}" is not connected to a device`,
      );
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
      if (
        [
          'stopProfiling',
          'stopRecording',
          'stopTrace',
          'stopSampling',
        ].includes(toolName)
      ) {
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
      if (
        recovery &&
        ['getTree', 'getMessages', 'listRequests'].includes(toolName)
      ) {
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
      rejectStartReadiness(
        error instanceof Error ? error : new Error(String(error)),
      );
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
    rejectStartReadiness(
      new Error('Agent session stopped before bootstrap completed'),
    );
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
