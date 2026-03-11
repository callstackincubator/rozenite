import { createToolRegistry } from './tool-registry.js';
import type {
  DevToolsPluginMessage,
  MCPTool,
  RegisterToolPayload,
  UnregisterToolPayload,
  ToolCallPayload,
  ToolResultPayload,
} from './types.js';
import { MCP_PLUGIN_ID } from './types.js';
import { createConsoleLogStore } from './console/store.js';
import type { ConsoleMessageInput } from './console/types.js';
import { createReactTreeStore } from './react/store.js';
import { createReactDevToolsBridge } from './react/react-devtools-bridge.js';
import type { ReactDevToolsBridgeMessage } from './react/types.js';

const CONSOLE_TOOL_NAMES = {
  enable: 'Console.enable',
  disable: 'Console.disable',
  getMessages: 'Console.getMessages',
  clearMessages: 'Console.clearMessages',
} as const;

const REACT_TOOL_NAMES = {
  searchNodes: 'React.searchNodes',
  getNode: 'React.getNode',
  getChildren: 'React.getChildren',
  getProps: 'React.getProps',
  getState: 'React.getState',
  getHooks: 'React.getHooks',
  startProfiling: 'React.startProfiling',
  isProfilingStarted: 'React.isProfilingStarted',
  stopProfiling: 'React.stopProfiling',
  getRenderData: 'React.getRenderData',
} as const;

const CONSOLE_TOOLS: MCPTool[] = [
  {
    name: CONSOLE_TOOL_NAMES.enable,
    description: 'Enable storing console logs for this device.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: CONSOLE_TOOL_NAMES.disable,
    description: 'Disable storing console logs for this device.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: CONSOLE_TOOL_NAMES.clearMessages,
    description: 'Clear buffered console logs for this device.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: CONSOLE_TOOL_NAMES.getMessages,
    description: 'Read buffered console logs with cursor-based pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Page size. Default 50, max 200.',
        },
        cursor: {
          type: 'string',
          description: 'Opaque cursor returned by the previous page.',
        },
        order: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort order. Default "desc".',
        },
        levels: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['verbose', 'info', 'warning', 'error'],
          },
          description: 'Optional level filter.',
        },
        text: {
          type: 'string',
          description: 'Optional substring filter.',
        },
        since: {
          type: 'number',
          description: 'Optional minimum timestamp in milliseconds.',
        },
      },
    },
  },
];

const REACT_TOOLS: MCPTool[] = [
  {
    name: REACT_TOOL_NAMES.getNode,
    description: 'Get a single React node summary by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'integer',
          description: 'React DevTools node ID.',
        },
      },
      required: ['nodeId'],
    },
  },
  {
    name: REACT_TOOL_NAMES.getChildren,
    description: 'Get a node\'s direct children with cursor-based pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'integer',
          description: 'Parent node ID.',
        },
        limit: {
          type: 'integer',
          description: 'Page size. Default 20, max 100.',
        },
        cursor: {
          type: 'string',
          description: 'Opaque cursor returned by the previous page.',
        },
      },
      required: ['nodeId'],
    },
  },
  {
    name: REACT_TOOL_NAMES.getProps,
    description: 'Get inspected props for a node with cursor-based pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'integer',
          description: 'Node ID to read props for.',
        },
        limit: {
          type: 'integer',
          description: 'Page size. Default 20, max 100.',
        },
        cursor: {
          type: 'string',
          description: 'Opaque cursor returned by the previous page.',
        },
      },
      required: ['nodeId'],
    },
  },
  {
    name: REACT_TOOL_NAMES.getState,
    description: 'Get inspected state for a node with cursor-based pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'integer',
          description: 'Node ID to read state for.',
        },
        limit: {
          type: 'integer',
          description: 'Page size. Default 20, max 100.',
        },
        cursor: {
          type: 'string',
          description: 'Opaque cursor returned by the previous page.',
        },
      },
      required: ['nodeId'],
    },
  },
  {
    name: REACT_TOOL_NAMES.getHooks,
    description: 'Get inspected hooks for a node with cursor-based pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'integer',
          description: 'Node ID to read hooks for.',
        },
        path: {
          type: 'array',
          items: {
            oneOf: [
              { type: 'string' },
              { type: 'integer' },
            ],
          },
          description: 'Optional path into hooks tree, e.g. [0, "subHooks"].',
        },
        limit: {
          type: 'integer',
          description: 'Page size. Default 20, max 100.',
        },
        cursor: {
          type: 'string',
          description: 'Opaque cursor returned by the previous page.',
        },
      },
      required: ['nodeId'],
    },
  },
  {
    name: REACT_TOOL_NAMES.searchNodes,
    description: 'Search React component tree nodes by display name or key.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query. Required and non-empty.',
        },
        rootId: {
          type: 'integer',
          description: 'Optional root node ID to scope search to a subtree.',
        },
        match: {
          type: 'string',
          enum: ['name', 'name-or-key'],
          description: 'Matching mode. Defaults to "name".',
        },
        limit: {
          type: 'integer',
          description: 'Page size. Default 20, max 100.',
        },
        cursor: {
          type: 'string',
          description: 'Opaque cursor returned by the previous page.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: REACT_TOOL_NAMES.startProfiling,
    description: 'Start React profiling or request reload-and-profile when supported.',
    inputSchema: {
      type: 'object',
      properties: {
        shouldRestart: {
          type: 'boolean',
          description: 'If true, requests reload-and-profile instead of starting immediately.',
        },
      },
    },
  },
  {
    name: REACT_TOOL_NAMES.isProfilingStarted,
    description: 'Get current React profiling status and recorded data availability.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: REACT_TOOL_NAMES.stopProfiling,
    description: 'Stop React profiling and return a compact summary of the captured session.',
    inputSchema: {
      type: 'object',
      properties: {
        waitForDataMs: {
          type: 'number',
          description: 'Max wait for backend profiling data processing. Default 3000ms, max 10000ms.',
        },
        slowRenderThresholdMs: {
          type: 'number',
          description: 'Threshold used to classify slow commits. Default 16ms.',
        },
      },
    },
  },
  {
    name: REACT_TOOL_NAMES.getRenderData,
    description: 'Get a paged summary of a single React commit by rootId and commitIndex.',
    inputSchema: {
      type: 'object',
      properties: {
        rootId: {
          type: 'integer',
          description: 'React root ID.',
        },
        commitIndex: {
          type: 'integer',
          description: 'Zero-based commit index within the selected root.',
        },
        limit: {
          type: 'integer',
          description: 'Page size. Default 20, max 100.',
        },
        cursor: {
          type: 'string',
          description: 'Opaque cursor returned by the previous page.',
        },
        sort: {
          type: 'string',
          enum: ['duration-desc', 'name-asc'],
          description: 'Sort order. Defaults to "duration-desc".',
        },
        slowRenderThresholdMs: {
          type: 'number',
          description: 'Threshold used to classify slow fibers. Default 16ms.',
        },
      },
      required: ['rootId', 'commitIndex'],
    },
  },
];

export interface DeviceSender {
  sendMessage(message: unknown): void;
  sendReactDevToolsMessage?(message: { event: string; payload: unknown }): void;
}

type PendingCall = {
  deviceId: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
};

export type MCPMessageHandler = ReturnType<typeof createMCPMessageHandler>;

export const createMCPMessageHandler = (options?: {
  createReactDevToolsBridge?: (options?: {
    sendMessage?: (message: { event: string; payload: unknown }) => void;
  }) => Promise<Awaited<ReturnType<typeof createReactDevToolsBridge>>>;
}) => {
  const registry = createToolRegistry();
  const consoleLogStore = createConsoleLogStore();
  const reactTreeStore = createReactTreeStore({
    createBridge: options?.createReactDevToolsBridge,
  });
  const deviceConnections: Map<string, DeviceSender> = new Map();
  const pendingCalls: Map<string, PendingCall> = new Map();
  const listeners: Set<() => void> = new Set();

  const isConsoleTool = (toolName: string): boolean => {
    return CONSOLE_TOOLS.some((tool) => tool.name === toolName);
  };

  const isReactTool = (toolName: string): boolean => {
    return REACT_TOOLS.some((tool) => tool.name === toolName);
  };

  const attachDeviceSchema = (tools: MCPTool[], deviceIds: string[], deviceNames: string[]): MCPTool[] => {
    if (deviceIds.length <= 1) {
      return tools;
    }

    return tools.map((tool) => ({
      ...tool,
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: {
            type: 'string',
            enum: deviceIds,
            description: `Target device ID. Available devices: ${deviceNames.join(', ')}`,
          },
          ...(tool.inputSchema.properties || {}),
        },
        required: ['deviceId', ...(tool.inputSchema.required || [])],
      },
    }));
  };

  const getConsoleTools = (deviceId?: string): MCPTool[] => {
    const devices = registry.getDevices();
    if (devices.length === 0) {
      return [];
    }

    if (deviceId) {
      return CONSOLE_TOOLS;
    }

    const deviceIds = devices.map((device) => device.id);
    const deviceNames = devices.map((device) => device.name || device.id);

    return attachDeviceSchema(CONSOLE_TOOLS, deviceIds, deviceNames);
  };

  const getReactTools = (deviceId?: string): MCPTool[] => {
    const devices = registry.getDevices();
    if (devices.length === 0) {
      return [];
    }

    if (deviceId) {
      return REACT_TOOLS;
    }

    const deviceIds = devices.map((device) => device.id);
    const deviceNames = devices.map((device) => device.name || device.id);

    return attachDeviceSchema(REACT_TOOLS, deviceIds, deviceNames);
  };

  const resolveDeviceForLocalTool = (requestedDeviceId?: string): string => {
    const devices = registry.getDevices();
    if (devices.length === 0) {
      throw new Error('No connected device is available for local MCP tools.');
    }

    if (requestedDeviceId) {
      if (!registry.hasDevice(requestedDeviceId)) {
        throw new Error(`Unknown deviceId "${requestedDeviceId}"`);
      }
      return requestedDeviceId;
    }

    return devices[0].id;
  };

  const callConsoleTool = async (
    toolName: string,
    args: unknown,
    requestedDeviceId?: string,
  ): Promise<unknown> => {
    const deviceId = resolveDeviceForLocalTool(requestedDeviceId);

    switch (toolName) {
      case CONSOLE_TOOL_NAMES.enable:
        return consoleLogStore.enable(deviceId);
      case CONSOLE_TOOL_NAMES.disable:
        return consoleLogStore.disable(deviceId);
      case CONSOLE_TOOL_NAMES.clearMessages:
        return consoleLogStore.clear(deviceId);
      case CONSOLE_TOOL_NAMES.getMessages:
        return consoleLogStore.getMessages(deviceId, args);
      default:
        throw new Error(`Tool "${toolName}" not found`);
    }
  };

  const callReactTool = async (
    toolName: string,
    args: unknown,
    requestedDeviceId?: string,
  ): Promise<unknown> => {
    const deviceId = resolveDeviceForLocalTool(requestedDeviceId);

    switch (toolName) {
      case REACT_TOOL_NAMES.getNode:
        return reactTreeStore.getNode(deviceId, args);
      case REACT_TOOL_NAMES.getChildren:
        return reactTreeStore.getChildren(deviceId, args);
      case REACT_TOOL_NAMES.getProps:
        return reactTreeStore.getProps(deviceId, args);
      case REACT_TOOL_NAMES.getState:
        return reactTreeStore.getState(deviceId, args);
      case REACT_TOOL_NAMES.getHooks:
        return reactTreeStore.getHooks(deviceId, args);
      case REACT_TOOL_NAMES.searchNodes:
        return reactTreeStore.searchNodes(deviceId, args);
      case REACT_TOOL_NAMES.startProfiling:
        return reactTreeStore.startProfiling(deviceId, args);
      case REACT_TOOL_NAMES.isProfilingStarted:
        return reactTreeStore.isProfilingStarted(deviceId);
      case REACT_TOOL_NAMES.stopProfiling:
        return reactTreeStore.stopProfiling(deviceId, args);
      case REACT_TOOL_NAMES.getRenderData:
        return reactTreeStore.getRenderData(deviceId, args);
      default:
        throw new Error(`Tool "${toolName}" not found`);
    }
  };

  const notifyToolsChanged = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const onToolsChanged = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const connectDevice = (
    deviceId: string,
    deviceName: string,
    sender: DeviceSender,
    metadata?: { reactNativeVersion?: string },
  ): void => {
    registry.registerDevice(deviceId, deviceName, metadata?.reactNativeVersion);
    consoleLogStore.registerDevice(deviceId);
    reactTreeStore.registerDevice(deviceId, {
      sendMessage: sender.sendReactDevToolsMessage,
    });
    deviceConnections.set(deviceId, sender);
    notifyToolsChanged();
  };

  const disconnectDevice = (deviceId: string): void => {
    for (const [callId, pending] of pendingCalls.entries()) {
      if (pending.deviceId !== deviceId) {
        continue;
      }

      pendingCalls.delete(callId);
      clearTimeout(pending.timeoutId);
      pending.reject(new Error(`Device "${deviceId}" disconnected`));
    }

    registry.unregisterDevice(deviceId);
    consoleLogStore.unregisterDevice(deviceId);
    reactTreeStore.unregisterDevice(deviceId);
    deviceConnections.delete(deviceId);
    notifyToolsChanged();
  };

  const handleDeviceMessage = (
    deviceId: string,
    message: DevToolsPluginMessage,
  ): void => {
    if (message.pluginId !== MCP_PLUGIN_ID) {
      return;
    }

    switch (message.type) {
      case 'register-tool': {
        const payload = message.payload as RegisterToolPayload;
        registry.registerTools(deviceId, payload.tools);
        notifyToolsChanged();
        break;
      }
      case 'unregister-tool': {
        const payload = message.payload as UnregisterToolPayload;
        registry.unregisterTools(deviceId, payload.toolNames);
        notifyToolsChanged();
        break;
      }
      case 'tool-result': {
        const payload = message.payload as ToolResultPayload;
        const pending = pendingCalls.get(payload.callId);
        if (!pending) {
          break;
        }

        pendingCalls.delete(payload.callId);
        clearTimeout(pending.timeoutId);

        if (payload.success) {
          pending.resolve(payload.result);
        } else {
          pending.reject(new Error(payload.error || 'Tool call failed'));
        }
        break;
      }
      default:
        break;
    }
  };

  const getTools = (deviceId?: string) => {
    if (deviceId) {
      return [
        ...registry.getToolsForDevice(deviceId),
        ...getConsoleTools(deviceId),
        ...getReactTools(deviceId),
      ];
    }

    return [...registry.getAggregatedTools(), ...getConsoleTools(), ...getReactTools()];
  };

  const getDevices = () => {
    return registry.getDevices();
  };

  const callTool = async (toolName: string, args: unknown): Promise<unknown> => {
    let deviceId: string | undefined;
    let toolArgs = args;

    if (
      args &&
      typeof args === 'object' &&
      'deviceId' in args &&
      typeof args.deviceId === 'string'
    ) {
      deviceId = args.deviceId;
      const rest = { ...(args as Record<string, unknown>) };
      delete rest.deviceId;
      toolArgs = rest;
    }

    if (isConsoleTool(toolName)) {
      return callConsoleTool(toolName, toolArgs, deviceId);
    }
    if (isReactTool(toolName)) {
      return callReactTool(toolName, toolArgs, deviceId);
    }

    const targetDeviceId = registry.findToolDevice(toolName, deviceId);
    if (!targetDeviceId) {
      throw new Error(
        `Tool "${toolName}" not found${deviceId ? ` on device "${deviceId}"` : ''}`,
      );
    }

    const sender = deviceConnections.get(targetDeviceId);
    if (!sender) {
      throw new Error(
        `Tool "${toolName}" is available for device "${targetDeviceId}", but there is no active DevTools connection to that device. Open React Native DevTools for the app and try again.`,
      );
    }

    const callId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const message: DevToolsPluginMessage = {
      pluginId: MCP_PLUGIN_ID,
      type: 'tool-call',
      payload: {
        callId,
        toolName,
        arguments: toolArgs,
      } as ToolCallPayload,
    };

    const promise = new Promise<unknown>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const pending = pendingCalls.get(callId);
        if (pending) {
          pendingCalls.delete(callId);
          pending.reject(new Error('Tool call timeout'));
        }
      }, 30000);

      pendingCalls.set(callId, { deviceId: targetDeviceId, resolve, reject, timeoutId });
    });

    try {
      sender.sendMessage(message);
    } catch (error) {
      const pending = pendingCalls.get(callId);
      if (pending) {
        pendingCalls.delete(callId);
        clearTimeout(pending.timeoutId);
      }
      throw error;
    }

    return await promise;
  };

  return {
    onToolsChanged,
    connectDevice,
    disconnectDevice,
    handleDeviceMessage,
    getTools,
    getDevices,
    callTool,
    captureConsoleMessage: (deviceId: string, message: ConsoleMessageInput) => {
      consoleLogStore.append(deviceId, message);
    },
    captureReactDevToolsMessage: (deviceId: string, message: ReactDevToolsBridgeMessage | unknown) => {
      return reactTreeStore.ingestReactDevToolsMessage(deviceId, message);
    },
  };
};
