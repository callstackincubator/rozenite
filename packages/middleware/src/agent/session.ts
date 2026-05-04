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
  cliVersion?: string;
  metroVersion?: string;
  onTerminated?: (sessionId: string) => void;
}) => {
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
    pageId: options.target.pageId,
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
      resolveStartReadiness();
    }, PLUGIN_READINESS_QUIET_WINDOW_MS);
  };

  const beginPluginReadinessWait = (): void => {
    if (!startReadiness) {
      return;
    }

    clearPluginReadiness();
    pluginReadiness = {
      quietTimer: null,
      timeoutTimer: setTimeout(() => {
        resolveStartReadiness();
      }, PLUGIN_READINESS_MAX_WAIT_MS),
    };
    schedulePluginReadinessQuietTimer();
  };

  const notePluginReadinessActivity = (): void => {
    if (!pluginReadiness) {
      return;
    }

    schedulePluginReadinessQuietTimer();
  };

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

  const sendCommand = async (
    method: string,
    params?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('CDP websocket is not connected');
    }

    const commandId = nextCommandId++;
    const payload = JSON.stringify({ id: commandId, method, params });
    touch();

    return await new Promise((resolve, reject) => {
      pendingCommands.set(commandId, { resolve, reject });
      ws!.send(payload, (error) => {
        if (!error) {
          return;
        }

        pendingCommands.delete(commandId);
        reject(error);
      });
    });
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

  const sendDomainMessage = async (
    domain: string,
    message: unknown,
  ): Promise<void> => {
    const serializedMessage = JSON.stringify(message);
    const escapedMessage = JSON.stringify(serializedMessage);
    await sendCommand('Runtime.evaluate', {
      expression: `${RUNTIME_GLOBAL}.sendMessage(${JSON.stringify(domain)}, ${escapedMessage})`,
    });
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
      await sendAgentSessionReady();
      await sendCommand('Runtime.evaluate', {
        expression: `void ${RUNTIME_GLOBAL}.initializeDomain("react-devtools")`,
      });

      bootstrapped = true;
      lastError = undefined;
      touch();
      beginPluginReadinessWait();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      scheduleBootstrap();
    }
  };

  const disposeServices = async (): Promise<void> => {
    await Promise.all(localServices.map((service) => service.dispose()));
  };

  const handleSocketClosed = (): void => {
    logDisconnected();
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
    status = 'stopped';

    if (stopped) {
      notifyTerminated();
      return;
    }

    stopped = true;
    void disposeServices().finally(() => {
      notifyTerminated();
    });
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
      if (
        devToolsMessage.type === 'plugin-mounted' ||
        devToolsMessage.type === 'register-tool'
      ) {
        notePluginReadinessActivity();
      }

      handler.handleDeviceMessage(
        options.target.id,
        devToolsMessage,
      );
    } else if (bindingPayload.domain === 'react-devtools') {
      for (const service of localServices) {
        if (service.captureReactDevToolsMessage) {
          void service.captureReactDevToolsMessage(bindingPayload.message);
        }
      }
    }
  };

  const connect = async (): Promise<void> => {
    status = 'connecting';

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(options.target.webSocketDebuggerUrl);
      let settled = false;
      ws = socket;

      socket.once('open', () => {
        settled = true;
        status = 'connected';
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
            ws?.close();
            reject(startupError);
          }
        })();
      });

      socket.on('message', (rawMessage: unknown) => {
        handleSocketMessage(String(rawMessage));
      });

      socket.once('error', (error: unknown) => {
        lastError = error instanceof Error ? error.message : String(error);
        if (!settled) {
          reject(error);
        }
      });

      socket.once('close', () => {
        handleSocketClosed();
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
    deviceName: options.target.name,
    appId: options.target.appId,
    pageId: options.target.pageId,
    status,
    createdAt,
    lastActivityAt,
    ...(connectedAt ? { connectedAt } : {}),
    ...(lastError ? { lastError } : {}),
    toolCount: getToolCount(options.target, handler, localServices),
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
      throw new Error(
        `Session "${options.target.id}" is not connected to a device`,
      );
    }

    touch();

    for (const service of localServices) {
      const result = await service.callTool(toolName, args);
      if (result !== undefined) {
        return result;
      }
    }

    return await handler.callTool(toolName, args);
  };

  const start = async (): Promise<void> => {
    const readinessPromise = createStartReadiness();
    void readinessPromise.catch(() => undefined);

    try {
      await connect();
    } catch (error) {
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
  };
};
