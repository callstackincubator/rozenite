import path from 'node:path';
import { createRequire } from 'node:module';
import { getDevMiddlewarePath } from './resolve.js';
import { RozeniteConfig } from './index.js';
import { getMCPHandler, getMCPWebSocketServer } from './mcp-integration.js';

const require = createRequire(import.meta.url);

export const patchDevMiddleware = (options: RozeniteConfig): void => {
  const devMiddlewareModulePath = path.dirname(getDevMiddlewarePath(options));
  const createDevMiddlewareModule = require(
    path.join(devMiddlewareModulePath, '/createDevMiddleware'),
  );

  const createDevMiddleware = createDevMiddlewareModule.default;
  createDevMiddlewareModule.default = (...args: any[]) => {
    if (options.enableMCP && args[0]) {
      const originalCustomHandler =
        args[0].unstable_customInspectorMessageHandler;

      const previousEventReporter = args[0].unstable_eventReporter;
      args[0].unstable_eventReporter = {
        logEvent: (...args: unknown[]) => {
          if (args[0] && typeof args[0] === 'object' && 'type' in args[0] && args[0].type !== 'debugger_command') {
            console.log('unstable_eventReporter', JSON.stringify(args, null, 2));
          }

          if (previousEventReporter) {
            return previousEventReporter.logEvent(...args);
          }
        }
      }

      args[0].unstable_customInspectorMessageHandler = (connection: any) => {
        console.log('unstable_customInspectorMessageHandler');
        const mcpHandler = getMCPHandler();

        if (mcpHandler) {
          const deviceId = connection.device.id;
          const deviceName = connection.device.name;

          // Register device with MCP handler
          mcpHandler.connectDevice(deviceId, deviceName, {
            sendMessage: (message: any) => {
              console.log('Node.js -> Device', JSON.stringify(message, null, 2));
              connection.device.sendMessage({
                "id": Math.floor(Math.random() * 100000),
                "method": "Runtime.evaluate",
                "params": {
                  "expression": `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.sendMessage('rozenite', ${JSON.stringify(JSON.stringify(message))})`
                }
              });
            },
          });

          // Return a handler that intercepts Rozenite messages
          return {
            handleDeviceMessage: (message: any) => {
              if (message.method === 'Runtime.bindingCalled') {
                const payload = JSON.parse(message.params.payload);

                if (payload.domain === 'rozenite') {
                  console.log('Device -> Node.js', JSON.stringify(payload.message, null, 2));
                  mcpHandler.handleDeviceMessage(deviceId, payload.message);
                  return true;
                }
              }

              return undefined;
            },
            handleDebuggerMessage: (msg) => {
              return undefined;
            },
          };

          // TODO: Reuse existing handler
        }

        return originalCustomHandler
          ? originalCustomHandler(connection)
          : undefined;
      };
    }

    const result = createDevMiddleware(...args);

    if (options.enableMCP) {
      result.websocketEndpoints['/rozenite-mcp'] = getMCPWebSocketServer();
    }

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
