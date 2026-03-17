import { createToolRegistry } from './tool-registry.js';
import type {
  DevToolsPluginMessage,
  AgentTool,
  RegisterToolPayload,
  UnregisterToolPayload,
  ToolCallPayload,
  ToolResultPayload,
} from './types.js';
import { AGENT_PLUGIN_ID } from './types.js';
import { createConsoleLogStore } from './console/store.js';
import type { ConsoleMessageInput } from './console/types.js';

const CONSOLE_TOOL_NAMES = {
  getMessages: 'getMessages',
  clearMessages: 'clearMessages',
} as const;

const CONSOLE_TOOLS: AgentTool[] = [
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

export interface DeviceSender {
  sendMessage(message: unknown): void;
}

type PendingCall = {
  deviceId: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
};

export type AgentMessageHandler = ReturnType<typeof createAgentMessageHandler>;

export const createAgentMessageHandler = () => {
  const registry = createToolRegistry();
  const consoleLogStore = createConsoleLogStore();
  const deviceConnections: Map<string, DeviceSender> = new Map();
  const pendingCalls: Map<string, PendingCall> = new Map();
  const listeners: Set<() => void> = new Set();

  const isConsoleTool = (toolName: string): boolean => {
    return CONSOLE_TOOLS.some((tool) => tool.name === toolName);
  };

  const attachDeviceSchema = (tools: AgentTool[], deviceIds: string[], deviceNames: string[]): AgentTool[] => {
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

  const getConsoleTools = (deviceId?: string): AgentTool[] => {
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

  const resolveDeviceForLocalTool = (requestedDeviceId?: string): string => {
    const devices = registry.getDevices();
    if (devices.length === 0) {
      throw new Error('No connected device is available for local Agent tools.');
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
      case CONSOLE_TOOL_NAMES.clearMessages:
        return consoleLogStore.clear(deviceId);
      case CONSOLE_TOOL_NAMES.getMessages:
        return consoleLogStore.getMessages(deviceId, args);
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
    deviceConnections.delete(deviceId);
    notifyToolsChanged();
  };

  const handleDeviceMessage = (
    deviceId: string,
    message: DevToolsPluginMessage,
  ): void => {
    if (message.pluginId !== AGENT_PLUGIN_ID) {
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
      ];
    }

    return [...registry.getAggregatedTools(), ...getConsoleTools()];
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
      pluginId: AGENT_PLUGIN_ID,
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
  };
};
