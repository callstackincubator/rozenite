import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { getDevMiddlewarePath, getReactNativePackagePath } from './resolve.js';
import { RozeniteConfig } from './index.js';
import { getMCPHandler } from './mcp-integration.js';
import { logger } from './logger.js';
import type { DevToolsPluginMessage } from './mcp/types.js';
import { extractConsoleMessage } from './mcp/console/extract.js';
import type { ConsoleMessageInput } from './mcp/console/types.js';

const require = createRequire(import.meta.url);
let nextRuntimeEvaluateMessageId = 1;

type RecordValue = Record<string, unknown>;

type InspectorHandler = {
  handleDeviceMessage?: (message: unknown) => unknown;
  handleDebuggerMessage?: (message: unknown) => unknown;
};

type Connection = {
  device: {
    id: string;
    name: string;
    sendMessage: (message: unknown) => void;
  };
};

type BindingPayload = {
  domain: string;
  message?: unknown;
};

type MCPHandlerLike = {
  handleDeviceMessage: (deviceId: string, message: DevToolsPluginMessage) => void;
  captureConsoleMessage: (deviceId: string, message: ConsoleMessageInput) => void;
  captureReactDevToolsMessage: (deviceId: string, message: unknown) => void | Promise<void>;
};

const getRecord = (value: unknown): RecordValue | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as RecordValue;
  }
  return null;
};

const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const getPayloadBytes = (value: unknown): number | undefined => {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return undefined;
  }
};

const getMCPMetadata = (message: unknown): {
  type?: string;
  toolName?: string;
  callId?: string;
  bytes?: number;
} => {
  const record = getRecord(message);
  const payload = getRecord(record?.payload);

  return {
    type: getString(record?.type),
    toolName: getString(payload?.toolName),
    callId: getString(payload?.callId),
    bytes: getPayloadBytes(message),
  };
};

const logMCPMessageMetadata = (direction: 'node_to_device' | 'device_to_node', message: unknown) => {
  const meta = getMCPMetadata(message);
  const parts = [
    `direction=${direction}`,
    `type=${meta.type ?? 'unknown'}`,
    `tool=${meta.toolName ?? 'n/a'}`,
    `callId=${meta.callId ?? 'n/a'}`,
    `bytes=${meta.bytes ?? 'n/a'}`,
  ];
  logger.debug(`MCP message ${parts.join(' ')}`);
};

const getReactNativeVersion = (projectRoot: string): string | undefined => {
  try {
    const reactNativePath = getReactNativePackagePath(projectRoot);
    const packageJsonPath = path.join(reactNativePath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      version?: unknown;
    };

    return typeof packageJson.version === 'string' ? packageJson.version : undefined;
  } catch {
    return undefined;
  }
};

export const parseRozeniteBindingPayload = (message: unknown): BindingPayload | null => {
  const record = getRecord(message);
  if (!record || record.method !== 'Runtime.bindingCalled') {
    return null;
  }

  const params = getRecord(record.params);
  const rawPayload = getString(params?.payload);
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload);
    const payload = getRecord(parsed);
    const domain = getString(payload?.domain);
    if (!domain) {
      return null;
    }

    return {
      domain,
      message: payload?.message,
    };
  } catch {
    return null;
  }
};

export const composeInspectorHandlers = (
  mcpHandler: MCPHandlerLike,
  deviceId: string,
  originalHandler: InspectorHandler | undefined,
): InspectorHandler => {
  return {
    handleDeviceMessage: (message: unknown) => {
      const consoleMessage = extractConsoleMessage(message);
      if (consoleMessage) {
        mcpHandler.captureConsoleMessage(deviceId, consoleMessage);
      }

      const bindingPayload = parseRozeniteBindingPayload(message);
      if (bindingPayload?.domain === 'rozenite') {
        logMCPMessageMetadata('device_to_node', bindingPayload.message);
        mcpHandler.handleDeviceMessage(
          deviceId,
          bindingPayload.message as DevToolsPluginMessage,
        );
        return true;
      }
      if (bindingPayload?.domain === 'react-devtools') {
        void mcpHandler.captureReactDevToolsMessage(deviceId, bindingPayload.message);
      }

      return originalHandler?.handleDeviceMessage?.(message);
    },
    handleDebuggerMessage: (message: unknown) => {
      return originalHandler?.handleDebuggerMessage?.(message);
    },
  };
};

export const patchDevMiddleware = (options: RozeniteConfig): void => {
  const devMiddlewareModulePath = path.dirname(getDevMiddlewarePath(options));
  const reactNativeVersion = getReactNativeVersion(options.projectRoot);
  const createDevMiddlewareModule = require(
    path.join(devMiddlewareModulePath, '/createDevMiddleware'),
  );

  const createDevMiddleware = createDevMiddlewareModule.default;
  createDevMiddlewareModule.default = (...args: any[]) => {
    if (options.enableMCP && args[0]) {
      const originalCustomHandler =
        args[0].unstable_customInspectorMessageHandler as
        | ((connection: Connection) => InspectorHandler | undefined)
        | undefined;

      const previousEventReporter = args[0].unstable_eventReporter;
      args[0].unstable_eventReporter = {
        logEvent: (...eventArgs: unknown[]) => {
          const event = getRecord(eventArgs[0]);

          if (
            event?.type === 'debugger_connection_closed' &&
            typeof event.deviceId === 'string'
          ) {
            const mcpHandler = getMCPHandler();
            mcpHandler.disconnectDevice(event.deviceId);
          }

          if (previousEventReporter) {
            return previousEventReporter.logEvent(...eventArgs);
          }
        },
      };

      args[0].unstable_customInspectorMessageHandler = (connection: Connection) => {
        const mcpHandler = getMCPHandler();
        const originalHandler = originalCustomHandler?.(connection);
        const deviceId = connection.device.id;
        const deviceName = connection.device.name;
        const sendDomainMessage = (domain: string, message: unknown): void => {
          connection.device.sendMessage({
            id: nextRuntimeEvaluateMessageId++,
            method: 'Runtime.evaluate',
            params: {
              expression: `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.sendMessage(${JSON.stringify(domain)}, ${JSON.stringify(JSON.stringify(message))})`,
            },
          });
        };

        mcpHandler.connectDevice(deviceId, deviceName, {
          sendMessage: (message: unknown) => {
            logMCPMessageMetadata('node_to_device', message);
            sendDomainMessage('rozenite', message);
          },
          sendReactDevToolsMessage: (message: { event: string; payload: unknown }) => {
            sendDomainMessage('react-devtools', message);
          },
        }, {
          reactNativeVersion,
        });

        return composeInspectorHandlers(mcpHandler, deviceId, originalHandler);
      };
    }

    const result = createDevMiddleware(...args);

    return result;
  };
};

export const patchDevtoolsFrontendUrl = (options: RozeniteConfig): void => {
  const getDevToolsFrontendUrlModulePath = path.dirname(
    getDevMiddlewarePath(options),
  );
  const getDevToolsFrontendUrlModule = require(
    path.join(
      getDevToolsFrontendUrlModulePath,
      '/utils/getDevToolsFrontendUrl',
    ),
  );
  const getDevToolsFrontendUrl = getDevToolsFrontendUrlModule.default;
  getDevToolsFrontendUrlModule.default = (
    experiments: unknown,
    webSocketDebuggerUrl: string,
    devServerUrl: string,
    options: unknown,
  ) => {
    const originalUrl = getDevToolsFrontendUrl(
      experiments,
      webSocketDebuggerUrl,
      devServerUrl,
      options,
    );
    return originalUrl.replace('/debugger-frontend/', '/rozenite/');
  };

  patchDevMiddleware(options);
};
