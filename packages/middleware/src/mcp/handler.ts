import { createToolRegistry } from './tool-registry.js';
import type {
  DevToolsPluginMessage,
  RegisterToolPayload,
  UnregisterToolPayload,
  ToolCallPayload,
  ToolResultPayload,
} from './types.js';
import { MCP_PLUGIN_ID } from './types.js';

export interface DeviceSender {
  sendMessage(message: unknown): void;
}

type PendingCall = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
};

export type MCPMessageHandler = ReturnType<typeof createMCPMessageHandler>;

export const createMCPMessageHandler = () => {
  const registry = createToolRegistry();
  const deviceConnections: Map<string, DeviceSender> = new Map();
  const pendingCalls: Map<string, PendingCall> = new Map();
  const listeners: Set<() => void> = new Set();

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
    deviceConnections.set(deviceId, sender);
    notifyToolsChanged();
  };

  const disconnectDevice = (deviceId: string): void => {
    registry.unregisterDevice(deviceId);
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
      return registry.getToolsForDevice(deviceId);
    }

    return registry.getAggregatedTools();
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

      pendingCalls.set(callId, { resolve, reject, timeoutId });
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
  };
};
