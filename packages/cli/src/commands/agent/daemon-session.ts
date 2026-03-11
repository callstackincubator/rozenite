import WebSocket from 'ws';
import { agent } from '@rozenite/middleware';
import type { MetroTarget, SessionInfo, SessionStatus } from './daemon-protocol.js';
import type { DaemonLogger } from './daemon-logger.js';
import { resolveMetroTarget } from './metro-discovery.js';
import {
  createMemoryDomainService,
  createNetworkDomainService,
  createPerformanceDomainService,
  type LocalAgentToolService,
} from './local-domains.js';

const {
  createAgentMessageHandler,
  extractConsoleMessage,
  parseRozeniteBindingPayload,
} = agent;

type DevToolsPluginMessage = agent.DevToolsPluginMessage;
type AgentMessageHandler = agent.AgentMessageHandler;

const RUNTIME_GLOBAL = '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__';
const BOOTSTRAP_DELAY_MS = 500;

type PendingCommand = {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
};

export type DaemonSession = ReturnType<typeof createDaemonSession>;

const getToolCount = (
  target: MetroTarget | undefined,
  handler: AgentMessageHandler,
  services: LocalAgentToolService[],
): number => {
  if (!target) {
    return 0;
  }

  const localToolCount = services.reduce(
    (count, service) => count + service.getTools().length,
    0,
  );

  return handler.getTools(target.id).length + localToolCount;
};

export const createDaemonSession = (
  id: string,
  host: string,
  port: number,
  requestedDeviceId?: string,
  onTerminated?: (sessionId: string) => void,
  logger?: DaemonLogger,
) => {
  const handler = createAgentMessageHandler();
  const createdAt = Date.now();
  const sessionLogger = logger?.child({
    component: 'agent-session',
    sessionId: id,
    host,
    port,
    requestedDeviceId: requestedDeviceId || null,
  });

  let lastActivityAt = createdAt;
  let connectedAt: number | undefined;
  let lastError: string | undefined;
  let status: SessionStatus = 'connecting';
  let target: MetroTarget | undefined;
  let ws: WebSocket | null = null;
  let stopped = false;
  let nextCommandId = 1;
  let bootstrapTimer: NodeJS.Timeout | null = null;
  let bindingName: string | null = null;
  let bootstrapped = false;

  const pendingCommands = new Map<number, PendingCommand>();
  const cdpEventListeners = new Map<string, Set<(params: Record<string, unknown>) => void | Promise<void>>>();

  const getSessionInfoFields = () => ({
    sessionId: id,
    pageId: target?.pageId || 'unknown',
    deviceId: target?.id || requestedDeviceId || 'unknown',
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

  const emitCDPEvent = (method: string, params: Record<string, unknown>): void => {
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
      sessionLogger?.warn('Rejected CDP command because websocket is not connected', {
        method,
      });
      throw new Error('CDP websocket is not connected');
    }

    const commandId = nextCommandId++;
    const payload = JSON.stringify({ id: commandId, method, params });
    touch();

    return await new Promise((resolve, reject) => {
      pendingCommands.set(commandId, { resolve, reject });
      sessionLogger?.debug('Sending CDP command', {
        commandId,
        method,
      });
      ws!.send(payload, (error) => {
        if (!error) {
          return;
        }

        pendingCommands.delete(commandId);
        sessionLogger?.error('Failed to send CDP command', {
          commandId,
          method,
          error,
        });
        reject(error);
      });
    });
  };

  const localServices: LocalAgentToolService[] = [
    createPerformanceDomainService({
      getSessionInfo: getSessionInfoFields,
      sendCommand,
      subscribeToCDPEvent,
    }),
    createMemoryDomainService({
      getSessionInfo: getSessionInfoFields,
      sendCommand,
      subscribeToCDPEvent,
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
    sessionLogger?.debug('Scheduling runtime bootstrap', {
      delayMs: BOOTSTRAP_DELAY_MS,
    });
    bootstrapTimer = setTimeout(() => {
      void bootstrap();
    }, BOOTSTRAP_DELAY_MS);
  };

  const sendDomainMessage = async (domain: string, message: unknown): Promise<void> => {
    const serializedMessage = JSON.stringify(message);
    const escapedMessage = JSON.stringify(serializedMessage);
    await sendCommand('Runtime.evaluate', {
      expression: `${RUNTIME_GLOBAL}.sendMessage(${JSON.stringify(domain)}, ${escapedMessage})`,
    });
  };

  const bootstrap = async (): Promise<void> => {
    if (stopped || !ws || ws.readyState !== WebSocket.OPEN || bootstrapped) {
      sessionLogger?.debug('Skipped runtime bootstrap', {
        stopped,
        hasSocket: Boolean(ws),
        readyState: ws?.readyState ?? null,
        bootstrapped,
      });
      return;
    }

    try {
      sessionLogger?.info('Starting runtime bootstrap');
      const bindingResponse = await sendCommand('Runtime.evaluate', {
        expression: `typeof ${RUNTIME_GLOBAL} !== "undefined" && typeof ${RUNTIME_GLOBAL}.BINDING_NAME === "string" ? ${RUNTIME_GLOBAL}.BINDING_NAME : null`,
      });

      const bindingResult = bindingResponse.result as Record<string, unknown> | undefined;
      const bindingValue = bindingResult?.value;
      if (typeof bindingValue !== 'string' || !bindingValue) {
        throw new Error('Rozenite runtime binding is not initialized yet');
      }

      if (bindingName !== bindingValue) {
        await sendCommand('Runtime.addBinding', { name: bindingValue });
        bindingName = bindingValue;
      }

      await sendCommand('Runtime.evaluate', {
        expression: `void ${RUNTIME_GLOBAL}.initializeDomain("rozenite")`,
      });
      await sendCommand('Runtime.evaluate', {
        expression: `void ${RUNTIME_GLOBAL}.initializeDomain("react-devtools")`,
      });

      bootstrapped = true;
      lastError = undefined;
      touch();
      sessionLogger?.info('Runtime bootstrap completed', {
        bindingName,
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      sessionLogger?.warn('Runtime bootstrap failed; retrying', {
        error,
      });
      scheduleBootstrap();
    }
  };

  const handleSocketClosed = (): void => {
    sessionLogger?.warn('CDP websocket closed', {
      targetId: target?.id || null,
      pendingCommandCount: pendingCommands.size,
      wasStopped: stopped,
    });
    bindingName = null;
    bootstrapped = false;
    connectedAt = undefined;

    if (target) {
      handler.disconnectDevice(target.id);
    }

    for (const service of localServices) {
      service.onDisconnected();
    }

    for (const [commandId, pending] of pendingCommands.entries()) {
      pendingCommands.delete(commandId);
      pending.reject(new Error('CDP connection closed'));
    }

    if (stopped) {
      status = 'stopped';
      return;
    }

    stopped = true;
    clearBootstrapTimer();
    status = 'stopped';

    void Promise.all(localServices.map((service) => service.dispose())).finally(() => {
      sessionLogger?.info('Session terminated after websocket close');
      onTerminated?.(id);
    });
  };

  const handleSocketMessage = (rawMessage: string): void => {
    touch();

    let message: Record<string, unknown>;
    try {
      message = JSON.parse(rawMessage) as Record<string, unknown>;
    } catch {
      sessionLogger?.warn('Received non-JSON CDP payload');
      return;
    }

    if (typeof message.id === 'number') {
      const pending = pendingCommands.get(message.id);
      if (!pending) {
        return;
      }

      pendingCommands.delete(message.id);
      if (message.error) {
        sessionLogger?.warn('CDP command failed', {
          commandId: message.id,
          error: message.error,
        });
        pending.reject(new Error(JSON.stringify(message.error)));
        return;
      }

      sessionLogger?.debug('CDP command completed', {
        commandId: message.id,
      });
      pending.resolve(message);
      return;
    }

    if (typeof message.method === 'string') {
      emitCDPEvent(
        message.method,
        (message.params as Record<string, unknown> | undefined) || {},
      );
    }

    if (
      message.method === 'Runtime.executionContextCreated'
      || message.method === 'Runtime.executionContextsCleared'
    ) {
      bootstrapped = false;
      scheduleBootstrap();
    }

    const consoleMessage = extractConsoleMessage(message);
    if (consoleMessage && target) {
      handler.captureConsoleMessage(target.id, consoleMessage);
    }

    const bindingPayload = parseRozeniteBindingPayload(message);
    if (!bindingPayload || !target) {
      return;
    }

    if (bindingPayload.domain === 'rozenite') {
      handler.handleDeviceMessage(target.id, bindingPayload.message as DevToolsPluginMessage);
    } else if (bindingPayload.domain === 'react-devtools') {
      void handler.captureReactDevToolsMessage(target.id, bindingPayload.message);
    }
  };

  const connect = async (): Promise<void> => {
    status = 'connecting';
    sessionLogger?.info('Resolving Metro target');
    target = await resolveMetroTarget(host, port, requestedDeviceId);
    sessionLogger?.info('Resolved Metro target', {
      targetId: target.id,
      targetName: target.name,
      pageId: target.pageId,
      appId: target.appId,
      webSocketDebuggerUrl: target.webSocketDebuggerUrl,
    });

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(target!.webSocketDebuggerUrl);
      let settled = false;
      ws = socket;
      sessionLogger?.info('Opening CDP websocket', {
        webSocketDebuggerUrl: target!.webSocketDebuggerUrl,
      });

      socket.once('open', () => {
        settled = true;
        status = 'connected';
        connectedAt = Date.now();
        lastError = undefined;
        touch();
        sessionLogger?.info('CDP websocket opened', {
          connectedAt,
        });
        handler.connectDevice(
          target!.id,
          target!.name,
          {
            sendMessage: (message: unknown) => {
              void sendDomainMessage('rozenite', message);
            },
            sendReactDevToolsMessage: (message: { event: string; payload: unknown }) => {
              void sendDomainMessage('react-devtools', message);
            },
          },
        );
        void sendCommand('Runtime.enable').catch((error: Error) => {
          lastError = error.message;
          sessionLogger?.warn('Runtime.enable failed', {
            error,
          });
        });
        scheduleBootstrap();
        resolve();
      });

      socket.on('message', (rawMessage) => {
        handleSocketMessage(rawMessage.toString());
      });

      socket.once('error', (error) => {
        lastError = error.message;
        sessionLogger?.error('CDP websocket emitted error', {
          error,
          settled,
        });
        if (!settled) {
          reject(error);
        }
      });

      socket.once('close', () => {
        handleSocketClosed();
        if (!settled) {
          sessionLogger?.error('CDP websocket closed before session initialization');
          reject(new Error('CDP websocket closed before session initialization'));
        }
      });
    });
  };

  const getInfo = (): SessionInfo => ({
    id,
    host,
    port,
    deviceId: target?.id || requestedDeviceId || 'unknown',
    deviceName: target?.name || 'Unknown',
    appId: target?.appId || 'Unknown',
    pageId: target?.pageId || 'unknown',
    status,
    createdAt,
    lastActivityAt,
    ...(connectedAt ? { connectedAt } : {}),
    ...(lastError ? { lastError } : {}),
    toolCount: getToolCount(target, handler, localServices),
  });

  const getTools = () => {
    if (!target) {
      return [];
    }

    return [
      ...handler.getTools(target.id),
      ...localServices.flatMap((service) => service.getTools()),
    ];
  };

  const callTool = async (toolName: string, args: unknown): Promise<unknown> => {
    if (!target) {
      sessionLogger?.warn('Rejected tool call because session is not connected', {
        toolName,
      });
      throw new Error(`Session "${id}" is not connected to a device`);
    }

    touch();
    sessionLogger?.info('Calling agent tool', {
      toolName,
    });

    for (const service of localServices) {
      const result = await service.callTool(toolName, args);
      if (result !== undefined) {
        sessionLogger?.info('Agent tool completed via local service', {
          toolName,
        });
        return result;
      }
    }

    const result = await handler.callTool(toolName, args);
    sessionLogger?.info('Agent tool completed via device handler', {
      toolName,
    });
    return result;
  };

  const start = async (): Promise<void> => {
    sessionLogger?.info('Starting session');
    await connect();
  };

  const stop = async (): Promise<void> => {
    stopped = true;
    clearBootstrapTimer();
    sessionLogger?.info('Stopping session');

    for (const service of localServices) {
      await service.dispose();
    }

    if (ws) {
      ws.close();
      ws = null;
    }
    if (target) {
      handler.disconnectDevice(target.id);
    }
    status = 'stopped';
    sessionLogger?.info('Session stopped');
  };

  return {
    id,
    start,
    stop,
    getInfo,
    getTools,
    callTool,
  };
};
